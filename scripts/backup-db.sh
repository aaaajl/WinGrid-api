#!/usr/bin/env bash
export PATH=/usr/pgsql-15/bin:$PATH
# 数据库每日备份脚本（按配置顺序备份一个或多个库）
# 每个库写入自己的目录，PostgreSQL 会列出并备份该库下全部用户 schema。
# 保留天数: 15
#
# 用法:
#   1. 填写同目录 backup-db.env / db.env，或 /etc/new-api/backup-db.env
#   2. chmod +x scripts/backup-db.sh
#   3. 所有库共用一条 crontab:
#      0 3 * * * BACKUP_ENV_FILE=/home/data/scripts/db.env /home/data/scripts/backup-db.sh >> /home/data/scripts/backup.log 2>&1
#
# 第二个库用 DB2_* / DB2_BACKUP_DIR。未设置 DB2_NAME 时只备份第一个库。

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_DIR="${BACKUP_DIR:-/home/data/new-api/backup}"
DB2_BACKUP_DIR="${DB2_BACKUP_DIR:-/home/data/longevityOS-pg/backup}"
RETENTION_DAYS="${RETENTION_DAYS:-15}"
DATE_TAG="$(date +%Y%m%d_%H%M%S)"
HOSTNAME_TAG="$(hostname -s 2>/dev/null || echo host)"

# 优先加载配置文件（勿将含密码的 env 提交到仓库）
for env_file in \
  "${BACKUP_ENV_FILE:-}" \
  "${SCRIPT_DIR}/db.env" \
  "${SCRIPT_DIR}/backup-db.env" \
  "/etc/new-api/backup-db.env"; do
  if [[ -n "${env_file}" && -f "${env_file}" ]]; then
    # shellcheck disable=SC1090
    source "${env_file}"
    break
  fi
done

# source 之后再套默认值，避免被空赋值冲掉
BACKUP_DIR="${BACKUP_DIR:-/home/data/new-api/backup}"
DB2_BACKUP_DIR="${DB2_BACKUP_DIR:-/home/data/longevityOS-pg/backup}"

DB_TYPE="${DB_TYPE:-postgres}" # postgres | mysql
DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-}"
DB_USER="${DB_USER:-}"
DB_PASSWORD="${DB_PASSWORD:-}"
DB_NAME="${DB_NAME:-new-api}"

USED_BACKUP_DIRS=()

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

die() {
  log "ERROR: $*"
  exit 1
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "未找到命令: $1"
}

ensure_backup_dir() {
  local dir="$1"
  mkdir -p "${dir}"
  [[ -d "${dir}" && -w "${dir}" ]] || die "备份目录不存在或不可写: ${dir}"
}

remember_backup_dir() {
  local dir="$1"
  local seen=0
  local existing
  for existing in "${USED_BACKUP_DIRS[@]+"${USED_BACKUP_DIRS[@]}"}"; do
    if [[ "${existing}" == "${dir}" ]]; then
      seen=1
      break
    fi
  done
  if [[ "${seen}" -eq 0 ]]; then
    USED_BACKUP_DIRS+=("${dir}")
  fi
}

list_pg_schemas() {
  local schemas
  schemas="$(psql -v ON_ERROR_STOP=1 -Atc "
SELECT nspname
FROM pg_namespace
WHERE nspname NOT LIKE 'pg\_%'
  AND nspname <> 'information_schema'
ORDER BY 1;
")"
  [[ -n "${schemas}" ]] || die "未找到任何用户 schema: ${PGHOST}:${PGPORT}/${PGDATABASE}"
  printf '%s\n' "${schemas}"
}

dump_postgres() {
  local host="$1" port="$2" user="$3" password="$4" name="$5" dest_dir="$6"
  local schema safe backup_file
  local -a schemas=()

  ensure_backup_dir "${dest_dir}"
  remember_backup_dir "${dest_dir}"

  export PGPASSWORD="${password}"
  export PGHOST="${host}"
  export PGPORT="${port}"
  export PGUSER="${user}"
  export PGDATABASE="${name}"

  log "列出 ${host}:${port}/${name} 的用户 schema"
  while IFS= read -r schema; do
    [[ -n "${schema}" ]] || continue
    schemas+=("${schema}")
  done < <(list_pg_schemas)
  log "将备份全部 schema: ${schemas[*]}"

  backup_file="${dest_dir}/${name}_full_${HOSTNAME_TAG}_${DATE_TAG}.sql.gz"
  log "开始 PostgreSQL 整库备份（全部 schema）: ${host}:${port}/${name} -> ${backup_file}"
  if ! pg_dump \
    --format=plain \
    --no-owner \
    --no-acl \
    --encoding=UTF8 \
    | gzip -c > "${backup_file}"; then
    rm -f "${backup_file}"
    die "pg_dump 整库失败: ${host}:${port}/${name}"
  fi
  log "整库备份完成: ${backup_file} ($(du -h "${backup_file}" | awk '{print $1}'))"

  for schema in "${schemas[@]}"; do
    safe="${schema//\//_}"
    backup_file="${dest_dir}/${name}_${safe}_${HOSTNAME_TAG}_${DATE_TAG}.sql.gz"
    log "开始 PostgreSQL schema 备份: ${name}.${schema} -> ${backup_file}"
    if ! pg_dump \
      --format=plain \
      --no-owner \
      --no-acl \
      --encoding=UTF8 \
      --schema="${schema}" \
      | gzip -c > "${backup_file}"; then
      rm -f "${backup_file}"
      die "pg_dump schema 失败: ${name}.${schema}"
    fi
    log "schema 备份完成: ${backup_file} ($(du -h "${backup_file}" | awk '{print $1}'))"
  done

  unset PGPASSWORD
}

dump_mysql() {
  local host="$1" port="$2" user="$3" password="$4" name="$5" dest_dir="$6"
  local backup_file="${dest_dir}/${name}_full_${HOSTNAME_TAG}_${DATE_TAG}.sql.gz"

  ensure_backup_dir "${dest_dir}"
  remember_backup_dir "${dest_dir}"

  log "开始 MySQL 备份: ${host}:${port}/${name} -> ${backup_file}"
  if ! mysqldump \
    --host="${host}" \
    --port="${port}" \
    --user="${user}" \
    --password="${password}" \
    --single-transaction \
    --routines \
    --triggers \
    --events \
    --default-character-set=utf8mb4 \
    "${name}" \
    | gzip -c > "${backup_file}"; then
    rm -f "${backup_file}"
    die "mysqldump 失败: ${host}:${port}/${name}"
  fi

  log "备份完成: ${backup_file} ($(du -h "${backup_file}" | awk '{print $1}'))"
}

dump_one() {
  local host="$1" port="$2" user="$3" password="$4" name="$5" dest_dir="$6"
  [[ -n "${user}" ]] || die "请设置用户（${name}）"
  [[ -n "${password}" ]] || die "请设置密码（${name}）"
  [[ -n "${name}" ]] || die "请设置库名"
  [[ -n "${dest_dir}" ]] || die "请设置备份目录（${name}）"

  case "${DB_TYPE}" in
    postgres|postgresql|pg)
      dump_postgres "${host}" "${port}" "${user}" "${password}" "${name}" "${dest_dir}"
      ;;
    mysql|mariadb)
      dump_mysql "${host}" "${port}" "${user}" "${password}" "${name}" "${dest_dir}"
      ;;
    *)
      die "不支持的 DB_TYPE=${DB_TYPE}，请使用 postgres 或 mysql"
      ;;
  esac
}

case "${DB_TYPE}" in
  postgres|postgresql|pg)
    DB_PORT="${DB_PORT:-5432}"
    DB2_PORT="${DB2_PORT:-6543}"
    require_cmd pg_dump
    require_cmd psql
    require_cmd gzip
    ;;
  mysql|mariadb)
    DB_PORT="${DB_PORT:-3306}"
    DB2_PORT="${DB2_PORT:-3306}"
    require_cmd mysqldump
    require_cmd gzip
    ;;
  *)
    die "不支持的 DB_TYPE=${DB_TYPE}，请使用 postgres 或 mysql"
    ;;
esac

dump_one "${DB_HOST}" "${DB_PORT}" "${DB_USER}" "${DB_PASSWORD}" "${DB_NAME}" "${BACKUP_DIR}"

if [[ -n "${DB2_NAME:-}" ]]; then
  dump_one \
    "${DB2_HOST:-${DB_HOST}}" \
    "${DB2_PORT}" \
    "${DB2_USER:-${DB_USER}}" \
    "${DB2_PASSWORD:-${DB_PASSWORD}}" \
    "${DB2_NAME}" \
    "${DB2_BACKUP_DIR}"
fi

DELETED=0
for dest_dir in "${USED_BACKUP_DIRS[@]+"${USED_BACKUP_DIRS[@]}"}"; do
  while IFS= read -r -d '' old_file; do
    rm -f "${old_file}"
    DELETED=$((DELETED + 1))
    log "已删除过期备份: ${old_file}"
  done < <(find "${dest_dir}" -maxdepth 1 -type f \
    \( -name 'new-api_*.sql.gz' -o -name 'lifeos_*.sql.gz' \) \
    -mtime "+${RETENTION_DAYS}" -print0 2>/dev/null)
done

log "清理完成: 删除 ${DELETED} 个超过 ${RETENTION_DAYS} 天的备份文件"
log "当前备份列表:"
for dest_dir in "${USED_BACKUP_DIRS[@]+"${USED_BACKUP_DIRS[@]}"}"; do
  log "目录 ${dest_dir}:"
  ls -lh "${dest_dir}"/new-api_*.sql.gz "${dest_dir}"/lifeos_*.sql.gz 2>/dev/null || log "  (暂无备份文件)"
done

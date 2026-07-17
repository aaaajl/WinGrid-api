#!/usr/bin/env bash
export PATH=/usr/pgsql-15/bin:$PATH
# new-api 数据库每日备份脚本
# 备份目录: /home/data/backup
# 保留天数: 15
#
# 用法:
#   1. 复制 scripts/backup-db.env.example 为 /etc/new-api/backup-db.env（或同目录 backup-db.env）
#   2. 填写数据库连接信息
#   3. chmod +x scripts/backup-db.sh
#   4. 加入 crontab -e，例如每天凌晨 2:00:
#      0 2 * * * /home/apps/WinGrid-api/scripts/backup-db.sh >> /home/data/backup/backup.log 2>&1 >> /home/data/backup/backup.log 2>&1

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_DIR="${BACKUP_DIR:-/home/data/backup}"
RETENTION_DAYS="${RETENTION_DAYS:-15}"
DATE_TAG="$(date +%Y%m%d_%H%M%S)"
HOSTNAME_TAG="$(hostname -s 2>/dev/null || echo host)"

# 优先加载配置文件（勿将含密码的 env 提交到仓库）
for env_file in \
  "${BACKUP_ENV_FILE:-}" \
  "/etc/new-api/backup-db.env" \
  "${SCRIPT_DIR}/backup-db.env"; do
  if [[ -n "${env_file}" && -f "${env_file}" ]]; then
    # shellcheck disable=SC1090
    source "${env_file}"
    break
  fi
done

DB_TYPE="${DB_TYPE:-postgres}" # postgres | mysql
DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-}"
DB_USER="${DB_USER:-}"
DB_PASSWORD="${DB_PASSWORD:-}"
DB_NAME="${DB_NAME:-new-api}"

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

mkdir -p "${BACKUP_DIR}"
[[ -d "${BACKUP_DIR}" && -w "${BACKUP_DIR}" ]] || die "备份目录不可写: ${BACKUP_DIR}"

case "${DB_TYPE}" in
  postgres|postgresql|pg)
    DB_PORT="${DB_PORT:-5432}"
    [[ -n "${DB_USER}" ]] || die "请设置 DB_USER"
    [[ -n "${DB_PASSWORD}" ]] || die "请设置 DB_PASSWORD"
    require_cmd pg_dump
    require_cmd gzip

    BACKUP_FILE="${BACKUP_DIR}/new-api_${DB_NAME}_${HOSTNAME_TAG}_${DATE_TAG}.sql.gz"
    log "开始 PostgreSQL 备份: ${DB_HOST}:${DB_PORT}/${DB_NAME} -> ${BACKUP_FILE}"

    export PGPASSWORD="${DB_PASSWORD}"
    export PGHOST="${DB_HOST}"
    export PGPORT="${DB_PORT}"
    export PGUSER="${DB_USER}"
    export PGDATABASE="${DB_NAME}"

    # --no-owner/--no-acl 便于跨环境恢复；失败时删除不完整文件
    if ! pg_dump \
      --format=plain \
      --no-owner \
      --no-acl \
      --encoding=UTF8 \
      | gzip -c > "${BACKUP_FILE}"; then
      rm -f "${BACKUP_FILE}"
      die "pg_dump 失败"
    fi
    unset PGPASSWORD
    ;;

  mysql|mariadb)
    DB_PORT="${DB_PORT:-3306}"
    [[ -n "${DB_USER}" ]] || die "请设置 DB_USER"
    [[ -n "${DB_PASSWORD}" ]] || die "请设置 DB_PASSWORD"
    require_cmd mysqldump
    require_cmd gzip

    BACKUP_FILE="${BACKUP_DIR}/new-api_${DB_NAME}_${HOSTNAME_TAG}_${DATE_TAG}.sql.gz"
    log "开始 MySQL 备份: ${DB_HOST}:${DB_PORT}/${DB_NAME} -> ${BACKUP_FILE}"

    if ! mysqldump \
      --host="${DB_HOST}" \
      --port="${DB_PORT}" \
      --user="${DB_USER}" \
      --password="${DB_PASSWORD}" \
      --single-transaction \
      --routines \
      --triggers \
      --events \
      --default-character-set=utf8mb4 \
      "${DB_NAME}" \
      | gzip -c > "${BACKUP_FILE}"; then
      rm -f "${BACKUP_FILE}"
      die "mysqldump 失败"
    fi
    ;;

  *)
    die "不支持的 DB_TYPE=${DB_TYPE}，请使用 postgres 或 mysql"
    ;;
esac

FILE_SIZE="$(du -h "${BACKUP_FILE}" | awk '{print $1}')"
log "备份完成: ${BACKUP_FILE} (${FILE_SIZE})"

# 删除超过保留天数的备份（仅匹配本脚本命名的 .sql.gz）
DELETED=0
while IFS= read -r -d '' old_file; do
  rm -f "${old_file}"
  DELETED=$((DELETED + 1))
  log "已删除过期备份: ${old_file}"
done < <(find "${BACKUP_DIR}" -maxdepth 1 -type f -name 'new-api_*.sql.gz' -mtime "+${RETENTION_DAYS}" -print0 2>/dev/null)

log "清理完成: 删除 ${DELETED} 个超过 ${RETENTION_DAYS} 天的备份文件"
log "当前备份列表:"
ls -lh "${BACKUP_DIR}"/new-api_*.sql.gz 2>/dev/null || log "(暂无备份文件)"

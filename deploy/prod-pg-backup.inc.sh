# 本地 SSH 包装：把可在生产机本机运行的脚本同步到 /home/data/scripts。
# 由 prod-longevityApi-pg.sh、prod-longevityOS-pg.sh source。
# 依赖调用方已定义: remote、SCP_OPTS、REMOTE_USER、REMOTE_HOST、SCRIPT_DIR、REPO_ROOT。

REMOTE_SCRIPTS_DIR="${REMOTE_SCRIPTS_DIR:-/home/data/scripts}"
ONHOST_DIR="${ONHOST_DIR:-${SCRIPT_DIR}/onhost}"
LOCAL_BACKUP_SH="${LOCAL_BACKUP_SH:-${REPO_ROOT}/scripts/backup-db.sh}"
LOCAL_BACKUP_ENV="${LOCAL_BACKUP_ENV:-${REPO_ROOT}/scripts/backup-db.env}"

sync_onhost_scripts() {
  local files=(
    "prod-longevityOS-pg.sh"
    "prod-longevityApi-pg.sh"
    "prod-pg-backup.inc.sh"
  )
  local f

  if [[ ! -d "${ONHOST_DIR}" ]]; then
    echo "ERROR: 本机 onhost 脚本目录不存在: ${ONHOST_DIR}" >&2
    exit 1
  fi
  for f in "${files[@]}"; do
    if [[ ! -f "${ONHOST_DIR}/${f}" ]]; then
      echo "ERROR: 缺少本机脚本: ${ONHOST_DIR}/${f}" >&2
      exit 1
    fi
  done
  if [[ ! -f "${LOCAL_BACKUP_SH}" || ! -f "${LOCAL_BACKUP_ENV}" ]]; then
    echo "ERROR: 缺少本机备份脚本或配置: ${LOCAL_BACKUP_SH} / ${LOCAL_BACKUP_ENV}" >&2
    exit 1
  fi

  echo "==> 同步生产机本机脚本到 ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_SCRIPTS_DIR}"
  remote "mkdir -p '${REMOTE_SCRIPTS_DIR}' /home/data/new-api/backup /home/data/longevityOS-pg/backup"
  for f in "${files[@]}"; do
    scp "${SCP_OPTS[@]}" "${ONHOST_DIR}/${f}" "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_SCRIPTS_DIR}/${f}"
  done
  scp "${SCP_OPTS[@]}" "${LOCAL_BACKUP_SH}" "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_SCRIPTS_DIR}/backup-db.sh"
  scp "${SCP_OPTS[@]}" "${LOCAL_BACKUP_ENV}" "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_SCRIPTS_DIR}/db.env"
  remote "chmod 755 '${REMOTE_SCRIPTS_DIR}/prod-longevityOS-pg.sh' '${REMOTE_SCRIPTS_DIR}/prod-longevityApi-pg.sh' '${REMOTE_SCRIPTS_DIR}/backup-db.sh' && chmod 644 '${REMOTE_SCRIPTS_DIR}/prod-pg-backup.inc.sh' && chmod 600 '${REMOTE_SCRIPTS_DIR}/db.env'"
  echo "==> 已生成: ${REMOTE_SCRIPTS_DIR}/prod-longevityOS-pg.sh ${REMOTE_SCRIPTS_DIR}/prod-longevityApi-pg.sh"
}

run_onhost() {
  local name="$1"
  shift
  sync_onhost_scripts
  echo "==> 在生产机执行: ${REMOTE_SCRIPTS_DIR}/${name} $*"
  remote "${REMOTE_SCRIPTS_DIR}/${name}" "$@"
}

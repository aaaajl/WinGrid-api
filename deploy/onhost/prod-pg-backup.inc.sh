# 生产机本机运行的共用备份安装/检查逻辑。
# 由 /home/data/scripts/prod-longevityApi-pg.sh、prod-longevityOS-pg.sh source。
# 只维护一条 crontab：每天 03:00 按顺序 dump new-api 与 lifeos。

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

REMOTE_BACKUP_SH="${REMOTE_BACKUP_SH:-/home/data/scripts/backup-db.sh}"
REMOTE_BACKUP_ENV="${REMOTE_BACKUP_ENV:-/home/data/scripts/db.env}"
BACKUP_DIR="${BACKUP_DIR:-/home/data/new-api/backup}"
BACKUP_DIR2="${BACKUP_DIR2:-/home/data/longevityOS-pg/backup}"
BACKUP_LOG="${BACKUP_LOG:-/home/data/scripts/backup.log}"
CRON_SCHEDULE="${CRON_SCHEDULE:-0 3 * * *}"
LOCAL_BACKUP_SH="${LOCAL_BACKUP_SH:-${SCRIPT_DIR}/backup-db.sh}"
LOCAL_BACKUP_ENV="${LOCAL_BACKUP_ENV:-${SCRIPT_DIR}/db.env}"

install_backup_files() {
  if [[ ! -f "${LOCAL_BACKUP_SH}" ]]; then
    echo "ERROR: 备份脚本不存在: ${LOCAL_BACKUP_SH}" >&2
    exit 1
  fi
  if [[ ! -f "${LOCAL_BACKUP_ENV}" ]]; then
    echo "ERROR: 备份配置不存在: ${LOCAL_BACKUP_ENV}" >&2
    exit 1
  fi

  mkdir -p "$(dirname "${REMOTE_BACKUP_SH}")" "$(dirname "${REMOTE_BACKUP_ENV}")" \
    "$(dirname "${BACKUP_LOG}")" "${BACKUP_DIR}" "${BACKUP_DIR2}"
  if [[ "${LOCAL_BACKUP_SH}" != "${REMOTE_BACKUP_SH}" ]]; then
    cp -a "${LOCAL_BACKUP_SH}" "${REMOTE_BACKUP_SH}"
  fi
  if [[ "${LOCAL_BACKUP_ENV}" != "${REMOTE_BACKUP_ENV}" ]]; then
    cp -a "${LOCAL_BACKUP_ENV}" "${REMOTE_BACKUP_ENV}"
  fi
  chmod 755 "${REMOTE_BACKUP_SH}"
  chmod 600 "${REMOTE_BACKUP_ENV}"
}

install_backup_cron() {
  local desired tmp
  desired="${CRON_SCHEDULE} BACKUP_ENV_FILE=${REMOTE_BACKUP_ENV} ${REMOTE_BACKUP_SH} >> ${BACKUP_LOG} 2>&1"
  tmp="$(mktemp)"
  if crontab -l >/tmp/shared-backup-cron.old 2>/dev/null; then
    grep -v 'backup-db\.sh' /tmp/shared-backup-cron.old > "${tmp}" || true
    rm -f /tmp/shared-backup-cron.old
  else
    : > "${tmp}"
  fi
  printf '%s\n' "${desired}" >> "${tmp}"
  awk 'NF || !seen++' "${tmp}" > "${tmp}.n" && mv "${tmp}.n" "${tmp}"
  crontab "${tmp}"
  rm -f "${tmp}"
  systemctl enable crond >/dev/null 2>&1 || systemctl enable cron >/dev/null 2>&1 || true
  systemctl start crond >/dev/null 2>&1 || systemctl start cron >/dev/null 2>&1 || true
  echo "已写入唯一备份 crontab: ${desired}"
}

remote_backup_check() {
  local ok=1 cron_lines cron_count=0 cron_line="" cron_path=""
  local env_file missing latest_newapi latest_lifeos last_log
  say() { printf '%s\n' "$*"; }
  pass() { say "[ok]   $*"; }
  fail() { say "[fail] $*"; ok=0; }

  if systemctl is-active crond >/dev/null 2>&1 || systemctl is-active cron >/dev/null 2>&1; then
    pass "cron 服务在运行"
  else
    fail "cron 服务未运行（crond/cron）"
  fi

  cron_lines="$(crontab -l 2>/dev/null | grep 'backup-db\.sh' | grep -v '^[[:space:]]*#' || true)"
  if [[ -n "${cron_lines}" ]]; then
    cron_count="$(printf '%s\n' "${cron_lines}" | grep -c .)"
  fi
  if [[ "${cron_count}" -eq 0 ]]; then
    fail "crontab 没有 backup-db.sh 任务"
  elif [[ "${cron_count}" -gt 1 ]]; then
    fail "crontab 有 ${cron_count} 条备份任务，只应保留一条:"
    printf '%s\n' "${cron_lines}" | while IFS= read -r line; do say "       ${line}"; done
    cron_line="$(printf '%s\n' "${cron_lines}" | grep -F "${REMOTE_BACKUP_SH}" | tail -n1 || true)"
    cron_path="$(printf '%s\n' "${cron_line}" | awk '{for (i=1;i<=NF;i++) if ($i ~ /backup-db\.sh/) { print $i; exit }}')"
  else
    cron_line="${cron_lines}"
    cron_path="$(printf '%s\n' "${cron_line}" | awk '{for (i=1;i<=NF;i++) if ($i ~ /backup-db\.sh/) { print $i; exit }}')"
    if [[ "${cron_path}" == "${REMOTE_BACKUP_SH}" && -x "${cron_path}" ]]; then
      pass "crontab 仅有一条备份任务: ${cron_line}"
    elif [[ -n "${cron_path}" && -x "${cron_path}" ]]; then
      fail "crontab 指向了非共用脚本: ${cron_path}（期望 ${REMOTE_BACKUP_SH}）"
    elif [[ -n "${cron_path}" ]]; then
      fail "crontab 指向的脚本不可用: ${cron_path}"
    else
      fail "无法从 crontab 解析 backup-db.sh 路径: ${cron_line}"
    fi
  fi

  if [[ -x "${REMOTE_BACKUP_SH}" ]]; then
    pass "共用备份脚本存在: ${REMOTE_BACKUP_SH}"
  else
    fail "共用备份脚本缺失或不可执行: ${REMOTE_BACKUP_SH}"
  fi

  if [[ -f "${REMOTE_BACKUP_ENV}" ]]; then
    pass "共用备份配置存在: ${REMOTE_BACKUP_ENV}"
    # shellcheck disable=SC1090
    set -a
    # shellcheck source=/dev/null
    source "${REMOTE_BACKUP_ENV}"
    set +a
    missing=""
    [[ -n "${DB_TYPE:-}" ]] || missing="${missing} DB_TYPE"
    [[ -n "${DB_HOST:-}" ]] || missing="${missing} DB_HOST"
    [[ -n "${DB_USER:-}" ]] || missing="${missing} DB_USER"
    [[ -n "${DB_PASSWORD:-}" ]] || missing="${missing} DB_PASSWORD"
    [[ -n "${DB_NAME:-}" ]] || missing="${missing} DB_NAME"
    [[ -n "${DB2_HOST:-}" ]] || missing="${missing} DB2_HOST"
    [[ -n "${DB2_PORT:-}" ]] || missing="${missing} DB2_PORT"
    [[ -n "${DB2_USER:-}" ]] || missing="${missing} DB2_USER"
    [[ -n "${DB2_PASSWORD:-}" ]] || missing="${missing} DB2_PASSWORD"
    [[ -n "${DB2_NAME:-}" ]] || missing="${missing} DB2_NAME"
    [[ -n "${BACKUP_DIR:-}" ]] || missing="${missing} BACKUP_DIR"
    [[ -n "${DB2_BACKUP_DIR:-}" ]] || missing="${missing} DB2_BACKUP_DIR"
    if [[ -z "${missing}" ]]; then
      pass "备份配置含两个库（${DB_NAME}:${DB_PORT:-5432} → ${BACKUP_DIR} ； ${DB2_NAME}:${DB2_PORT} → ${DB2_BACKUP_DIR}）"
    else
      fail "备份配置缺少字段:${missing}"
    fi
  else
    fail "找不到共用备份配置: ${REMOTE_BACKUP_ENV}"
  fi

  if [[ -x /usr/pgsql-15/bin/pg_dump ]] || command -v pg_dump >/dev/null 2>&1; then
    pass "pg_dump 可用"
  else
    fail "未找到 pg_dump（期望 /usr/pgsql-15/bin/pg_dump）"
  fi

  if [[ -d "${BACKUP_DIR}" && -w "${BACKUP_DIR}" ]]; then
    pass "new-api 备份目录可写: ${BACKUP_DIR}"
  else
    fail "new-api 备份目录不存在或不可写: ${BACKUP_DIR}"
  fi
  if [[ -d "${BACKUP_DIR2}" && -w "${BACKUP_DIR2}" ]]; then
    pass "lifeos 备份目录可写: ${BACKUP_DIR2}"
  else
    fail "lifeos 备份目录不存在或不可写: ${BACKUP_DIR2}"
  fi

  latest_newapi="$(ls -1t "${BACKUP_DIR}"/new-api_*.sql.gz 2>/dev/null | head -n1 || true)"
  latest_lifeos="$(ls -1t "${BACKUP_DIR2}"/lifeos_*.sql.gz 2>/dev/null | head -n1 || true)"
  if [[ -n "${latest_newapi}" ]]; then
    pass "new-api 最近备份: ${latest_newapi}"
  else
    say "[warn] ${BACKUP_DIR} 里还没有 new-api dump（cron 要到 ${CRON_SCHEDULE} 才会跑）"
  fi
  if [[ -n "${latest_lifeos}" ]]; then
    pass "lifeos 最近备份: ${latest_lifeos}"
  else
    say "[warn] ${BACKUP_DIR2} 里还没有 lifeos dump（cron 要到 ${CRON_SCHEDULE} 才会跑）"
  fi

  last_log="$(tail -n1 "${BACKUP_LOG}" 2>/dev/null || true)"
  if printf '%s\n' "${last_log}" | grep -q 'No such file or directory'; then
    if [[ -n "${cron_path}" && -x "${cron_path}" && "${cron_count}" -eq 1 ]]; then
      say "[warn] backup.log 末行仍是旧错误（crontab 已指向有效脚本，等下次 ${CRON_SCHEDULE} 执行）: ${last_log}"
    else
      fail "backup.log 最近一次报脚本不存在: ${last_log}"
    fi
  fi

  if [[ "${ok}" -eq 1 ]]; then
    say "==> 自动备份已正确启用（共用一条 cron，顺序: new-api → lifeos）"
    return 0
  fi
  say "==> 自动备份未正确启用"
  return 1
}

ensure_backup_enabled() {
  echo "==> 检查共用自动备份"
  if remote_backup_check; then
    return 0
  fi
  if [[ "${REPAIR_BACKUP}" -ne 1 ]]; then
    echo "ERROR: 自动备份未正确启用（未修复，因为指定了 --no-repair）" >&2
    return 1
  fi
  echo "==> 自动备份未正确启用，开始修复（只保留一条 crontab）"
  install_backup_files
  install_backup_cron
  echo "==> 复检自动备份"
  remote_backup_check
}

show_shared_backup_status() {
  echo "--- crontab ---"
  crontab -l 2>/dev/null || echo "(无 crontab)"
  echo
  echo "--- new-api 备份目录 ${BACKUP_DIR} ---"
  ls -lht "${BACKUP_DIR}"/new-api_*.sql.gz 2>/dev/null | head -n 8 || echo "(暂无备份文件)"
  echo
  echo "--- lifeos 备份目录 ${BACKUP_DIR2} ---"
  ls -lht "${BACKUP_DIR2}"/lifeos_*.sql.gz 2>/dev/null | head -n 8 || echo "(暂无备份文件)"
  echo
  echo "--- backup.log 末尾 ---"
  tail -n 8 "${BACKUP_LOG}" 2>/dev/null || echo "(无 backup.log)"
}

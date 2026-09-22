#!/usr/bin/env bash
# 从本地启停线上 new-api PostgreSQL。启动时会把可在生产机本机运行的同功能脚本
# 写到 /home/data/scripts，再 SSH 调用它们。
#
# 用法:
#   ./prod-longevityApi-pg.sh start
#   ./prod-longevityApi-pg.sh stop --yes
#   ./prod-longevityApi-pg.sh status
#   ./prod-longevityApi-pg.sh check-backup
#   ./prod-longevityApi-pg.sh check-backup --no-repair
#
# 生产机本机:
#   /home/data/scripts/prod-longevityApi-pg.sh start|stop|status|check-backup
#
# 环境变量（均可选）:
#   REMOTE_HOST   默认 101.132.81.209
#   REMOTE_USER   默认 root
#   SSH_KEY       默认 ${REPO_ROOT}/localFiles/Longevity.pem
#   SSH_PORT      默认 22
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

REMOTE_HOST="${REMOTE_HOST:-101.132.81.209}"
REMOTE_USER="${REMOTE_USER:-root}"
SSH_KEY="${SSH_KEY:-${REPO_ROOT}/localFiles/Longevity.pem}"
SSH_PORT="${SSH_PORT:-22}"

ACTION=""
CONFIRM_STOP=0
REPAIR_BACKUP=1

usage() {
  sed -n '2,20p' "$0"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    start|stop|status|check-backup)
      if [[ -n "${ACTION}" ]]; then
        echo "只能指定一个动作" >&2
        exit 1
      fi
      ACTION="$1"
      shift
      ;;
    --yes) CONFIRM_STOP=1; shift ;;
    --no-repair) REPAIR_BACKUP=0; shift ;;
    -h|--help) usage; exit 0 ;;
    *)
      echo "未知参数: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if [[ -z "${ACTION}" ]]; then
  usage
  exit 1
fi

SSH_OPTS=(
  -i "${SSH_KEY}"
  -p "${SSH_PORT}"
  -o StrictHostKeyChecking=accept-new
  -o IdentitiesOnly=yes
  -o LogLevel=ERROR
  -o ServerAliveInterval=30
  -o ConnectTimeout=15
)

SCP_OPTS=(
  -i "${SSH_KEY}"
  -P "${SSH_PORT}"
  -o StrictHostKeyChecking=accept-new
  -o IdentitiesOnly=yes
  -o LogLevel=ERROR
  -o ServerAliveInterval=30
  -o ConnectTimeout=15
)

remote() {
  ssh "${SSH_OPTS[@]}" "${REMOTE_USER}@${REMOTE_HOST}" "$@"
}

# shellcheck source=prod-pg-backup.inc.sh
source "${SCRIPT_DIR}/prod-pg-backup.inc.sh"

if [[ ! -f "${SSH_KEY}" ]]; then
  echo "ERROR: SSH key not found: ${SSH_KEY}"
  echo "Place Longevity.pem under localFiles/ (gitignored) or set SSH_KEY."
  exit 1
fi
mode="$(stat -f '%A' "${SSH_KEY}" 2>/dev/null || stat -c '%a' "${SSH_KEY}" 2>/dev/null || echo "")"
if [[ -n "${mode}" && "${mode}" != "400" && "${mode}" != "600" ]]; then
  echo "Fixing SSH key permissions on ${SSH_KEY} -> 400"
  chmod 400 "${SSH_KEY}"
fi

echo "Target: ${REMOTE_USER}@${REMOTE_HOST}"
echo "Key:    ${SSH_KEY}"

REMOTE_ARGS=("${ACTION}")
if [[ "${CONFIRM_STOP}" -eq 1 ]]; then
  REMOTE_ARGS+=(--yes)
fi
if [[ "${REPAIR_BACKUP}" -eq 0 ]]; then
  REMOTE_ARGS+=(--no-repair)
fi

run_onhost prod-longevityApi-pg.sh "${REMOTE_ARGS[@]}"

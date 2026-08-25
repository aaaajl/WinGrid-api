#!/usr/bin/env bash
# 本地一键部署主节点到线上服务器：构建 linux/amd64 镜像 → 上传 → docker load → 重启
#
# 用法:
#   ./deploy-master.sh                 # 构建、上传、load、重启（prod）
#   ./deploy-master.sh --skip-build    # 跳过构建，使用已有 tar.gz
#   ./deploy-master.sh --no-restart    # 只上传并 load，不重启
#   ./deploy-master.sh --sync-scripts  # 强制同步 compose / start 脚本到远端
#   ./deploy-master.sh --status        # 仅查看远程服务状态
#   ./deploy-master.sh --no-cache      # 构建时不加缓存
#
# 依赖本地:
#   ./buildProd.sh --save  →  ${IMAGE 安全名}-linux-amd64.tar.gz
# 远端目录须已有 .env（本脚本不会覆盖 .env）
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# ---------- 可覆盖的部署参数 ----------
REMOTE_HOST="${REMOTE_HOST:-101.132.81.209}"
REMOTE_USER="${REMOTE_USER:-root}"
REMOTE_DIR="${REMOTE_DIR:-/home/apps/longevity-new-api/master}"
SSH_KEY="${SSH_KEY:-${REPO_ROOT}/localFiles/Longevity.pem}"
SSH_PORT="${SSH_PORT:-22}"
IMAGE="${IMAGE:-wingrid-api:local}"
ENV_MODE="${ENV_MODE:-prod}"
# ARCHIVE 未显式设置时，按 IMAGE 推导（与 buildProd.sh image_safe_name 一致）
ARCHIVE="${ARCHIVE:-}"

SKIP_BUILD=false
NO_RESTART=false
STATUS_ONLY=false
SYNC_SCRIPTS=false
NO_CACHE=""

image_safe_name() {
  # wingrid-api:local → wingrid-api-local
  echo "${1:-${IMAGE}}" | tr ':/' '--' | tr -s '-' | sed 's/-$//'
}

resolve_archive() {
  if [[ -n "${ARCHIVE}" ]]; then
    return 0
  fi
  ARCHIVE="${SCRIPT_DIR}/$(image_safe_name)-linux-amd64.tar.gz"
}

usage() {
  cat <<EOF
Usage: $0 [options]

Options:
  --skip-build     跳过镜像构建，直接使用已有 tar.gz
  --no-restart     只上传并 docker load，不执行远程重启
  --sync-scripts   强制用本地 compose / start-master.sh 覆盖远端
  --status         仅查看远程服务状态（不构建、不上传）
  --no-cache       传给 buildProd.sh，不使用构建缓存
  -h, --help       显示帮助

Environment overrides:
  REMOTE_HOST      默认 101.132.81.209
  REMOTE_USER      默认 root
  REMOTE_DIR       默认 /home/apps/longevity-new-api/master
  SSH_KEY          默认 \${REPO_ROOT}/localFiles/Longevity.pem
  SSH_PORT         默认 22
  IMAGE            默认 wingrid-api:local
  ENV_MODE         重启时传给 start-master.sh，默认 prod
  ARCHIVE          本地镜像包路径（默认按 IMAGE 推导）

Examples:
  $0
  $0 --skip-build
  ENV_MODE=prod $0 --sync-scripts
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-build) SKIP_BUILD=true; shift ;;
    --no-restart) NO_RESTART=true; shift ;;
    --sync-scripts) SYNC_SCRIPTS=true; shift ;;
    --status) STATUS_ONLY=true; shift ;;
    --no-cache) NO_CACHE="--no-cache"; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1"; usage; exit 1 ;;
  esac
done

# 导出 IMAGE，供 buildProd.sh 子进程使用（避免仅 shell 变量不传递）
export IMAGE

SSH_OPTS=(
  -i "${SSH_KEY}"
  -p "${SSH_PORT}"
  -o StrictHostKeyChecking=accept-new
  -o IdentitiesOnly=yes
  -o LogLevel=ERROR
  -o ServerAliveInterval=30
  -o ConnectTimeout=15
)

# scp 端口参数是 -P（大写）；-p 表示保留时间戳
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

scp_to() {
  scp "${SCP_OPTS[@]}" "$@"
}

require_key() {
  if [[ ! -f "${SSH_KEY}" ]]; then
    echo "ERROR: SSH key not found: ${SSH_KEY}"
    echo "Place Longevity.pem under localFiles/ (gitignored) or set SSH_KEY."
    exit 1
  fi
  local mode
  mode="$(stat -f '%A' "${SSH_KEY}" 2>/dev/null || stat -c '%a' "${SSH_KEY}" 2>/dev/null || echo "")"
  if [[ -n "${mode}" && "${mode}" != "400" && "${mode}" != "600" ]]; then
    echo "Fixing SSH key permissions on ${SSH_KEY} -> 400"
    chmod 400 "${SSH_KEY}"
  fi
}

find_local_archive() {
  if [[ ! -f "${ARCHIVE}" ]]; then
    echo "ERROR: image archive not found: ${ARCHIVE}"
    echo "Build first: ${SCRIPT_DIR}/buildProd.sh --save"
    exit 1
  fi
  echo "${ARCHIVE}"
}

build() {
  echo "==> Build prod image (linux/amd64) + save"
  # shellcheck disable=SC2086
  "${SCRIPT_DIR}/buildProd.sh" --save ${NO_CACHE}
}

sync_remote_scripts() {
  local files=(
    "docker-compose.master.yml"
    "start-master.sh"
  )
  local need_sync=false
  local f

  for f in "${files[@]}"; do
    if [[ ! -f "${SCRIPT_DIR}/${f}" ]]; then
      echo "ERROR: local file missing: ${SCRIPT_DIR}/${f}"
      exit 1
    fi
  done

  if [[ "${SYNC_SCRIPTS}" == "true" ]]; then
    need_sync=true
  else
    for f in "${files[@]}"; do
      # 用退出码判断，避免 SSH MOTD/banner 污染 stdout 导致误判
      if ! remote "test -f '${REMOTE_DIR}/${f}'"; then
        need_sync=true
        break
      fi
    done
  fi

  if [[ "${need_sync}" != "true" ]]; then
    echo "==> Keep existing remote scripts (pass --sync-scripts to overwrite)"
    return
  fi

  if [[ "${SYNC_SCRIPTS}" == "true" ]]; then
    echo "==> Force syncing master scripts (--sync-scripts)"
  else
    echo "==> Remote scripts missing; uploading compose / start-master.sh"
  fi

  for f in "${files[@]}"; do
    scp_to "${SCRIPT_DIR}/${f}" "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_DIR}/${f}"
  done
  remote "chmod +x '${REMOTE_DIR}/start-master.sh'"
}

upload_and_load() {
  local local_archive="$1"
  local name
  name="$(basename "${local_archive}")"
  local remote_tmp="${REMOTE_DIR}/.${name}.uploading"
  local remote_archive="${REMOTE_DIR}/${name}"
  local remote_bak="${REMOTE_DIR}/bak"
  local ts
  ts="$(date +%Y%m%d%H%M%S)"

  echo "==> Ensuring remote directory exists: ${REMOTE_DIR}"
  remote "mkdir -p '${REMOTE_DIR}' '${remote_bak}' '${REMOTE_DIR}/logs' '${REMOTE_DIR}/data'"

  sync_remote_scripts

  echo "==> Backing up previous archive (if any) ..."
  remote bash -s <<EOF
set -euo pipefail
cd '${REMOTE_DIR}'
mkdir -p '${remote_bak}'
if [[ -f '${name}' ]]; then
  bak_path="${remote_bak}/${name}.${ts}"
  cp -f '${name}' "\${bak_path}"
  echo "Backed up: ${name} -> \${bak_path}"
  ls -1t '${remote_bak}/${name}'.* 2>/dev/null | tail -n +6 | while read -r f; do rm -f "\$f"; done
  ls -lh "\${bak_path}"
else
  echo "No existing archive to backup (first deploy?)"
fi
EOF

  echo "==> Uploading ${name} ($(du -h "${local_archive}" | awk '{print $1}')) -> ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_DIR}/"
  scp_to "${local_archive}" "${REMOTE_USER}@${REMOTE_HOST}:${remote_tmp}"

  echo "==> Atomic replace + docker load (${IMAGE})"
  remote bash -s <<EOF
set -euo pipefail
cd '${REMOTE_DIR}'
if [[ ! -f '${remote_tmp}' ]]; then
  echo "ERROR: upload temp file missing: ${remote_tmp}"
  exit 1
fi
mv -f '${remote_tmp}' '${remote_archive}'
gunzip -c '${remote_archive}' | docker load
docker image inspect '${IMAGE}' --format 'ID={{.Id}} Arch={{.Architecture}} OS={{.Os}} Size={{.Size}}'
EOF
}

restart_remote() {
  echo "==> Restarting remote master (ENV_MODE=${ENV_MODE}) ..."
  remote bash -s <<EOF
set -euo pipefail
cd '${REMOTE_DIR}'
if [[ ! -f .env ]]; then
  echo "ERROR: ${REMOTE_DIR}/.env not found on server"
  echo "Copy .env.example to .env and fill secrets before first deploy."
  exit 1
fi
if [[ ! -f start-master.sh ]]; then
  echo "ERROR: ${REMOTE_DIR}/start-master.sh not found on server"
  exit 1
fi
chmod +x start-master.sh
# 显式传 IMAGE，且 start-master.sh 会优先采用调用方值（不被 .env 覆盖）
IMAGE='${IMAGE}' ./start-master.sh '${ENV_MODE}' --restart
docker ps --filter name=new-api-master --format 'table {{.Names}}\t{{.Status}}\t{{.Image}}\t{{.Ports}}'
EOF
}

show_status() {
  echo "==> Remote status @ ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_DIR}"
  remote bash -s <<EOF
set -euo pipefail
cd '${REMOTE_DIR}'
ls -lh *.tar.gz 2>/dev/null || echo "(no image archive)"
docker image inspect '${IMAGE}' --format 'ID={{.Id}} Arch={{.Architecture}}' 2>/dev/null || echo "image missing: ${IMAGE}"
HOST_PORT=3888
if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi
if [[ -f start-master.sh ]]; then
  chmod +x start-master.sh
  docker compose -f docker-compose.master.yml --env-file .env ps 2>/dev/null || true
  docker ps --filter name=new-api-master --format 'table {{.Names}}\t{{.Status}}\t{{.Image}}\t{{.Ports}}' || true
  curl -fsS --connect-timeout 2 --max-time 5 "http://127.0.0.1:\${HOST_PORT:-3888}/api/status" 2>/dev/null || true
  echo
else
  echo "start-master.sh missing"
  docker ps --filter name=new-api-master || true
fi
EOF
}

main() {
  require_key

  if [[ "${STATUS_ONLY}" == "true" ]]; then
    show_status
    exit 0
  fi

  echo "Repo:   ${REPO_ROOT}"
  echo "Target: ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_DIR}"
  echo "Key:    ${SSH_KEY}"
  echo "Image:  ${IMAGE}"
  echo "Mode:   ${ENV_MODE}"

  if [[ "${SKIP_BUILD}" != "true" ]]; then
    build
  else
    echo "==> Skip build"
  fi

  resolve_archive
  local local_archive
  local_archive="$(find_local_archive)"
  echo "==> Local archive: ${local_archive}"

  upload_and_load "${local_archive}"

  if [[ "${NO_RESTART}" == "true" ]]; then
    echo "==> Skip restart (--no-restart)"
  else
    restart_remote
  fi

  echo "==> Deploy master done."
}

main

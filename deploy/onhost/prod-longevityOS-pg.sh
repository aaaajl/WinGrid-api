#!/usr/bin/env bash
# 在生产机本机启停 LifeOS PostgreSQL（容器 longevityOS-pg），并校验共用每日备份。
#
# 用法:
#   ./prod-longevityOS-pg.sh start
#   ./prod-longevityOS-pg.sh stop --yes
#   ./prod-longevityOS-pg.sh status
#   ./prod-longevityOS-pg.sh check-backup
#   ./prod-longevityOS-pg.sh check-backup --no-repair
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

PG_CONTAINER="${PG_CONTAINER:-longevityOS-pg}"
PG_IMAGE="${PG_IMAGE:-postgres:15}"
PG_VOLUME="${PG_VOLUME:-longevityOS-data}"
PG_NETWORK="${PG_NETWORK:-wingrid-api_new-api-network}"
PG_USER="${PG_USER:-root}"
PG_DB="${PG_DB:-lifeos}"
PG_PORT="${PG_PORT:-6543}"
PG_PASSWORD="${PG_PASSWORD:-2026@LBiscuits}"

ACTION=""
CONFIRM_STOP=0
REPAIR_BACKUP=1

usage() {
  sed -n '2,12p' "$0"
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

# shellcheck source=prod-pg-backup.inc.sh
source "${SCRIPT_DIR}/prod-pg-backup.inc.sh"

start_pg() {
  echo "==> 启动 PostgreSQL  容器=${PG_CONTAINER}"

  if ! docker volume inspect "${PG_VOLUME}" >/dev/null 2>&1; then
    echo "数据卷不存在，首次创建: ${PG_VOLUME}"
    docker volume create "${PG_VOLUME}" >/dev/null
  fi

  if ! docker network inspect "${PG_NETWORK}" >/dev/null 2>&1; then
    echo "网络不存在，正在创建: ${PG_NETWORK}"
    docker network create "${PG_NETWORK}" >/dev/null
  fi

  if ! docker image inspect "${PG_IMAGE}" >/dev/null 2>&1; then
    echo "本地没有镜像 ${PG_IMAGE}，正在 pull ..."
    docker pull "${PG_IMAGE}"
  fi

  if docker inspect "${PG_CONTAINER}" >/dev/null 2>&1; then
    docker update --restart=always "${PG_CONTAINER}" >/dev/null
    local state
    state="$(docker inspect -f '{{.State.Status}}' "${PG_CONTAINER}")"
    if [[ "${state}" == "running" ]]; then
      echo "容器已在运行: ${PG_CONTAINER}"
    else
      echo "启动已有容器: ${PG_CONTAINER} (state=${state})"
      docker start "${PG_CONTAINER}" >/dev/null
    fi
  else
    echo "容器不存在，按参数创建（卷 ${PG_VOLUME}，端口 ${PG_PORT}）"
    docker run -d \
      --name "${PG_CONTAINER}" \
      --restart always \
      --network "${PG_NETWORK}" \
      -p "${PG_PORT}:5432" \
      -e POSTGRES_USER="${PG_USER}" \
      -e POSTGRES_PASSWORD="${PG_PASSWORD}" \
      -e POSTGRES_DB="${PG_DB}" \
      -v "${PG_VOLUME}:/var/lib/postgresql/data" \
      "${PG_IMAGE}"
  fi

  echo "等待 pg_isready ..."
  local ready=0 i
  for i in $(seq 1 30); do
    if docker exec "${PG_CONTAINER}" pg_isready -U "${PG_USER}" -d "${PG_DB}" >/dev/null 2>&1; then
      ready=1
      break
    fi
    sleep 2
  done
  if [[ "${ready}" -ne 1 ]]; then
    echo "ERROR: PostgreSQL 未在超时内就绪" >&2
    docker ps -a --filter "name=^${PG_CONTAINER}$" --format 'table {{.Names}}\t{{.Status}}\t{{.Image}}'
    docker logs --tail=40 "${PG_CONTAINER}" || true
    exit 1
  fi

  docker ps --filter "name=^${PG_CONTAINER}$" --format 'table {{.Names}}\t{{.Status}}\t{{.Image}}\t{{.Ports}}'
  docker exec "${PG_CONTAINER}" pg_isready -U "${PG_USER}" -d "${PG_DB}"
  echo "PG 已就绪: 127.0.0.1:${PG_PORT}/${PG_DB}"
}

stop_pg() {
  if [[ "${CONFIRM_STOP}" -ne 1 ]]; then
    echo "拒绝停止 PostgreSQL（${PG_CONTAINER}）。" >&2
    echo "确认后执行: $0 stop --yes" >&2
    exit 1
  fi
  echo "==> 停止 PostgreSQL  容器=${PG_CONTAINER}"
  if ! docker inspect "${PG_CONTAINER}" >/dev/null 2>&1; then
    echo "容器不存在: ${PG_CONTAINER}（无需停止）"
    return 0
  fi
  local state
  state="$(docker inspect -f '{{.State.Status}}' "${PG_CONTAINER}")"
  if [[ "${state}" != "running" ]]; then
    echo "容器未在运行: ${PG_CONTAINER} (state=${state})"
    docker ps -a --filter "name=^${PG_CONTAINER}$" --format 'table {{.Names}}\t{{.Status}}\t{{.Image}}'
    return 0
  fi
  docker stop "${PG_CONTAINER}" >/dev/null
  docker ps -a --filter "name=^${PG_CONTAINER}$" --format 'table {{.Names}}\t{{.Status}}\t{{.Image}}'
  echo "已停止。数据卷 ${PG_VOLUME} 保留；重新启动: $0 start"
}

show_status() {
  echo "==> PG / 备份状态"
  echo "--- 容器 ---"
  docker ps -a --filter "name=^${PG_CONTAINER}$" --format 'table {{.Names}}\t{{.Status}}\t{{.Image}}\t{{.Ports}}' || true
  echo
  echo "--- 监听 ${PG_PORT} ---"
  ss -lntp | grep ":${PG_PORT}" || echo "(未监听 ${PG_PORT})"
  echo
  show_shared_backup_status
  echo
  echo "--- 自动备份检查 ---"
  set +e
  remote_backup_check
  local rc=$?
  set -e
  return "${rc}"
}

case "${ACTION}" in
  start)
    start_pg
    echo
    ensure_backup_enabled
    ;;
  stop)
    stop_pg
    ;;
  status)
    show_status
    ;;
  check-backup)
    if [[ "${REPAIR_BACKUP}" -eq 1 ]]; then
      ensure_backup_enabled
    else
      remote_backup_check
    fi
    ;;
esac

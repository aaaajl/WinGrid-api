#!/usr/bin/env bash
# 启动主节点（NODE_TYPE=master + 本机 Redis）
#
# 用法：
#   ./start-master.sh local            # 连本地/公网库
#   ./start-master.sh prod             # 连生产内网库
#   ./start-master.sh local --build    # 先构建镜像再启动
#   ./start-master.sh prod --logs      # 启动后跟随日志
#   ./start-master.sh --down           # 停止并移除本 compose 服务
#   ./start-master.sh --restart        # 仅重启 new-api（不重启 Redis）
#   ./start-master.sh prod --restart   # 切换库后仅重建 new-api
#
# 前置：
#   1. cp .env.example .env 并填写 REDIS_* / SESSION_SECRET / CRYPTO_SECRET
#   2. 本地镜像时先 ./build.sh（或加 --build）
#   3. 首次 up 必须指定 local 或 prod；之后 --restart 会读上次记录

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="${SCRIPT_DIR}/docker-compose.master.yml"
ENV_FILE="${SCRIPT_DIR}/.env"
MODE_FILE="${SCRIPT_DIR}/.master-runtime-mode"
DO_BUILD=0
FOLLOW_LOGS=0
ACTION=up
ENV_MODE=""

# local / prod 数据库（启动参数覆盖 .env 中的 SQL_DSN）
SQL_DSN_LOCAL='postgresql://root:2026@Biscuits@101.132.81.209:5432/new-api'
SQL_DSN_PROD='postgresql://root:2026@Biscuits@172.16.0.246:5432/new-api'

for arg in "$@"; do
  case "${arg}" in
    local|prod) ENV_MODE="${arg}" ;;
    --build) DO_BUILD=1 ;;
    --logs) FOLLOW_LOGS=1 ;;
    --down) ACTION=down ;;
    --restart) ACTION=restart ;;
    -h|--help)
      sed -n '2,20p' "$0"
      exit 0
      ;;
    *)
      echo "未知参数: ${arg}" >&2
      echo "用法: $0 local|prod [--build] [--logs] [--down] [--restart]" >&2
      exit 1
      ;;
  esac
done

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "未找到 ${ENV_FILE}"
  echo "请先: cp ${SCRIPT_DIR}/.env.example ${ENV_FILE} 并填写配置"
  exit 1
fi

# shellcheck disable=SC1090
set -a
# shellcheck source=/dev/null
source "${ENV_FILE}"
set +a

IMAGE="${IMAGE:-wingrid-api:local}"
HOST_PORT="${HOST_PORT:-3888}"
NODE_NAME="${NODE_NAME:-new-api-master}"

require_var() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "缺少必填变量: ${name}（请写入 ${ENV_FILE}）" >&2
    exit 1
  fi
}

require_var SESSION_SECRET
require_var CRYPTO_SECRET
require_var REDIS_CONN_STRING
require_var REDIS_PASSWORD

if [[ "${SESSION_SECRET}" == "change_me_session_secret" || "${SESSION_SECRET}" == "random_string" ]]; then
  echo "请修改 SESSION_SECRET 为随机串（openssl rand -hex 32）" >&2
  exit 1
fi
if [[ "${CRYPTO_SECRET}" == "change_me_crypto_secret" ]]; then
  echo "请修改 CRYPTO_SECRET 为随机串（openssl rand -hex 32）" >&2
  exit 1
fi

resolve_sql_dsn() {
  case "${ENV_MODE}" in
    local) SQL_DSN="${SQL_DSN_LOCAL}" ;;
    prod) SQL_DSN="${SQL_DSN_PROD}" ;;
    *)
      echo "无效环境: ${ENV_MODE}（仅支持 local / prod）" >&2
      exit 1
      ;;
  esac
  export SQL_DSN
}

save_env_mode() {
  printf '%s\n' "${ENV_MODE}" > "${MODE_FILE}"
}

load_env_mode() {
  local require="${1:-1}"
  if [[ -n "${ENV_MODE}" ]]; then
    return 0
  fi
  if [[ -f "${MODE_FILE}" ]]; then
    ENV_MODE="$(tr -d '[:space:]' < "${MODE_FILE}")"
  fi
  if [[ "${ENV_MODE}" != "local" && "${ENV_MODE}" != "prod" ]]; then
    if [[ "${require}" == "1" ]]; then
      echo "未找到上次启动的环境记录，请指定 local 或 prod" >&2
      echo "用法: $0 local|prod --restart" >&2
      exit 1
    fi
    ENV_MODE=local
  fi
}

compose() {
  # 显式传入 SQL_DSN，确保覆盖 .env 里的值
  SQL_DSN="${SQL_DSN}" docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" "$@"
}

# 检查 HOST_PORT 是否被「非本 compose」的容器占用
assert_host_port_free() {
  local holders name
  holders="$(docker ps --filter "publish=${HOST_PORT}" --format '{{.Names}}' 2>/dev/null || true)"
  if [[ -z "${holders}" ]]; then
    return 0
  fi
  for name in ${holders}; do
    if [[ "${name}" == "new-api-master" ]]; then
      continue
    fi
    echo "端口 ${HOST_PORT} 已被容器「${name}」占用，无法启动 new-api-master。" >&2
    echo "请先释放端口，例如：" >&2
    echo "  docker stop ${name}" >&2
    if [[ "${name}" == "new-api" ]]; then
      echo "（该容器通常来自仓库根目录 docker-compose.yml）" >&2
      echo "  cd ${SCRIPT_DIR}/../.. && docker compose stop new-api" >&2
    fi
    exit 1
  done
}

export IMAGE HOST_PORT NODE_NAME

cd "${SCRIPT_DIR}"

case "${ACTION}" in
  down)
    echo "==> 停止主节点"
    load_env_mode 0
    resolve_sql_dsn
    compose down
    exit 0
    ;;
  restart)
    load_env_mode 1
    resolve_sql_dsn
    save_env_mode
    echo "==> 重启主节点（仅 new-api，不重启 Redis）"
    echo "    ENV=${ENV_MODE}（沿用上次启动）"
    echo "    SQL_DSN=${SQL_DSN}"
    echo "    NODE_NAME=${NODE_NAME}"
    assert_host_port_free
    # 确保 Redis 在跑，但已存在则不重建
    compose up -d redis
    # --no-deps：只更新/重启 new-api，不牵连 redis
    compose up -d --no-deps --force-recreate new-api
    exit 0
    ;;
esac

if [[ -z "${ENV_MODE}" ]]; then
  echo "请指定环境: local 或 prod" >&2
  echo "用法: $0 local|prod [--build] [--logs]" >&2
  exit 1
fi

resolve_sql_dsn

if [[ "${DO_BUILD}" -eq 1 ]]; then
  echo "==> 构建镜像"
  "${SCRIPT_DIR}/build.sh"
fi

if ! docker image inspect "${IMAGE}" >/dev/null 2>&1; then
  echo "镜像不存在: ${IMAGE}"
  echo "请先执行: ${SCRIPT_DIR}/build.sh"
  echo "或改用官方镜像: IMAGE=calciumion/new-api:latest"
  exit 1
fi

mkdir -p "${SCRIPT_DIR}/data" "${SCRIPT_DIR}/logs"

assert_host_port_free

echo "==> 启动主节点"
echo "    ENV=${ENV_MODE}"
echo "    SQL_DSN=${SQL_DSN}"
echo "    IMAGE=${IMAGE}"
echo "    NODE_TYPE=master  NODE_NAME=${NODE_NAME}"
echo "    端口 ${HOST_PORT} -> 3000"
echo "    Redis 对本机: redis:6379；从节点请设 MASTER_HOST=<本机IP> 公用此 Redis"
compose up -d
save_env_mode

echo ""
echo "==> 等待健康检查（首次启动含数据库迁移，可能需 1～2 分钟）..."
READY=0
for i in $(seq 1 90); do
  if curl -fsS --connect-timeout 2 --max-time 5 \
    "http://127.0.0.1:${HOST_PORT}/api/status" >/dev/null 2>&1; then
    echo ""
    echo "==> 主节点就绪: http://127.0.0.1:${HOST_PORT}/api/status"
    curl -sS "http://127.0.0.1:${HOST_PORT}/api/status" || true
    echo ""
    READY=1
    break
  fi
  if [[ $((i % 5)) -eq 0 ]]; then
    echo "    ...仍在等待 (${i}/90，已约 $((i * 2))s)"
  fi
  sleep 2
done
if [[ "${READY}" -ne 1 ]]; then
  echo "健康检查超时，请查看日志:" >&2
  echo "  docker compose -f docker-compose.master.yml logs --tail=100" >&2
  compose ps
  exit 1
fi

compose ps

if [[ "${FOLLOW_LOGS}" -eq 1 ]]; then
  compose logs -f --tail=100
fi

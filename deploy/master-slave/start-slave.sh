#!/usr/bin/env bash
# 启动从节点（NODE_TYPE=slave，不跑迁移/定时任务）
#
# 用法：
#   ./start-slave.sh local                         # 连本地/公网库，默认 NODE_NAME=new-api-slave-1
#   ./start-slave.sh prod new-api-slave-2          # 连生产内网库，并指定节点名
#   ./start-slave.sh local --build new-api-slave-2
#   ./start-slave.sh prod --logs
#   ./start-slave.sh --down                        # 停止
#   ./start-slave.sh --restart                     # 重启，沿用上次 local/prod
#   ./start-slave.sh prod --restart                # 重启并切换到 prod
#
# 前置：
#   1. cp .env.example .env
#   2. SESSION_SECRET / CRYPTO_SECRET 必须与主节点完全一致
#   3. 在 .env 填写 MASTER_HOST=主节点IP（公用主节点 new-api-redis:6379）
#   4. 本地镜像时先 ./build.sh（或加 --build）
#   5. 首次 up 必须指定 local 或 prod；之后 --restart 会读上次记录

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="${SCRIPT_DIR}/docker-compose.slave.yml"
ENV_FILE="${SCRIPT_DIR}/.env"
MODE_FILE="${SCRIPT_DIR}/.slave-runtime-mode"
DO_BUILD=0
FOLLOW_LOGS=0
ACTION=up
ENV_MODE=""
CLI_NODE_NAME=""

# local / prod 数据库（启动参数覆盖 .env 中的 SQL_DSN；须与主节点一致）
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
      sed -n '2,24p' "$0"
      exit 0
      ;;
    -*)
      echo "未知参数: ${arg}" >&2
      echo "用法: $0 local|prod [NODE_NAME] [--build] [--logs] [--down] [--restart]" >&2
      exit 1
      ;;
    *)
      CLI_NODE_NAME="${arg}"
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
if [[ -n "${CLI_NODE_NAME}" ]]; then
  NODE_NAME="${CLI_NODE_NAME}"
else
  NODE_NAME="${NODE_NAME:-new-api-slave-1}"
fi

require_var() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "缺少必填变量: ${name}（请写入 ${ENV_FILE}）" >&2
    exit 1
  fi
}

require_var SESSION_SECRET
require_var CRYPTO_SECRET
require_var REDIS_PASSWORD

if [[ "${SESSION_SECRET}" == "change_me_session_secret" || "${SESSION_SECRET}" == "random_string" ]]; then
  echo "请修改 SESSION_SECRET，且必须与主节点一致" >&2
  exit 1
fi
if [[ "${CRYPTO_SECRET}" == "change_me_crypto_secret" ]]; then
  echo "请修改 CRYPTO_SECRET，且必须与主节点一致" >&2
  exit 1
fi

# 从节点公用主节点 Redis（new-api-redis 暴露的 6379）
if [[ -n "${MASTER_HOST:-}" ]]; then
  REDIS_CONN_STRING="redis://:${REDIS_PASSWORD}@${MASTER_HOST}:6379"
elif [[ "${REDIS_CONN_STRING:-}" == *"@redis:"* || "${REDIS_CONN_STRING:-}" == *"@redis/"* || -z "${REDIS_CONN_STRING:-}" ]]; then
  echo "从节点必须公用主节点 Redis，请在 ${ENV_FILE} 设置 MASTER_HOST=主节点IP" >&2
  echo "例如: MASTER_HOST=192.168.1.10" >&2
  echo "将使用: redis://:REDIS_PASSWORD@MASTER_HOST:6379" >&2
  exit 1
fi
export REDIS_CONN_STRING

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
  SQL_DSN="${SQL_DSN}" REDIS_CONN_STRING="${REDIS_CONN_STRING}" \
    docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" "$@"
}

export IMAGE HOST_PORT NODE_NAME

cd "${SCRIPT_DIR}"

case "${ACTION}" in
  down)
    echo "==> 停止从节点"
    load_env_mode 0
    resolve_sql_dsn
    compose down
    exit 0
    ;;
  restart)
    load_env_mode 1
    resolve_sql_dsn
    save_env_mode
    echo "==> 重启从节点"
    echo "    ENV=${ENV_MODE}（沿用上次启动）"
    echo "    SQL_DSN=${SQL_DSN}"
    echo "    REDIS=${REDIS_CONN_STRING}"
    echo "    NODE_NAME=${NODE_NAME}"
    compose up -d
    exit 0
    ;;
esac

if [[ -z "${ENV_MODE}" ]]; then
  echo "请指定环境: local 或 prod" >&2
  echo "用法: $0 local|prod [NODE_NAME] [--build] [--logs]" >&2
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

echo "==> 启动从节点"
echo "    ENV=${ENV_MODE}"
echo "    SQL_DSN=${SQL_DSN}"
echo "    REDIS=${REDIS_CONN_STRING}  # 公用主节点 Redis"
echo "    IMAGE=${IMAGE}"
echo "    NODE_TYPE=slave  NODE_NAME=${NODE_NAME}"
echo "    端口 ${HOST_PORT} -> 3000"
compose up -d
save_env_mode

echo ""
echo "==> 等待健康检查（首次启动可能需约 1 分钟）..."
READY=0
for i in $(seq 1 90); do
  if curl -fsS --connect-timeout 2 --max-time 5 \
    "http://127.0.0.1:${HOST_PORT}/api/status" >/dev/null 2>&1; then
    echo ""
    echo "==> 从节点就绪: http://127.0.0.1:${HOST_PORT}/api/status"
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
  echo "  docker compose -f docker-compose.slave.yml logs --tail=100" >&2
  compose ps
  exit 1
fi

compose ps

if [[ "${FOLLOW_LOGS}" -eq 1 ]]; then
  compose logs -f --tail=100
fi

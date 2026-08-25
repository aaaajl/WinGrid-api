#!/usr/bin/env bash
# 构建可在生产环境直接运行的 Docker 镜像（linux/amd64）
#
# 生产环境参考（阿里云 ECS）：
#   Alibaba Cloud Linux 3 / x86_64 / Docker 26.1+ / Compose v2
#   运行镜像: wingrid-api:local → 容器 new-api-master
#
# 用法（在 Mac / 任意架构本机构建，产物可部署到上述生产机）：
#   ./buildProd.sh                    # 构建 linux/amd64，加载到本地 Docker
#   ./buildProd.sh --no-cache         # 不使用缓存重建
#   ./buildProd.sh --save             # 构建后导出 tar.gz，便于 scp 到生产机
#   IMAGE=wingrid-api:v1 ./buildProd.sh --save
#
# 生产机加载示例：
#   scp wingrid-api-local-linux-amd64.tar.gz root@prod:/tmp/
#   gunzip -c /tmp/wingrid-api-local-linux-amd64.tar.gz | docker load
#   ./start-master.sh prod --restart
#
# 也可直接在生产机（已是 amd64）上执行本脚本，效果等同本地原生构建。

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
ENV_FILE="${SCRIPT_DIR}/.env"

# 与生产 running 镜像对齐；可用 IMAGE=... 覆盖（调用方优先于 .env）
_IMAGE_OVERRIDE="${IMAGE-}"
IMAGE="${IMAGE:-wingrid-api:local}"
PLATFORM="${PLATFORM:-linux/amd64}"
BUILDER_NAME="${BUILDER_NAME:-wingrid-amd64}"
NO_CACHE=""
DO_SAVE=0
OUTPUT_DIR="${OUTPUT_DIR:-${SCRIPT_DIR}}"

for arg in "$@"; do
  case "${arg}" in
    --no-cache) NO_CACHE="--no-cache" ;;
    --save) DO_SAVE=1 ;;
    -h|--help)
      sed -n '2,22p' "$0"
      exit 0
      ;;
    *)
      echo "未知参数: ${arg}" >&2
      echo "用法: $0 [--no-cache] [--save]" >&2
      exit 1
      ;;
  esac
done

if [[ -f "${ENV_FILE}" ]]; then
  # shellcheck disable=SC1090
  set -a
  # shellcheck source=/dev/null
  source "${ENV_FILE}"
  set +a
fi
if [[ -n "${_IMAGE_OVERRIDE}" ]]; then
  IMAGE="${_IMAGE_OVERRIDE}"
fi
IMAGE="${IMAGE:-wingrid-api:local}"
unset _IMAGE_OVERRIDE

if ! command -v docker >/dev/null 2>&1; then
  echo "未找到 docker 命令" >&2
  exit 1
fi

if ! docker buildx version >/dev/null 2>&1; then
  echo "当前 Docker 不支持 buildx，请升级 Docker（生产机已是 26.1+，本地请用 Docker Desktop）" >&2
  exit 1
fi

# 确保有可用的 buildx builder（支持跨平台）
ensure_builder() {
  if docker buildx inspect "${BUILDER_NAME}" >/dev/null 2>&1; then
    docker buildx use "${BUILDER_NAME}" >/dev/null
    return 0
  fi
  echo "==> 创建 buildx builder: ${BUILDER_NAME}"
  docker buildx create --name "${BUILDER_NAME}" --driver docker-container --use >/dev/null
  docker buildx inspect --bootstrap >/dev/null
}

image_safe_name() {
  # wingrid-api:local → wingrid-api-local
  echo "${IMAGE}" | tr ':/' '--' | tr -s '-' | sed 's/-$//'
}

echo "==> 仓库根目录: ${REPO_ROOT}"
echo "==> 目标平台:   ${PLATFORM}"
echo "==> 构建镜像:   ${IMAGE}"
echo "==> Dockerfile: ${REPO_ROOT}/Dockerfile"

ensure_builder

cd "${REPO_ROOT}"

# shellcheck disable=SC2086
docker buildx build \
  --platform "${PLATFORM}" \
  ${NO_CACHE} \
  -f Dockerfile \
  -t "${IMAGE}" \
  --load \
  .

echo ""
echo "==> 构建完成: ${IMAGE} (${PLATFORM})"
docker image inspect "${IMAGE}" --format 'ID={{.Id}} Arch={{.Architecture}} OS={{.Os}} Size={{.Size}}'
# 避免 "docker images | head" 在 pipefail 下因 SIGPIPE 提前退出，导致 --save 未执行
docker images --format 'table {{.Repository}}\t{{.Tag}}\t{{.ID}}\t{{.Size}}' --filter "reference=${IMAGE}"

if [[ "${DO_SAVE}" -eq 1 ]]; then
  mkdir -p "${OUTPUT_DIR}"
  SAFE_NAME="$(image_safe_name)"
  ARCHIVE="${OUTPUT_DIR}/${SAFE_NAME}-linux-amd64.tar.gz"
  echo ""
  echo "==> 导出镜像: ${ARCHIVE}"
  docker save "${IMAGE}" | gzip > "${ARCHIVE}"
  ls -lh "${ARCHIVE}"
  echo ""
  echo "传到生产机并加载:"
  echo "  scp ${ARCHIVE} root@<prod-host>:/tmp/"
  echo "  gunzip -c /tmp/$(basename "${ARCHIVE}") | docker load"
  echo "  cd /path/to/deploy/master-slave && ./start-master.sh prod --restart"
fi

echo ""
echo "下一步（本机已是 amd64 生产机时）:"
echo "  ${SCRIPT_DIR}/start-master.sh prod --restart"
echo "或（从节点）:"
echo "  ${SCRIPT_DIR}/start-slave.sh [NODE_NAME]"

#!/usr/bin/env bash
# 构建本地 Docker 镜像（默认 tag: wingrid-api:local）
#
# 用法：
#   ./build.sh                  # 构建当前架构
#   ./build.sh --no-cache       # 不使用缓存重建
#   IMAGE=my-api:dev ./build.sh # 自定义镜像名
#
# 构建完成后，在本目录用 start-master.sh / start-slave.sh 启动。

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
ENV_FILE="${SCRIPT_DIR}/.env"

IMAGE="${IMAGE:-wingrid-api:local}"
NO_CACHE=""

for arg in "$@"; do
  case "${arg}" in
    --no-cache) NO_CACHE="--no-cache" ;;
    -h|--help)
      sed -n '2,12p' "$0"
      exit 0
      ;;
    *)
      echo "未知参数: ${arg}" >&2
      echo "用法: $0 [--no-cache]" >&2
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
  IMAGE="${IMAGE:-wingrid-api:local}"
fi

echo "==> 仓库根目录: ${REPO_ROOT}"
echo "==> 构建镜像:   ${IMAGE}"
echo "==> Dockerfile: ${REPO_ROOT}/Dockerfile"

cd "${REPO_ROOT}"
# macOS 自带 bash 3.2 + set -u 下空数组 "${arr[@]}" 会报 unbound variable
# shellcheck disable=SC2086
docker build ${NO_CACHE} \
  -f Dockerfile \
  -t "${IMAGE}" \
  .

echo ""
echo "==> 构建完成: ${IMAGE}"
# 避免 "docker images | head" 在 pipefail 下因 SIGPIPE 提前退出
docker images --format 'table {{.Repository}}\t{{.Tag}}\t{{.ID}}\t{{.Size}}' --filter "reference=${IMAGE}"
echo ""
echo "下一步:"
echo "  主节点: ${SCRIPT_DIR}/start-master.sh"
echo "  从节点: ${SCRIPT_DIR}/start-slave.sh [NODE_NAME]"

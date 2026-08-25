#!/usr/bin/env bash
# 将本地生产镜像包上传到生产机（仅上传，不 load / 不重启）
#
# 用法：
#   ./uploadProd.sh
#   ./uploadProd.sh /path/to/wingrid-api-local-linux-amd64.tar.gz
#   PROD_HOST=101.132.81.209 PROD_USER=root ./uploadProd.sh
#
# 环境变量（均可选）：
#   PROD_HOST   默认 101.132.81.209
#   PROD_USER   默认 root
#   PROD_DIR    远端目录，默认 /tmp
#   ARCHIVE     本地包路径；也可用第一个位置参数指定

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

PROD_HOST="${PROD_HOST:-101.132.81.209}"
PROD_USER="${PROD_USER:-root}"
PROD_DIR="${PROD_DIR:-/tmp}"
ARCHIVE="${ARCHIVE:-${SCRIPT_DIR}/wingrid-api-local-linux-amd64.tar.gz}"

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  sed -n '2,16p' "$0"
  exit 0
fi

if [[ $# -gt 1 ]]; then
  echo "用法: $0 [ARCHIVE]" >&2
  exit 1
fi

if [[ $# -eq 1 ]]; then
  ARCHIVE="$1"
fi

if [[ ! -f "${ARCHIVE}" ]]; then
  echo "本地镜像包不存在: ${ARCHIVE}" >&2
  echo "请先执行: ${SCRIPT_DIR}/buildProd.sh --save" >&2
  exit 1
fi

REMOTE="${PROD_USER}@${PROD_HOST}:${PROD_DIR}/"
BASENAME="$(basename "${ARCHIVE}")"

echo "==> 本地包: ${ARCHIVE}"
ls -lh "${ARCHIVE}"
echo "==> 上传到: ${REMOTE}${BASENAME}"
scp "${ARCHIVE}" "${REMOTE}"

echo ""
echo "==> 上传完成: ${PROD_USER}@${PROD_HOST}:${PROD_DIR}/${BASENAME}"

#!/bin/bash
# Linux 云服务器：安装 ML-Sharp 运行时（需已有 model_assets 权重）
# 有 NVIDIA GPU 时: MLSHARP_CUDA=1 bash scripts/install-mlsharp-linux.sh
exec bash "$(dirname "$0")/install-mlsharp-mac.sh" "$@"

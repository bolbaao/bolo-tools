#!/bin/bash
# 关闭 3000 端口上的网站服务
if command -v lsof >/dev/null 2>&1; then
  PIDS=$(lsof -ti:3000 2>/dev/null)
  if [ -n "$PIDS" ]; then
    echo "正在关闭端口 3000 上的进程: $PIDS"
    kill -9 $PIDS 2>/dev/null
    echo "✓ 已关闭"
  else
    echo "端口 3000 上没有运行中的服务"
  fi
else
  echo "请手动关闭占用 3000 端口的程序"
fi

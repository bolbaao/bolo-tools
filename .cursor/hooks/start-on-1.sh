#!/usr/bin/env bash
# 聊天窗口仅输入 1 时启动 ./start.sh（不发给 Agent）
set -euo pipefail

input=$(cat)

parsed=$(
  printf '%s' "$input" | python3 -c "
import json, shlex, sys
data = json.load(sys.stdin)
prompt = (data.get('prompt') or '').strip()
roots = data.get('workspace_roots') or []
root = roots[0] if roots else ''
print('PROMPT=' + shlex.quote(prompt))
print('ROOT=' + shlex.quote(root))
" 2>/dev/null || true
)

if [ -z "$parsed" ]; then
  echo '{"continue": true}'
  exit 0
fi

eval "$parsed"

if [ "$PROMPT" != "1" ]; then
  echo '{"continue": true}'
  exit 0
fi

if [ -z "$ROOT" ] || [ ! -x "$ROOT/start.sh" ]; then
  printf '%s\n' '{"continue": false, "user_message": "未找到可执行的 start.sh，请在项目根目录打开本窗口。"}'
  exit 0
fi

log="$ROOT/logs/start-on-1.log"
mkdir -p "$(dirname "$log")"
nohup bash -c "cd $(printf '%q' "$ROOT") && exec ./start.sh" >>"$log" 2>&1 &
disown 2>/dev/null || true

printf '%s\n' '{"continue": false, "user_message": "正在启动…\n浏览器: http://127.0.0.1:3000\n构建约需 1–2 分钟，日志: logs/start-on-1.log"}'
exit 0

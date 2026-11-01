#!/usr/bin/env bash
# Start a private, loopback-only MCP bridge after BastillaOS web starts.
set -Eeuo pipefail
cd "$(dirname "$0")/.."
mkdir -p .runtime
if ! curl -fsS --max-time 3 http://127.0.0.1:3000/api/ai/status >/dev/null; then
  echo "BastillaOS API unavailable; refusing to start MCP bridge" >&2
  exit 1
fi
if curl -sS --max-time 2 -o /dev/null http://127.0.0.1:8000/mcp/ 2>/dev/null; then
  echo "MCP HTTP listener already present; verify with smoke_test.py"
  exit 0
fi
if [[ ! -x .venv-mcp/bin/python ]]; then python3 -m venv .venv-mcp; fi
.venv-mcp/bin/python -m pip install -q -r integrations/mcp/requirements.txt
export BASTILLA_API_URL=http://127.0.0.1:3000
nohup .venv-mcp/bin/python integrations/mcp/server.py >.runtime/codespaces-mcp.log 2>&1 </dev/null &
for attempt in $(seq 1 30); do
  if .venv-mcp/bin/python integrations/mcp/smoke_test.py >.runtime/codespaces-mcp-check.log 2>&1; then
    echo "MCP local handshake OK. Port 8000 must remain private."
    exit 0
  fi
  sleep 2
done
echo "MCP did not pass local handshake; inspect .runtime/codespaces-mcp.log" >&2
exit 1

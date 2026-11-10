#!/usr/bin/env bash
# Start a real read-only metrics gateway. No fake agent, VM or Ollama data.
set -Eeuo pipefail
cd "$(dirname "$0")/.."
gateway_port="${BASTILLA_GATEWAY_PORT:-8788}"
if [[ -z "${BASTILLA_GATEWAY_TOKEN:-}" ]]; then
  echo "INFO: gateway not started: set BASTILLA_GATEWAY_TOKEN as Codespaces secret (32+ characters)."
  exit 0
fi
if (( ${#BASTILLA_GATEWAY_TOKEN} < 32 )); then
  echo "ERROR: BASTILLA_GATEWAY_TOKEN must contain at least 32 characters." >&2
  exit 1
fi
if ! [[ "$gateway_port" =~ ^[0-9]+$ ]] || (( gateway_port < 1 || gateway_port > 65535 )); then
  echo "ERROR: BASTILLA_GATEWAY_PORT invalid." >&2
  exit 1
fi
if ! curl --fail --silent --show-error --max-time 5 \
   http://127.0.0.1:3000/api/system/metrics > /dev/null; then
  echo "ERROR: BastillaOS API port 3000 unavailable. Start app first." >&2
  exit 1
fi
if curl --fail --silent --show-error --max-time 4 \
   -H "Authorization: Bearer $BASTILLA_GATEWAY_TOKEN" \
   "http://127.0.0.1:$gateway_port/system" > /dev/null 2>&1; then
  echo "PASS: live gateway already running, authenticated system metrics returned."
  exit 0
fi
# An unrelated or misconfigured process on the port must not be replaced.
if (echo >/dev/tcp/127.0.0.1/"$gateway_port") >/dev/null 2>&1; then
  echo "ERROR: gateway port $gateway_port is occupied by an unverified process." >&2
  exit 1
fi
mkdir -p .runtime
nohup node scripts/codespaces-mcp-gateway.mjs > .runtime/codespaces-mcp-gateway.log 2>&1 </dev/null &
for _ in $(seq 1 20); do
  if curl --fail --silent --show-error --max-time 3 \
    -H "Authorization: Bearer $BASTILLA_GATEWAY_TOKEN" \
    "http://127.0.0.1:$gateway_port/system" > /dev/null 2>&1; then
    echo "PASS: live gateway running on port $gateway_port (keep port 3000 and 8000 private)."
    exit 0
  fi
  sleep 1
done
echo "ERROR: gateway did not return live authenticated metrics; see .runtime/codespaces-mcp-gateway.log" >&2
exit 1

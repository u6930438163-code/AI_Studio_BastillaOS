#!/usr/bin/env bash
# Start the BastillaOS web application in Codespaces; no unattended VM provisioning.
set -Eeuo pipefail
cd "$(dirname "$0")/.."
LOG="${BASTILLA_CODESPACES_LOG:-/tmp/bastilla-codespaces.log}"
if ! command -v npm >/dev/null 2>&1; then
  echo "npm is missing; cannot start BastillaOS." >&2
  exit 1
fi
if [[ ! -d node_modules ]]; then
  npm ci
fi
# keep-alive.sh uses flock to avoid duplicate servers after Codespaces restarts.
nohup bash scripts/keep-alive.sh >>"$LOG" 2>&1 </dev/null &
echo "BastillaOS startup requested. Verify readiness using: curl -f http://127.0.0.1:3000/api/system/metrics. Log: /tmp/svl.log"
echo "To provision Debian 13 explicitly: bash scripts/auto-start-vm.sh"

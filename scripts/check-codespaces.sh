#!/usr/bin/env bash
# Read-only diagnostics for BastillaOS in Codespaces. No credentials or private keys printed.
set -uo pipefail
cd "$(dirname "$0")/.."
failures=0
check() {
  local name="$1"
  shift
  if "$@" >/dev/null 2>&1; then
    printf 'PASS %s\n' "$name"
  else
    printf 'FAIL %s\n' "$name"
    failures=$((failures + 1))
  fi
}
check 'Node.js available' command -v node
check 'Python available' command -v python3
check 'npm available' command -v npm
check 'Dependencies installed' test -d node_modules
check 'BastillaOS HTTP metrics (port 3000)' curl -fsS --max-time 5 http://127.0.0.1:3000/api/system/metrics
check 'BastillaOS AI status API (port 3000)' curl -fsS --max-time 5 http://127.0.0.1:3000/api/ai/status
if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  echo 'PASS Docker daemon accessible (optional for web app)'
else
  echo 'INFO Docker daemon unavailable (web app can still run)'
fi
if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  echo 'PASS Docker Compose accessible (optional for web app)'
else
  echo 'INFO Docker Compose unavailable (web app can still run)'
fi
if [[ -c /dev/kvm && -r /dev/kvm && -w /dev/kvm ]]; then
  echo 'INFO KVM available'
else
  echo 'INFO KVM unavailable: Debian guest requires QEMU TCG software emulation'
fi
echo "RESULT: $failures failed required web checks"
if (( failures > 0 )); then
  echo 'Review /tmp/svl.log and /tmp/bastilla-codespaces.log for startup diagnostics.'
  exit 1
fi

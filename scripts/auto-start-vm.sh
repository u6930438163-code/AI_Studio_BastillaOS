#!/usr/bin/env bash
# Automatic, idempotent VM provisioning for a Codespace/host with Docker + KVM.
set -Eeuo pipefail
cd "$(dirname "$0")/.."
LOG="${BASTILLA_VM_LOG:-/tmp/bastilla-vm-autostart.log}"
exec >>"$LOG" 2>&1
echo "[$(date -Is)] Checking VM prerequisites"
exec 9>/tmp/bastilla-vm-autostart.lock
flock -n 9 || exit 0
if [[ ! -c /dev/kvm || ! -r /dev/kvm || ! -w /dev/kvm ]]; then
  echo "SKIPPED: /dev/kvm unavailable or inaccessible; cannot enable KVM from inside a container."
  exit 0
fi
if ! command -v docker >/dev/null 2>&1 || ! docker info >/dev/null 2>&1; then
  echo "SKIPPED: Docker daemon unavailable."
  exit 0
fi
if ! docker compose version >/dev/null 2>&1; then
  echo "SKIPPED: Docker Compose v2 unavailable."
  exit 0
fi
mkdir -p bastillaos/vm-gemini-4/data
chmod 700 bastillaos/vm-gemini-4/data
export VM_UID="$(id -u)" VM_GID="$(id -g)" KVM_GID="$(stat -c %g /dev/kvm)"
echo "Starting existing VM profile (Docker will build QEMU image if needed)."
docker compose -p svl-vm-gemini-4 -f bastillaos/vm-gemini-4/compose.yaml up -d --build
docker compose -p svl-vm-gemini-4 -f bastillaos/vm-gemini-4/compose.yaml ps
echo "[$(date -Is)] VM provisioning command finished; guest boot may still be in progress."

#!/usr/bin/env bash
set -u

section() {
  printf '\n%s\n' "$1"
}

section 'BastillaOS host diagnostics (read-only)'
printf 'Time: %s\n' "$(date -u '+%Y-%m-%d %H:%M:%S UTC')"
printf 'OS: %s\n' "$(uname -s)"
printf 'Architecture: %s\n' "$(uname -m)"
printf 'Identity: %s (uid=%s, groups=%s)\n' "$(id -un)" "$(id -u)" "$(id -nG)"

section 'KVM'
if [[ ! -e /dev/kvm ]]; then
  printf 'UNAVAILABLE: /dev/kvm does not exist.\n'
elif [[ ! -c /dev/kvm ]]; then
  printf 'UNAVAILABLE: /dev/kvm is not a character device.\n'
else
  printf 'Device: %s\n' "$(stat -c '%A %U:%G (gid=%g)' /dev/kvm 2>/dev/null || printf 'metadata unavailable')"
  if [[ -r /dev/kvm && -w /dev/kvm ]]; then
    printf 'ACCESSIBLE: current user can read and write /dev/kvm.\n'
  else
    printf 'DENIED: current user cannot both read and write /dev/kvm.\n'
  fi
fi

section 'QEMU'
qemu_found=0
for tool in qemu-system-x86_64 qemu-system-aarch64 qemu-img; do
  if command -v "$tool" >/dev/null 2>&1; then
    qemu_found=1
    version="$($tool --version 2>/dev/null | sed -n '1p')"
    printf 'AVAILABLE: %s%s\n' "$tool" "${version:+ ($version)}"
  else
    printf 'MISSING: %s\n' "$tool"
  fi
done
if [[ "$qemu_found" -eq 0 ]]; then
  printf 'No QEMU executable found on PATH. The optional VM may provide QEMU in its container.\n'
fi

section 'Docker'
if command -v docker >/dev/null 2>&1; then
  printf 'CLI: %s\n' "$(docker --version 2>/dev/null || printf 'available')"
  if docker info --format '{{.ServerVersion}}' >/dev/null 2>&1; then
    printf 'DAEMON ACCESSIBLE: Docker server responds to the current user.\n'
  else
    printf 'DAEMON UNAVAILABLE: Docker is installed but the current user cannot reach its daemon.\n'
  fi
  if docker compose version >/dev/null 2>&1; then
    printf 'Compose: available\n'
  else
    printf 'Compose: unavailable\n'
  fi
else
  printf 'MISSING: Docker CLI\n'
fi
if [[ -S /var/run/docker.sock ]]; then
  printf 'Socket: %s\n' "$(stat -c '%A %U:%G (gid=%g)' /var/run/docker.sock 2>/dev/null || printf 'present; metadata unavailable')"
  if [[ -r /var/run/docker.sock && -w /var/run/docker.sock ]]; then
    printf 'Socket permissions: readable and writable by current user.\n'
  else
    printf 'Socket permissions: current user lacks read or write access.\n'
  fi
else
  printf 'Socket: /var/run/docker.sock not present (Docker may use another endpoint).\n'
fi

section 'What this means'
printf 'Web UI and deterministic local features: Node.js/npm and project dependencies; no KVM, QEMU, or Docker required.\n'
printf 'Optional VM_Gemini_4: Docker Compose required; KVM access accelerates QEMU and is required by the accelerated launcher.\n'
printf 'Debian ISO build: Linux amd64, Docker daemon access, and privileged disposable build-container support.\n'
printf 'This diagnostic does not install packages, change permissions, or start containers.\n'
#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "usage: $0 <version>" >&2
  exit 1
fi

version="$1"
attempts="${TGSM_VERIFY_ATTEMPTS:-30}"
sleep_seconds="${TGSM_VERIFY_SLEEP_SECONDS:-20}"

wait_for_npm() {
  local i
  for ((i=1; i<=attempts; i++)); do
    current="$(npm view @imadtg/tgsm version 2>/dev/null || true)"
    if [[ "$current" == "$version" ]]; then
      return 0
    fi
    sleep "$sleep_seconds"
  done
  echo "npm registry did not report @imadtg/tgsm@$version in time" >&2
  return 1
}

verify_install() {
  local manager="$1"
  local prefix="$2"

  case "$manager" in
    bun)
      BUN_INSTALL="$prefix" bun add -g @imadtg/tgsm >/dev/null
      "$prefix/bin/tgsm" --version | grep -Fx "$version" >/dev/null
      ;;
    npm)
      npm install --global --prefix "$prefix" @imadtg/tgsm >/dev/null
      "$prefix/bin/tgsm" --version | grep -Fx "$version" >/dev/null
      ;;
    pnpm)
      export PNPM_HOME="$prefix/bin"
      export XDG_DATA_HOME="$prefix/data"
      export PATH="$PNPM_HOME:$PATH"
      mkdir -p "$PNPM_HOME" "$XDG_DATA_HOME"
      pnpm add -g @imadtg/tgsm >/dev/null
      "$PNPM_HOME/tgsm" --version | grep -Fx "$version" >/dev/null
      ;;
  esac
}

wait_for_npm

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

verify_install bun "$tmp_dir/bun"
verify_install npm "$tmp_dir/npm"
verify_install pnpm "$tmp_dir/pnpm"

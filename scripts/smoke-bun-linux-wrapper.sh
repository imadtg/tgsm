#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
tmp_dir="$(mktemp -d)"
fixture_path="$tmp_dir/fixture.json"
global_home="$tmp_dir/bun-home"

cleanup() {
  rm -rf "$tmp_dir"
}

trap cleanup EXIT

cd "$repo_root"

bun run build:js >/dev/null
TGSM_PLATFORM_FILTER=tgsm-linux-x64 bun run scripts/build-platform-packages.mjs >/dev/null
cp packages/core/test/fixtures/sample-saved-messages.json "$fixture_path"
mkdir -p "$tmp_dir/packs"
npm pack ./packages/tgsm-linux-x64 --pack-destination "$tmp_dir/packs" --silent >/dev/null
npm pack ./packages/npm-wrapper --pack-destination "$tmp_dir/packs" --silent >/dev/null
pack_dir="$tmp_dir/packs"

export BUN_INSTALL="$global_home"
bun add -g \
  "$pack_dir"/imadtg-tgsm-linux-x64-*.tgz \
  "$pack_dir"/imadtg-tgsm-*.tgz >/dev/null

"$global_home/bin/tgsm" --version >/dev/null
"$global_home/bin/tgsm" --backend fixture --fixture "$fixture_path" --home "$tmp_dir/home" sync >/dev/null
"$global_home/bin/tgsm" --backend fixture --fixture "$fixture_path" --home "$tmp_dir/home" messages get 2 --dialog self >/dev/null

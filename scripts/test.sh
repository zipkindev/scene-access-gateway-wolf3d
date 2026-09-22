#!/bin/sh
set -eu

repository_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)

for source_file in "$repository_root"/runtime/js/*.js "$repository_root"/integration/*.js; do
  node --check "$source_file"
done
node --check "$repository_root/scripts/game-data.mjs"
sh -n "$repository_root"/scripts/*.sh
node -e "JSON.parse(require('node:fs').readFileSync(process.argv[1], 'utf8'))" \
  "$repository_root/manifests/supported-data.json"

if git -C "$repository_root" ls-files | grep -E '\.(WL1|WL3|WL6|SOD|SD1|SD2|SD3)$' >/dev/null; then
  echo "commercial game data is tracked" >&2
  exit 1
fi

echo "extension source and exclusion checks passed"

#!/bin/sh
set -eu

extension_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
gateway_root=${1:-"$extension_root/../scene-access-gateway"}
gateway_root=$(CDPATH= cd -- "$gateway_root" && pwd)
project="sag-extension-smoke-$$"
http_port=${SAG_COMBINED_HTTP_PORT:-18082}
editor_port=${SAG_COMBINED_EDITOR_PORT:-18083}
compose="docker compose -p $project -f $gateway_root/compose.yaml -f $extension_root/compose.extension.yaml"

cleanup() {
  SAG_WOLF3D_EXTENSION_DIR="$extension_root" \
  SAG_HTTP_PORT="$http_port" SAG_EDITOR_PORT="$editor_port" \
    $compose down -v >/dev/null 2>&1 || true
}
trap cleanup EXIT HUP INT TERM

"$gateway_root/scripts/build.sh"
"$gateway_root/scripts/bootstrap.sh"

SAG_WOLF3D_EXTENSION_DIR="$extension_root" \
SAG_HTTP_PORT="$http_port" SAG_EDITOR_PORT="$editor_port" \
SAG_PUBLIC_ORIGIN="http://localhost:$http_port" \
SAG_EDITOR_ORIGIN="http://localhost:$editor_port" \
  $compose up -d --wait

public="http://127.0.0.1:$http_port"
editor="http://127.0.0.1:$editor_port"
curl -fsS "$public/healthz" >/dev/null
curl -fsS "$public/" | grep -q '<title>ZArcade</title>'
curl -fsS "$public/future-wolf3d-crt.js" | grep -q "buildTextPlate('WOLF 3D BOOT')"
curl -fsS "$public/future-wolf3d-crt.js" | grep -q "buildTextPlate('SHUTTING DOWN')"
curl -fsS "$public/wolf3d/" | grep -q 'main.js?v=score-return-68'
test "$(curl -fsS "$public/api/arcade/scores?game=wolf3d")" = '{"board":[]}'
curl -fsS "$editor/" | grep -q '<title>Scene management</title>'

if [ -f "$extension_root/runtime/VSWAP.WL6" ]; then
  test "$(curl -fsS -o /dev/null -w '%{http_code}:%{size_download}' "$public/wolf3d/VSWAP.WL6")" = '200:1545400'
else
  test "$(curl -sS -o /dev/null -w '%{http_code}' "$public/wolf3d/VSWAP.WL6")" = 404
fi

echo "combined gateway and Wolf release-78 smoke tests passed"

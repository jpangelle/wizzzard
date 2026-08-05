#!/usr/bin/env bash
# Generates every app-style combination and compiles each one.
# This is the test that guarantees "wizard output always builds".
set -euo pipefail
cd "$(dirname "$0")/.."

run_case() {
  local label=$1 json=$2
  local tmp
  tmp=$(mktemp -d)
  echo "==> $label"
  node test/gen-fixture.ts "$json" "$tmp"
  (cd "$tmp/smoke-test" && swift build)
  rm -rf "$tmp"
}

run_case "menubar + popover" '{"appName":"Smoke Test","bundleId":"com.jpangelle.smoke-test","style":"menubar","menuBarUI":"popover","launchAtLogin":true}'
run_case "menubar + menu"    '{"appName":"Smoke Test","bundleId":"com.jpangelle.smoke-test","style":"menubar","menuBarUI":"menu","launchAtLogin":false}'
run_case "hide-on-close"     '{"appName":"Smoke Test","bundleId":"com.jpangelle.smoke-test","style":"hide-on-close","menuBarUI":null,"launchAtLogin":false}'
run_case "regular"           '{"appName":"Smoke Test","bundleId":"com.jpangelle.smoke-test","style":"regular","menuBarUI":null,"launchAtLogin":false}'

echo "==> make build (full bundle + ad-hoc sign)"
tmp=$(mktemp -d)
node test/gen-fixture.ts '{"appName":"Smoke Test","bundleId":"com.jpangelle.smoke-test","style":"menubar","menuBarUI":"popover","launchAtLogin":true}' "$tmp"
(cd "$tmp/smoke-test" && make build)
test -x "$tmp/smoke-test/dist/SmokeTest.app/Contents/MacOS/SmokeTest"
codesign --verify "$tmp/smoke-test/dist/SmokeTest.app"
rm -rf "$tmp"

echo "All smoke cases passed ✅"

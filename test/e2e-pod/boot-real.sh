#!/usr/bin/env bash
# Runs INSIDE the Daytona pod for the stable-release e2e gate.
#
# The release .deb and this harness are uploaded by the runner (AO_DEB_PATH) —
# the pod holds NO secret and fetches NO application code (CodeRabbit lesson: a
# compromised pod finds nothing to pivot to). It boots the real Electron app
# headless, drives it with Playwright (_electron.launch against the app's own
# electron), and emits a final `AO_VERDICT {json}` line the runner parses.
#
# Verdict contract (parsed by scripts/ao-e2e-pod-gate.mjs):
#   {"passed":true}               -> app smoke passed        (green)
#   {"passed":false}              -> app smoke FAILED         (red app_failed)
#   {"passed":false,"infra":true} -> setup/toolchain problem  (neutral, NOT red)
# Only the Playwright app-test run below may emit passed:false. Every step before
# it (apt, dpkg, npm) is setup — its failure emits infra:true so an apt/npm/
# registry outage never masquerades as a release-build failure.
#
# Toolchain (xvfb, tmux, @playwright/test) is installed only if ABSENT, so a
# prebuilt sandbox image with these baked in runs fully egress-free. On a stock
# image they are fetched from the OS/npm registries at boot — the one remaining
# egress. Acceptable for the STABLE gate (trusted signed build); the per-PR /
# untrusted gate MUST run on a prebuilt image so no install-time egress happens.
# TODO: bake xvfb/tmux/@playwright/test into the Daytona snapshot.
set -o pipefail
cd /home/daytona
DEB="${AO_DEB_PATH:-/home/daytona/app.deb}"

# Emit an INFRA verdict and stop. Setup/toolchain problems are NOT the release
# build's fault — the runner maps infra:true to a NEUTRAL gate result, never red.
fail_infra() {
	echo "== INFRA FAILURE ($1): $2 =="
	echo "AO_VERDICT {\"passed\":false,\"infra\":true,\"stage\":\"$1\",\"reason\":\"$2\"}"
	exit 0
}

echo "== deps: xvfb, tmux (install only if absent) =="
if ! command -v xvfb-run >/dev/null 2>&1 || ! command -v tmux >/dev/null 2>&1; then
	sudo apt-get update -qq >/dev/null 2>&1 || fail_infra "apt-update" "apt-get update failed (registry/network)"
	sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq xvfb tmux >/dev/null 2>&1 ||
		fail_infra "apt-install" "installing xvfb/tmux failed (registry/network)"
fi
command -v xvfb-run >/dev/null 2>&1 || fail_infra "xvfb-missing" "xvfb-run unavailable after install"

echo "== install release build: $DEB =="
sudo dpkg -i "$DEB" >/dev/null 2>&1
# apt-get -f resolves the .deb's runtime deps; a failure here is a registry/network
# problem, not the build's fault -> infra.
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -f -qq >/dev/null 2>&1 ||
	fail_infra "apt-deps" "resolving .deb runtime dependencies failed (registry/network)"
APP="$(command -v agent-orchestrator || echo /usr/lib/agent-orchestrator/agent-orchestrator)"
# If the binary is missing after install, we can't test the app -> treat as infra
# (a build that installs but won't launch is caught below as a real app failure).
[ -x "$APP" ] || fail_infra "app-missing" "app binary not found after install: $APP"
echo "app: $APP"

echo "== playwright lib (install only if absent; uses the app's own electron) =="
if [ ! -x node_modules/.bin/playwright ]; then
	[ -f package.json ] || npm init -y >/dev/null 2>&1
	PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm i -D @playwright/test >/dev/null 2>&1 ||
		fail_infra "npm-playwright" "installing @playwright/test failed (npm registry)"
fi
[ -x node_modules/.bin/playwright ] || fail_infra "playwright-missing" "playwright unavailable after install"

echo "== real-app e2e under xvfb =="
# From here PW is the REAL app-test result: 0 = app passed, non-zero = app failed.
# Setup is done; only the app under test decides pass/fail now.
export AO_APP_BIN="$APP"
xvfb-run -a npx playwright test -c playwright.electron.config.ts 2>&1
PW=$?

if [ "$PW" = 0 ]; then
	echo 'AO_VERDICT {"passed":true,"suite":"real-app-t0"}'
else
	echo "AO_VERDICT {\"passed\":false,\"suite\":\"real-app-t0\",\"playwright_exit\":$PW}"
fi

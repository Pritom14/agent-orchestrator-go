#!/usr/bin/env bash
# Runs INSIDE the Daytona pod for the stable-release e2e gate.
#
# The release .deb and this harness are uploaded by the runner (AO_DEB_PATH) —
# the pod holds NO secret and fetches NO application code (CodeRabbit lesson: a
# compromised pod finds nothing to pivot to). It boots the real Electron app
# headless, drives it with Playwright (_electron.launch against the app's own
# electron), and emits a final `AO_VERDICT {json}` line the runner parses.
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

echo "== deps: xvfb, tmux (install only if absent) =="
if ! command -v xvfb-run >/dev/null 2>&1 || ! command -v tmux >/dev/null 2>&1; then
	sudo apt-get update -qq >/dev/null 2>&1
	sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq xvfb tmux >/dev/null 2>&1
fi

echo "== install release build: $DEB =="
sudo dpkg -i "$DEB" >/dev/null 2>&1
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -f -qq >/dev/null 2>&1
APP="$(command -v agent-orchestrator || echo /usr/lib/agent-orchestrator/agent-orchestrator)"
echo "app: $APP"

echo "== playwright lib (install only if absent; uses the app's own electron) =="
if [ ! -x node_modules/.bin/playwright ]; then
	[ -f package.json ] || npm init -y >/dev/null 2>&1
	PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm i -D @playwright/test >/dev/null 2>&1
fi

echo "== real-app e2e under xvfb =="
export AO_APP_BIN="$APP"
xvfb-run -a npx playwright test -c playwright.electron.config.ts 2>&1
PW=$?

if [ "$PW" = 0 ]; then
	echo 'AO_VERDICT {"passed":true,"suite":"real-app-t0"}'
else
	echo "AO_VERDICT {\"passed\":false,\"suite\":\"real-app-t0\",\"playwright_exit\":$PW}"
fi

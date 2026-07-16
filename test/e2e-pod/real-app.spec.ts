import { test, expect, _electron as electron, type ElectronApplication } from "@playwright/test";

// Real-app integration smoke: launch the installed packaged app, prove the GUI
// window paints AND the bundled daemon (real Go binary + embedded SQLite) reaches
// ready. Testid-free on purpose — the published nightly predates the new
// data-testids, so these assertions exercise the real IPC/daemon path only.
const APP_BIN = process.env.AO_APP_BIN || "/usr/lib/agent-orchestrator/agent-orchestrator";

let app: ElectronApplication;

test.afterEach(async () => {
	if (app) await app.close().catch(() => {});
});

test("REAL-001 packaged app launches + window paints @T0 @real", async () => {
	app = await electron.launch({
		executablePath: APP_BIN,
		args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
		env: { ...process.env, ELECTRON_DISABLE_SANDBOX: "1" },
	});
	const win = await app.firstWindow();
	expect(win).toBeTruthy();
	// Prove the renderer actually mounted AND painted real content — not just that
	// a window object exists. Poll inside the page for: document finished loading,
	// real DOM rendered beyond the empty index.html shell, and visible text present.
	// (A bare `<div id="root">` from index.html is childElementCount>=1 before React
	// runs, so we look at visible innerText, which only appears once the app paints.)
	await expect
		.poll(
			() =>
				win.evaluate(() => document.readyState === "complete" && (document.body?.innerText?.trim().length ?? 0) > 0),
			{ timeout: 30_000, intervals: [500] },
		)
		.toBe(true);
});

test("REAL-002 bundled daemon reaches ready (real SQLite) @T0 @real", async () => {
	app = await electron.launch({
		executablePath: APP_BIN,
		args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
		env: { ...process.env, ELECTRON_DISABLE_SANDBOX: "1" },
	});
	await app.firstWindow();
	// The app spawns its own daemon on 127.0.0.1:3001; poll its real /readyz.
	const status = await expect
		.poll(
			async () => {
				try {
					const r = await fetch("http://127.0.0.1:3001/readyz");
					return r.status;
				} catch {
					return 0;
				}
			},
			{ timeout: 40_000, intervals: [1000] },
		)
		.toBe(200);
	// body proves it's the real daemon, status ready
	const body = await (await fetch("http://127.0.0.1:3001/readyz")).json();
	expect(body.status).toBe("ready");
	expect(body.service).toContain("daemon");
});

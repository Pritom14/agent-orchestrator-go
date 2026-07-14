import { expect, test } from "@playwright/test";

// TRM-001 (issue #2483). Under dev:web there is no window.ao and no PTY, so
// TerminalPane renders its deterministic browser-preview transcript (the
// data-testid="session-terminal" surface) seeded from lib/mock-data.ts. This
// proves the terminal attaches on session detail and renders a stream; the real
// zellij/PTY attach is exercised by the same testid in the real-daemon pod run.

test("TRM-001 terminal attaches on session detail and renders a stream @T0 @TRM", async ({ page }) => {
	await page.goto("/#/projects/ao-demo/sessions/demo-working");
	await expect(page.getByTestId("session-detail")).toBeVisible();

	const terminal = page.getByTestId("session-terminal");
	await expect(terminal).toBeVisible();
	// The streamed transcript for demo-working (mock-data.ts) is rendered.
	await expect(terminal).toContainText("PASS 18 tests passed");
});

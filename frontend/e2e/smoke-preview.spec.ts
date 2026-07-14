import { expect, test } from "@playwright/test";
import { installFakeAgent } from "./support/fake-bridge";

// P0 — Browser preview flow (issue #2483 P0 comment, frontend slice). `ao
// preview <url>` sets the session's preview target (streamed over CDC); the
// renderer reveals the inspector's Browser tab and drives the WebContentsView.
// Under the harness the daemon's browser IPC is faked (fake-bridge.ts), so we
// drive open / clear / error through the fake-agent controller and assert the
// renderer's Browser surface. The daemon-side `ao preview` argument validation
// (e.g. a missing local target) is covered by the pod CLI/daemon leg.

const openBrowserTab = async (page: import("@playwright/test").Page) => {
	await expect(page.getByTestId("session-detail")).toBeVisible();
	await page.getByRole("tab", { name: "Browser" }).click();
	await expect(page.getByTestId("browser-panel")).toBeVisible();
};

test.skip("P0 preview tab opens on the ao preview target @P0 @PREVIEW", async ({ page }) => {
	await installFakeAgent(page, {
		workers: [{ id: "prev", title: "Preview worker", previewUrl: "http://localhost:5173", previewRevision: 1 }],
	});
	await page.goto("/#/projects/fake-proj/sessions/prev");
	await openBrowserTab(page);

	// The Browser tab navigated to the preview target (no empty-state overlay).
	await expect(page.getByLabel("Browser URL")).toHaveValue("http://localhost:5173");
	await expect(page.getByText("Enter a dev-server URL to preview it here.")).toHaveCount(0);
});

test.skip("P0 preview can be cleared @P0 @PREVIEW", async ({ page }) => {
	await installFakeAgent(page, {
		workers: [{ id: "prev", title: "Preview worker", previewUrl: "http://localhost:5173", previewRevision: 1 }],
	});
	await page.goto("/#/projects/fake-proj/sessions/prev");
	await openBrowserTab(page);
	await expect(page.getByLabel("Browser URL")).toHaveValue("http://localhost:5173");

	// `ao preview clear` empties the target (revision bumped) → the Browser tab
	// returns to its empty prompt.
	await page.evaluate(() => window.__aoFakeAgent!.setPreview("prev", "", 2));
	await expect(page.getByText("Enter a dev-server URL to preview it here.")).toBeVisible();
	await expect(page.getByLabel("Browser URL")).toHaveValue("");
});

test.skip("P0 missing preview target surfaces an actionable error @P0 @PREVIEW", async ({ page }) => {
	await installFakeAgent(page, { workers: [{ id: "prev", title: "Preview worker" }] });
	await page.goto("/#/projects/fake-proj/sessions/prev");
	await openBrowserTab(page);

	// The daemon rejects a preview it cannot resolve; the renderer surfaces the
	// error in the panel rather than a blank/broken pane.
	await page.evaluate(() => {
		window.__aoFakeAgent!.setBrowserError("No preview target found. Pass a URL or start a dev server.");
		window.__aoFakeAgent!.setPreview("prev", "http://localhost:9999", 1);
	});
	await expect(page.getByTestId("browser-preview-error")).toContainText("No preview target found");
});

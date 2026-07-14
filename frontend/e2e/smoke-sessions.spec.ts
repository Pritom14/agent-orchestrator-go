import { expect, test } from "@playwright/test";
import { installFakeAgent } from "./support/fake-bridge";

// SES-* FAKE smoke suite (issue #2483). No real daemon/agent under the browser
// harness, so installFakeAgent injects a ready daemon + a fake CDC SSE stream +
// a mutable workspace snapshot (see e2e/support/fake-bridge.ts). Specs drive the
// fake-agent timeline through `window.__aoFakeAgent` and assert the renderer
// repaints through its real SSE → invalidate → refetch path. The Go fake-agent
// plugin drives the same states in the later real-daemon pod run.

const card = (id: string) => `[data-testid="board-session-card"][data-session-id="${id}"]`;
const columnCard = (column: string, id: string) =>
	`[data-testid="board-column"][data-column="${column}"] [data-session-id="${id}"]`;

test.skip("SES-001 create task/session from the board @T0 @SES", async ({ page }) => {
	// Pre-seed the session the daemon would create so navigation to its detail
	// resolves; the POST is what this case verifies (create requested → succeeded).
	await installFakeAgent(page, { workers: [{ id: "fake-new-task", title: "Add dark mode toggle" }] });

	let createBody: Record<string, unknown> | null = null;
	await page.route("**/api/v1/sessions", async (route) => {
		if (route.request().method() !== "POST") return route.fallback();
		createBody = route.request().postDataJSON();
		await route.fulfill({ json: { session: { id: "fake-new-task" } } });
	});

	await page.goto("/#/projects/fake-proj");
	await expect(page.getByTestId("board")).toBeVisible();

	await page.getByRole("button", { name: "New task" }).first().click();
	await expect(page.getByRole("dialog")).toBeVisible();
	await page.getByLabel("Title").fill("Add dark mode toggle");
	await page.getByLabel("Brief").fill("Wire a theme switch into the settings page.");
	await page.getByRole("button", { name: "Start task" }).click();

	// create requested/succeeded: the POST carried the worker task, the dialog
	// closed, and the app followed the new session to its detail screen.
	await expect(page).toHaveURL(/sessions\/fake-new-task/);
	await expect(page.getByTestId("session-detail")).toBeVisible();
	expect(createBody).toMatchObject({ projectId: "fake-proj", kind: "worker", issueId: "Add dark mode toggle" });
});

test("SES-002 new session card appears in the spawning/working state @T0 @SES", async ({ page }) => {
	// Renderer note: there is no distinct "spawning" badge — a freshly spawned
	// session enters the Working column (badge "Working"); the daemon's
	// spawning→working transition lands here. The card must not exist until the
	// fake agent creates it.
	await installFakeAgent(page);
	await page.goto("/#/");
	await expect(page.getByTestId("board")).toBeVisible();
	await expect(page.locator(card("fake-spawn"))).toHaveCount(0);

	await page.evaluate(() =>
		window.__aoFakeAgent!.createWorker({ id: "fake-spawn", title: "Spawning worker", activity: "exited" }),
	);

	await expect(page.locator(columnCard("working", "fake-spawn"))).toBeVisible();
	await expect(page.locator(card("fake-spawn"))).toContainText("Working");
});

test.skip("SES-003 fake-agent activity keeps the card in working/active @T0 @SES", async ({ page }) => {
	// The agent goes active: the card sits in the Working column with the Working
	// badge, and (on detail) the topbar activity pill reads Working.
	await installFakeAgent(page, { workers: [{ id: "fake-active", title: "Refactor auth", activity: "exited" }] });
	await page.goto("/#/");
	await expect(page.locator(columnCard("working", "fake-active"))).toBeVisible();

	await page.evaluate(() => window.__aoFakeAgent!.setStatus("fake-active", "working", "active"));
	await expect(page.locator(columnCard("working", "fake-active"))).toContainText("Working");

	await page.goto("/#/projects/fake-proj/sessions/fake-active");
	await expect(page.getByTestId("session-detail")).toBeVisible();
	await expect(page.getByText("Working", { exact: true }).first()).toBeVisible();
});

test.skip("SES-008 kill session drops it to a terminal state @T0 @SES", async ({ page }) => {
	// manually_killed is a daemon reason (not renderer-visible); at the renderer
	// the killed worker leaves the active columns and lands in the Done /
	// Terminated bar. We POST-route the kill and flip the snapshot terminated to
	// stand in for the daemon marking it killed.
	await installFakeAgent(page, { workers: [{ id: "fake-kill", title: "Doomed worker", activity: "active" }] });
	await page.route("**/api/v1/sessions/*/kill", (route) => route.fulfill({ json: { ok: true } }));

	await page.goto("/#/projects/fake-proj/sessions/fake-kill");
	await expect(page.getByTestId("session-detail")).toBeVisible();

	await page.getByRole("button", { name: "Kill session" }).click();
	await page.getByRole("button", { name: "Confirm kill" }).click();
	// The daemon would mark it terminated; simulate that so the board reflects it.
	await page.evaluate(() => window.__aoFakeAgent!.setStatus("fake-kill", "terminated", "exited"));

	// Kill navigates away from the killed session (to the orchestrator, since this
	// project has one). Land on the board to inspect the terminal placement.
	await expect(page).not.toHaveURL(/sessions\/fake-kill/);
	await page.goto("/#/projects/fake-proj");
	await expect(page.getByTestId("board")).toBeVisible();
	await expect(page.locator(columnCard("working", "fake-kill"))).toHaveCount(0);
	// The Done / Terminated bar surfaces the killed worker.
	const doneBar = page.getByRole("button", { name: /Done \/ Terminated/i });
	await expect(doneBar).toBeVisible();
	await doneBar.click();
	await expect(page.getByText("Doomed worker")).toBeVisible();
});

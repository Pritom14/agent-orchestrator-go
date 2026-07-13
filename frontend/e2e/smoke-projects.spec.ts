import { expect, test } from "@playwright/test";
import { installFakeAgent } from "./support/fake-bridge";

// PRJ-* smoke suite (issue #2483). PRJ-001/PRJ-005 are POD (renderer + mock
// fixtures); PRJ-002 is FAKE (needs the daemon spawn side-effect, simulated via
// installFakeAgent + routed daemon endpoints).

test("PRJ-001 add-project flow opens for a git repo path @T0 @PRJ", async ({ page }) => {
	// Renderer slice: the add-project entry (import-type picker → folder step) is
	// fully renderer-driven. Actually registering a bundled sample repo path runs
	// through the OS file picker + daemon POST /projects — that is the pod's job.
	await page.goto("/#/");
	await expect(page.getByText("Projects")).toBeVisible();

	await page.getByRole("button", { name: "New project" }).click();
	await expect(page.getByRole("dialog")).toContainText("Import to Agent Orchestrator");

	await page.getByRole("button", { name: "Project", exact: true }).click();
	// The folder step for a single git repository is reached.
	await expect(page.getByRole("button", { name: "Choose a project folder" })).toBeVisible();
});

test("PRJ-002 adding a project auto-spawns the orchestrator @T0 @PRJ", async ({ page }) => {
	// The add flow ends in POST /orchestrators (source=project_add, a telemetry
	// attribute). We route the daemon endpoints and assert the auto-spawn fired.
	await installFakeAgent(page, { workers: [] });

	let orchestratorSpawned = false;
	await page.route("**/api/v1/projects", async (route) => {
		if (route.request().method() !== "POST") return route.fallback();
		await route.fulfill({
			json: { project: { id: "added-proj", name: "added-proj", kind: "single_repo", path: "/repos/added-proj" } },
		});
	});
	await page.route("**/api/v1/orchestrators", async (route) => {
		if (route.request().method() !== "POST") return route.fallback();
		orchestratorSpawned = true;
		await route.fulfill({ json: { orchestrator: { id: "added-proj-orchestrator" } } });
	});
	// A ready agent catalog so the agent-sheet selects have selectable options.
	const catalog = {
		supported: [{ id: "codex", label: "codex" }],
		installed: [{ id: "codex", label: "codex", authStatus: "authorized" }],
		authorized: [{ id: "codex", label: "codex" }],
	};
	await page.route(/\/api\/v1\/agents(\/refresh)?(\?|$)/, (route) => route.fulfill({ json: catalog }));
	// The bridge's chooseDirectory returns null by default; expose a picked path.
	await page.addInitScript(() => {
		const withPath = () => {
			const ao = (window as unknown as { ao?: { app?: { chooseDirectory: unknown } } }).ao;
			if (ao?.app) ao.app.chooseDirectory = async () => "/repos/added-proj";
		};
		withPath();
		setTimeout(withPath, 0);
	});

	await page.goto("/#/");
	await page.getByRole("button", { name: "New project" }).click();
	await page.getByRole("button", { name: "Project", exact: true }).click();
	await page.getByRole("button", { name: "Choose a project folder" }).click();

	// Agent sheet: pick worker + orchestrator agents (fallback catalog is always
	// selectable), then create.
	await expect(page.getByRole("dialog")).toContainText("Project agents");
	const workerSelect = page.getByLabel("Worker agent");
	await expect(workerSelect).toBeEnabled();
	await workerSelect.click();
	await page.getByRole("option", { name: "codex" }).click();
	await page.getByLabel("Orchestrator agent").click();
	await page.getByRole("option", { name: "codex" }).click();
	await page.getByRole("button", { name: /Create and start/ }).click();

	await expect.poll(() => orchestratorSpawned).toBe(true);
});

test("PRJ-005 added project appears in the sidebar and board @T0 @PRJ", async ({ page }) => {
	// dev:web serves lib/mock-data.ts (ao-demo, docs-site). A registered project
	// must show as a sidebar row AND drive the board it opens.
	await page.goto("/#/");
	await expect(page.getByText("Projects")).toBeVisible();

	// Sidebar row for the project.
	await expect(page.getByRole("button", { name: "Open ao-demo dashboard" })).toBeVisible();

	// Opening it renders that project's board with its session cards.
	await page.getByRole("button", { name: "Open ao-demo dashboard" }).click();
	await expect(page).toHaveURL(/projects\/ao-demo/);
	await expect(page.getByTestId("board")).toBeVisible();
	await expect(page.getByTestId("board-session-card").first()).toBeVisible();
});

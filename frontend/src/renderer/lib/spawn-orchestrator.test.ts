import { describe, expect, it, vi, beforeEach } from "vitest";
import { spawnOrchestrator } from "./spawn-orchestrator";
import { apiClient } from "./api-client";
import { captureRendererEvent } from "./telemetry";

vi.mock("./api-client", () => ({
	apiClient: { POST: vi.fn() },
}));

vi.mock("./telemetry", () => ({
	captureRendererEvent: vi.fn().mockResolvedValue(undefined),
}));

const captureMock = vi.mocked(captureRendererEvent);

describe("spawnOrchestrator", () => {
	beforeEach(() => vi.clearAllMocks());

	it("sends clean:true through to the request body when asked", async () => {
		(apiClient.POST as ReturnType<typeof vi.fn>).mockResolvedValue({
			data: { orchestrator: { id: "proj-9" } },
			error: undefined,
			response: { status: 201 },
		});
		const id = await spawnOrchestrator("proj", "restore_dialog", true);
		expect(id).toBe("proj-9");
		expect(apiClient.POST).toHaveBeenCalledWith("/api/v1/orchestrators", {
			body: { projectId: "proj", clean: true },
		});
	});

	it("defaults clean to false / omitted for the existing call sites", async () => {
		(apiClient.POST as ReturnType<typeof vi.fn>).mockResolvedValue({
			data: { orchestrator: { id: "proj-1" } },
			error: undefined,
			response: { status: 201 },
		});
		await spawnOrchestrator("proj", "board");
		expect(apiClient.POST).toHaveBeenCalledWith("/api/v1/orchestrators", {
			body: { projectId: "proj", clean: false },
		});
	});

	it("emits the requested + succeeded triad keyed by source", async () => {
		(apiClient.POST as ReturnType<typeof vi.fn>).mockResolvedValue({
			data: { orchestrator: { id: "proj-7" } },
			error: undefined,
			response: { status: 201 },
		});
		await spawnOrchestrator("proj", "sidebar");
		expect(captureMock).toHaveBeenCalledWith("ao.renderer.orchestrator_spawn_requested", {
			project_id: "proj",
			source: "sidebar",
		});
		expect(captureMock).toHaveBeenCalledWith("ao.renderer.orchestrator_spawn_succeeded", {
			project_id: "proj",
			source: "sidebar",
		});
	});

	it("emits the failed event and rethrows when the daemon rejects the spawn", async () => {
		(apiClient.POST as ReturnType<typeof vi.fn>).mockResolvedValue({
			data: undefined,
			error: { message: "boom" },
			response: { status: 500 },
		});
		await expect(spawnOrchestrator("proj", "topbar")).rejects.toThrow("boom");
		expect(captureMock).toHaveBeenCalledWith("ao.renderer.orchestrator_spawn_failed", {
			project_id: "proj",
			source: "topbar",
		});
		expect(captureMock).not.toHaveBeenCalledWith("ao.renderer.orchestrator_spawn_succeeded", expect.anything());
	});
});

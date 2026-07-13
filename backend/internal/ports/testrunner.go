package ports

import (
	"context"

	"github.com/aoagents/agent-orchestrator/backend/internal/domain"
)

// TestRunner runs a project's tests for a pull request in an isolated sandbox
// and reports a pass/fail verdict. The adapter owns the full sandbox lifecycle
// (provision, clone the branch, run tests, tear down); AO only supplies the PR
// coordinates and awaits the verdict. A run is synchronous from the adapter's
// point of view — the caller runs it off the lifecycle poll path.
type TestRunner interface {
	Run(ctx context.Context, req TestRunRequest) (TestRunResult, error)
}

// TestRunRequest is one sandbox test run over a PR head commit. All coordinates
// the sandbox needs to fetch and test the code are passed explicitly; the
// adapter clones the branch itself rather than reading a local checkout.
type TestRunRequest struct {
	// Repo is the clone coordinate, "owner/repo" for GitHub.
	Repo string
	// Branch is the PR head branch the sandbox checks out.
	Branch string
	// HeadSHA is the PR head commit under test (anchors verdict dedup).
	HeadSHA string
	// BaseSHA is the PR base commit, used for diff-aware test selection.
	BaseSHA string
	// Snapshot is the provider snapshot/image the sandbox boots from.
	Snapshot string
	// APIKeyEnvVar names the environment variable holding the provider API key.
	// Only the variable name travels through AO; the adapter reads the secret
	// value from its own environment at run time so the key never enters a DTO.
	APIKeyEnvVar string
}

// TestRunResult is the verdict of one sandbox test run.
type TestRunResult struct {
	// Passed is the overall verdict.
	Passed bool
	// Summary is a one-line result surfaced to the agent regardless of outcome.
	Summary string
	// Detail is the failing test/output tail, relayed to the agent on failure.
	// Empty on success.
	Detail string
}

// TestRunnerResolver maps a configured test provider onto its adapter. ok=false
// means no adapter is registered for that provider.
type TestRunnerResolver interface {
	TestRunner(provider domain.TestProvider) (TestRunner, bool)
}

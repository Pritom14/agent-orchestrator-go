package lifecycle

import (
	"context"
	"log/slog"
	"sync"

	"github.com/aoagents/agent-orchestrator/backend/internal/domain"
	"github.com/aoagents/agent-orchestrator/backend/internal/ports"
)

// projectConfigReader reads the per-project record the test gate needs to decide
// whether (and how) to run. Narrow on purpose: the gate only reads config. The
// signature matches the sqlite store's GetProject so it wires in directly.
type projectConfigReader interface {
	GetProject(ctx context.Context, id string) (domain.ProjectRecord, bool, error)
}

// relayFunc delivers a verdict message into the worker session, deduped on
// (key,sig). It is Manager.sendOnce bound at construction, so the verdict rides
// the exact same restart-safe path as CI-failure and review nudges.
type relayFunc func(ctx context.Context, id domain.SessionID, prURL, key, sig, msg string) error

// testGate runs the post-approval sandbox test gate off the lifecycle poll path.
//
// Consider() is called synchronously from the reducer when a PR is approved and
// otherwise mergeable; it is non-blocking. The actual sandbox run (minutes) runs
// in a goroutine under a daemon-lifetime context so it never stalls the 30s
// observer poll. Each (PR, head SHA) runs at most once; a new head SHA (the
// agent pushed a fix) triggers a fresh run. The verdict — pass or fail — is
// relayed to the worker via sendOnce so it dedups and survives restart.
type testGate struct {
	resolver ports.TestRunnerResolver
	projects projectConfigReader
	relay    relayFunc
	baseCtx  context.Context
	log      *slog.Logger

	mu   sync.Mutex
	runs map[string]bool // key: prURL@headSHA — set once a run is in flight/done
	wg   sync.WaitGroup  // tracks in-flight runs (graceful shutdown / test sync)
}

func newTestGate(ctx context.Context, resolver ports.TestRunnerResolver, projects projectConfigReader, relay relayFunc) *testGate {
	return &testGate{
		resolver: resolver,
		projects: projects,
		relay:    relay,
		baseCtx:  ctx,
		log:      slog.Default(),
		runs:     map[string]bool{},
	}
}

// Consider launches a sandbox test run for an approved PR if the project enables
// the gate and no run has started for this exact head commit. Non-blocking.
func (g *testGate) Consider(ctx context.Context, rec domain.SessionRecord, o ports.SCMObservation) {
	if rec.IsTerminated || rec.Activity.State == domain.ActivityWaitingInput {
		return
	}
	proj, ok, err := g.projects.GetProject(ctx, string(rec.ProjectID))
	if err != nil {
		g.log.Warn("testgate: read project failed", "project", rec.ProjectID, "err", err)
		return
	}
	if !ok {
		return
	}
	cfg := proj.Config.Test
	if !cfg.Enabled {
		return
	}
	runner, ok := g.resolver.TestRunner(cfg.Provider)
	if !ok {
		g.log.Warn("testgate: no adapter for provider", "provider", cfg.Provider)
		return
	}

	prURL := firstSCMNonEmpty(o.PR.URL, o.PR.HTMLURL)
	headSHA := firstSCMNonEmpty(o.CI.HeadSHA, o.PR.HeadSHA)
	if prURL == "" || headSHA == "" || o.Repo == "" || o.PR.SourceBranch == "" {
		return
	}

	key := prURL + "@" + headSHA
	g.mu.Lock()
	if g.runs[key] {
		g.mu.Unlock()
		return
	}
	g.runs[key] = true
	g.mu.Unlock()

	req := ports.TestRunRequest{
		Repo:         o.Repo,
		Branch:       o.PR.SourceBranch,
		HeadSHA:      headSHA,
		BaseSHA:      firstSCMNonEmpty(o.PR.BaseSHA, o.PR.TargetBranch),
		Snapshot:     cfg.Snapshot,
		APIKeyEnvVar: cfg.APIKeyEnvVar,
	}

	g.wg.Add(1)
	go g.execute(rec.ID, key, prURL, headSHA, runner, req)
}

func (g *testGate) execute(id domain.SessionID, key, prURL, headSHA string, runner ports.TestRunner, req ports.TestRunRequest) {
	defer g.wg.Done()

	res, err := runner.Run(g.baseCtx, req)
	if err != nil {
		// Adapter/provisioning failure is not a test verdict. Clear the run marker
		// so a later poll retries this head SHA rather than silently never testing.
		g.log.Warn("testgate: run failed", "session", id, "pr", prURL, "err", err)
		g.mu.Lock()
		delete(g.runs, key)
		g.mu.Unlock()
		return
	}

	relayKey := "smoke:" + prURL
	verdict := "fail"
	if res.Passed {
		verdict = "pass"
	}
	sig := headSHA + ":" + verdict
	msg := g.verdictMessage(prURL, res)
	if err := g.relay(g.baseCtx, id, prURL, relayKey, sig, msg); err != nil {
		g.log.Warn("testgate: relay failed", "session", id, "pr", prURL, "err", err)
	}
}

func (g *testGate) verdictMessage(prURL string, res ports.TestRunResult) string {
	safeURL := domain.SanitizeControlChars(prURL)
	safeSummary := domain.SanitizeControlChars(res.Summary)
	if res.Passed {
		msg := "[AO test gate] Sandbox tests passed for " + safeURL + "."
		if safeSummary != "" {
			msg += "\n" + safeSummary
		}
		return msg
	}
	msg := "[AO test gate] Sandbox tests FAILED for " + safeURL + ". Fix the failure below and push."
	if safeSummary != "" {
		msg += "\n" + safeSummary
	}
	if res.Detail != "" {
		msg += "\n\nFailing output:\n" + domain.SanitizeControlChars(res.Detail)
	}
	return msg
}

// wait blocks until in-flight runs finish. Used by tests; also usable for
// graceful daemon shutdown.
func (g *testGate) wait() { g.wg.Wait() }

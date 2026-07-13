package lifecycle

import (
	"context"
	"errors"
	"strings"
	"sync"
	"testing"

	"github.com/aoagents/agent-orchestrator/backend/internal/domain"
	"github.com/aoagents/agent-orchestrator/backend/internal/ports"
)

// --- fakes ---

type fakeRunner struct {
	mu    sync.Mutex
	calls int
	reqs  []ports.TestRunRequest
	res   ports.TestRunResult
	err   error
}

func (f *fakeRunner) Run(_ context.Context, req ports.TestRunRequest) (ports.TestRunResult, error) {
	f.mu.Lock()
	f.calls++
	f.reqs = append(f.reqs, req)
	f.mu.Unlock()
	return f.res, f.err
}

func (f *fakeRunner) count() int { f.mu.Lock(); defer f.mu.Unlock(); return f.calls }

type fakeResolver struct {
	runner ports.TestRunner // nil => not resolvable
}

func (r fakeResolver) TestRunner(domain.TestProvider) (ports.TestRunner, bool) {
	if r.runner == nil {
		return nil, false
	}
	return r.runner, true
}

type fakeProjects struct {
	cfg domain.TestConfig
}

func (p fakeProjects) GetProject(_ context.Context, id string) (domain.ProjectRecord, bool, error) {
	return domain.ProjectRecord{ID: id, Config: domain.ProjectConfig{Test: p.cfg}}, true, nil
}

type relayCall struct{ prURL, key, sig, msg string }

func newRelayCapture() (relayFunc, *[]relayCall, *sync.Mutex) {
	var mu sync.Mutex
	var calls []relayCall
	f := func(_ context.Context, _ domain.SessionID, prURL, key, sig, msg string) error {
		mu.Lock()
		defer mu.Unlock()
		calls = append(calls, relayCall{prURL, key, sig, msg})
		return nil
	}
	return f, &calls, &mu
}

func approvedObs() ports.SCMObservation {
	o := ports.SCMObservation{Fetched: true, Repo: "o/r"}
	o.PR.URL = "https://github.com/o/r/pull/1"
	o.PR.SourceBranch = "feat/x"
	o.PR.HeadSHA = "sha1"
	o.PR.BaseSHA = "base1"
	return o
}

func liveRec() domain.SessionRecord {
	return domain.SessionRecord{ID: "s1", ProjectID: "p1", Activity: domain.Activity{State: domain.ActivityIdle}}
}

// --- tests ---

func TestGate_RunsAndRelaysPass(t *testing.T) {
	runner := &fakeRunner{res: ports.TestRunResult{Passed: true, Summary: "3 passed"}}
	relay, calls, mu := newRelayCapture()
	g := newTestGate(context.Background(), fakeResolver{runner}, fakeProjects{domain.TestConfig{
		Enabled: true, Provider: domain.TestProviderDaytona, Snapshot: "snap", APIKeyEnvVar: "K",
	}}, relay)

	g.Consider(context.Background(), liveRec(), approvedObs())
	g.wait()

	if runner.count() != 1 {
		t.Fatalf("runner called %d times, want 1", runner.count())
	}
	if got := runner.reqs[0]; got.Repo != "o/r" || got.Branch != "feat/x" || got.HeadSHA != "sha1" || got.Snapshot != "snap" || got.APIKeyEnvVar != "K" {
		t.Fatalf("request wrong: %+v", got)
	}
	mu.Lock()
	defer mu.Unlock()
	if len(*calls) != 1 {
		t.Fatalf("relay called %d times, want 1", len(*calls))
	}
	c := (*calls)[0]
	if c.key != "smoke:https://github.com/o/r/pull/1" || c.sig != "sha1:pass" {
		t.Fatalf("relay key/sig wrong: %+v", c)
	}
}

func TestGate_RelaysFailWithDetail(t *testing.T) {
	runner := &fakeRunner{res: ports.TestRunResult{Passed: false, Summary: "1 failed", Detail: "assert boom"}}
	relay, calls, mu := newRelayCapture()
	g := newTestGate(context.Background(), fakeResolver{runner}, fakeProjects{domain.TestConfig{
		Enabled: true, Provider: domain.TestProviderDaytona, APIKeyEnvVar: "K",
	}}, relay)

	g.Consider(context.Background(), liveRec(), approvedObs())
	g.wait()

	mu.Lock()
	defer mu.Unlock()
	if len(*calls) != 1 || (*calls)[0].sig != "sha1:fail" {
		t.Fatalf("relay = %+v", *calls)
	}
	if !strings.Contains((*calls)[0].msg, "assert boom") || !strings.Contains((*calls)[0].msg, "FAILED") {
		t.Fatalf("fail message missing detail: %q", (*calls)[0].msg)
	}
}

func TestGate_DisabledDoesNothing(t *testing.T) {
	runner := &fakeRunner{}
	relay, calls, mu := newRelayCapture()
	g := newTestGate(context.Background(), fakeResolver{runner}, fakeProjects{domain.TestConfig{Enabled: false}}, relay)

	g.Consider(context.Background(), liveRec(), approvedObs())
	g.wait()

	if runner.count() != 0 {
		t.Fatalf("runner ran while disabled")
	}
	mu.Lock()
	defer mu.Unlock()
	if len(*calls) != 0 {
		t.Fatalf("relay fired while disabled")
	}
}

func TestGate_DedupsSameHeadSHA(t *testing.T) {
	runner := &fakeRunner{res: ports.TestRunResult{Passed: true}}
	relay, _, _ := newRelayCapture()
	g := newTestGate(context.Background(), fakeResolver{runner}, fakeProjects{domain.TestConfig{
		Enabled: true, Provider: domain.TestProviderDaytona, APIKeyEnvVar: "K",
	}}, relay)

	o := approvedObs()
	g.Consider(context.Background(), liveRec(), o)
	g.wait()
	g.Consider(context.Background(), liveRec(), o) // same head SHA — must not re-run
	g.wait()

	if runner.count() != 1 {
		t.Fatalf("runner ran %d times for same head SHA, want 1", runner.count())
	}
}

func TestGate_NewHeadSHATriggersFreshRun(t *testing.T) {
	runner := &fakeRunner{res: ports.TestRunResult{Passed: true}}
	relay, _, _ := newRelayCapture()
	g := newTestGate(context.Background(), fakeResolver{runner}, fakeProjects{domain.TestConfig{
		Enabled: true, Provider: domain.TestProviderDaytona, APIKeyEnvVar: "K",
	}}, relay)

	o1 := approvedObs()
	g.Consider(context.Background(), liveRec(), o1)
	g.wait()
	o2 := approvedObs()
	o2.PR.HeadSHA = "sha2" // agent pushed a fix
	g.Consider(context.Background(), liveRec(), o2)
	g.wait()

	if runner.count() != 2 {
		t.Fatalf("runner ran %d times across two head SHAs, want 2", runner.count())
	}
}

func TestGate_AdapterErrorAllowsRetry(t *testing.T) {
	runner := &fakeRunner{err: errors.New("provision failed")}
	relay, calls, mu := newRelayCapture()
	g := newTestGate(context.Background(), fakeResolver{runner}, fakeProjects{domain.TestConfig{
		Enabled: true, Provider: domain.TestProviderDaytona, APIKeyEnvVar: "K",
	}}, relay)

	o := approvedObs()
	g.Consider(context.Background(), liveRec(), o)
	g.wait()
	// After an adapter error the run marker is cleared, so the next poll retries.
	g.Consider(context.Background(), liveRec(), o)
	g.wait()

	if runner.count() != 2 {
		t.Fatalf("runner ran %d times, want 2 (retry after error)", runner.count())
	}
	mu.Lock()
	defer mu.Unlock()
	if len(*calls) != 0 {
		t.Fatalf("adapter error must not relay a verdict, got %+v", *calls)
	}
}

func TestGate_SkipsTerminatedOrWaiting(t *testing.T) {
	runner := &fakeRunner{}
	relay, _, _ := newRelayCapture()
	g := newTestGate(context.Background(), fakeResolver{runner}, fakeProjects{domain.TestConfig{
		Enabled: true, Provider: domain.TestProviderDaytona, APIKeyEnvVar: "K",
	}}, relay)

	term := liveRec()
	term.IsTerminated = true
	g.Consider(context.Background(), term, approvedObs())

	waiting := liveRec()
	waiting.Activity.State = domain.ActivityWaitingInput
	g.Consider(context.Background(), waiting, approvedObs())
	g.wait()

	if runner.count() != 0 {
		t.Fatalf("runner ran for terminated/waiting session")
	}
}

func TestGate_NoAdapterForProvider(t *testing.T) {
	relay, _, _ := newRelayCapture()
	g := newTestGate(context.Background(), fakeResolver{nil}, fakeProjects{domain.TestConfig{
		Enabled: true, Provider: domain.TestProviderDaytona, APIKeyEnvVar: "K",
	}}, relay)
	// No panic, no run — just a logged skip.
	g.Consider(context.Background(), liveRec(), approvedObs())
	g.wait()
}

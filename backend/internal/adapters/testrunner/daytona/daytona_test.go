package daytona

import (
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/aoagents/agent-orchestrator/backend/internal/domain"
	"github.com/aoagents/agent-orchestrator/backend/internal/ports"
)

func TestProviderID(t *testing.T) {
	if got := New().Provider(); got != domain.TestProviderDaytona {
		t.Fatalf("Provider() = %q, want %q", got, domain.TestProviderDaytona)
	}
}

func newTestAdapter(run runFunc) *Adapter {
	return &Adapter{scriptPath: "/opt/driver.mjs", nodeBin: "node", run: run}
}

func TestRun_ParsesPassVerdict(t *testing.T) {
	t.Setenv("DAYTONA_KEY", "secret")
	var gotArgs, gotEnv []string
	a := newTestAdapter(func(_ context.Context, name string, args, env []string) ([]byte, error) {
		if name != "node" {
			t.Fatalf("exec name = %q, want node", name)
		}
		gotArgs, gotEnv = args, env
		return []byte("cloning...\nSMOKE PASSED\nAO_VERDICT {\"passed\":true,\"summary\":\"3 tests passed\"}\n"), nil
	})
	res, err := a.Run(context.Background(), ports.TestRunRequest{
		Repo: "o/r", Branch: "feat/x", HeadSHA: "abc", BaseSHA: "def", Snapshot: "snap", APIKeyEnvVar: "DAYTONA_KEY",
	})
	if err != nil {
		t.Fatalf("Run err: %v", err)
	}
	if !res.Passed || res.Summary != "3 tests passed" {
		t.Fatalf("verdict = %+v", res)
	}
	if gotArgs[0] != "/opt/driver.mjs" || gotArgs[1] != "o/r" || gotArgs[2] != "feat/x" {
		t.Fatalf("argv = %v", gotArgs)
	}
	// Secret and PR coordinates travel via env, not argv.
	env := strings.Join(gotEnv, "\n")
	for _, want := range []string{"DAYTONA_API_KEY=secret", "DAYTONA_SNAPSHOT=snap", "AO_HEAD_SHA=abc", "AO_BASE_SHA=def"} {
		if !strings.Contains(env, want) {
			t.Fatalf("env missing %q", want)
		}
	}
}

func TestRun_FailVerdictDespiteNonZeroExit(t *testing.T) {
	t.Setenv("DAYTONA_KEY", "secret")
	// Driver exits non-zero on test failure but still emits a verdict; that is a
	// valid "tests failed" result, not an adapter error.
	a := newTestAdapter(func(_ context.Context, _ string, _, _ []string) ([]byte, error) {
		return []byte("AO_VERDICT {\"passed\":false,\"summary\":\"1 failed\",\"detail\":\"assert x\"}\n"), errors.New("exit status 1")
	})
	res, err := a.Run(context.Background(), ports.TestRunRequest{Repo: "o/r", Branch: "b", APIKeyEnvVar: "DAYTONA_KEY"})
	if err != nil {
		t.Fatalf("unexpected err: %v", err)
	}
	if res.Passed || res.Detail != "assert x" {
		t.Fatalf("verdict = %+v", res)
	}
}

func TestRun_ErrorWithNoVerdict(t *testing.T) {
	t.Setenv("DAYTONA_KEY", "secret")
	a := newTestAdapter(func(_ context.Context, _ string, _, _ []string) ([]byte, error) {
		return []byte("boom\n"), errors.New("exit status 1")
	})
	if _, err := a.Run(context.Background(), ports.TestRunRequest{Repo: "o/r", Branch: "b", APIKeyEnvVar: "DAYTONA_KEY"}); err == nil {
		t.Fatal("expected error when run fails and no verdict emitted")
	}
}

func TestRun_MissingAPIKey(t *testing.T) {
	a := newTestAdapter(func(_ context.Context, _ string, _, _ []string) ([]byte, error) {
		t.Fatal("run should not be invoked without an API key")
		return nil, nil
	})
	if _, err := a.Run(context.Background(), ports.TestRunRequest{Repo: "o/r", Branch: "b", APIKeyEnvVar: "MISSING_VAR"}); err == nil {
		t.Fatal("expected error for empty API key")
	}
}

func TestRun_MissingScriptPath(t *testing.T) {
	a := &Adapter{nodeBin: "node", run: func(context.Context, string, []string, []string) ([]byte, error) { return nil, nil }}
	if _, err := a.Run(context.Background(), ports.TestRunRequest{Repo: "o/r", Branch: "b", APIKeyEnvVar: "K"}); err == nil {
		t.Fatal("expected error when script path is unset")
	}
}

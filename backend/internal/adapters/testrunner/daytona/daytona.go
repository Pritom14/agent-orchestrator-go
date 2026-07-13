// Package daytona is the Daytona-backed TestRunner adapter. It runs a PR's
// tests inside a disposable Daytona sandbox and reports a pass/fail verdict.
//
// v1 delegates the sandbox lifecycle to the proven Node driver (daytona-run.mjs
// + run-e2e.sh): the adapter execs `node <script> <repo> <branch>` with the
// provider key and PR coordinates in the environment, and parses the driver's
// final "AO_VERDICT {json}" line. The driver create→clone→test→teardown flow was
// validated live against real Daytona; keeping it behind this port means a
// native-REST adapter can replace it later without touching the lifecycle gate.
package daytona

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"regexp"
	"strings"

	"github.com/aoagents/agent-orchestrator/backend/internal/domain"
	"github.com/aoagents/agent-orchestrator/backend/internal/ports"
)

// Env vars that point the adapter at the bundled Node driver. They are daemon
// (install) level, not per-project, and have sane defaults.
const (
	envScriptPath = "AO_DAYTONA_SCRIPT_PATH"
	envNodeBin    = "AO_NODE_BIN"
)

// verdictLine matches the driver's machine-readable final line, e.g.
// `AO_VERDICT {"passed":true,"summary":"...","detail":"..."}`.
var verdictLine = regexp.MustCompile(`(?m)^AO_VERDICT (\{.*\})\s*$`)

// runFunc executes a command and returns its combined output. Injectable so
// tests exercise Run without spawning Node or touching the network.
type runFunc func(ctx context.Context, name string, args, env []string) ([]byte, error)

// Adapter is the Daytona TestRunner. Construct with New for the registry, or a
// struct literal (with run injected) in tests.
type Adapter struct {
	scriptPath string
	nodeBin    string
	run        runFunc
}

// New builds the shipped Daytona adapter. Script path and node binary are read
// from the environment with defaults; the provider API key is resolved per run
// from the env var named in the request (never stored here).
func New() *Adapter {
	node := os.Getenv(envNodeBin)
	if node == "" {
		node = "node"
	}
	return &Adapter{
		scriptPath: os.Getenv(envScriptPath),
		nodeBin:    node,
		run:        execCommand,
	}
}

func execCommand(ctx context.Context, name string, args, env []string) ([]byte, error) {
	cmd := exec.CommandContext(ctx, name, args...)
	cmd.Env = env
	return cmd.CombinedOutput()
}

// Provider identifies this adapter in the registry.
func (a *Adapter) Provider() domain.TestProvider { return domain.TestProviderDaytona }

// Run executes the driver over the PR branch and returns its verdict.
func (a *Adapter) Run(ctx context.Context, req ports.TestRunRequest) (ports.TestRunResult, error) {
	if a.scriptPath == "" {
		return ports.TestRunResult{}, fmt.Errorf("daytona: driver script path not set (%s)", envScriptPath)
	}
	if req.Repo == "" || req.Branch == "" {
		return ports.TestRunResult{}, fmt.Errorf("daytona: repo and branch are required")
	}
	apiKey := ""
	if req.APIKeyEnvVar != "" {
		apiKey = os.Getenv(req.APIKeyEnvVar)
	}
	if apiKey == "" {
		return ports.TestRunResult{}, fmt.Errorf("daytona: API key env var %q is empty", req.APIKeyEnvVar)
	}

	env := append(os.Environ(),
		"DAYTONA_API_KEY="+apiKey,
		"DAYTONA_SNAPSHOT="+req.Snapshot,
		"AO_BASE_SHA="+req.BaseSHA,
		"AO_HEAD_SHA="+req.HeadSHA,
	)
	out, err := a.run(ctx, a.nodeBin, []string{a.scriptPath, req.Repo, req.Branch}, env)
	// The driver exits non-zero on test failure, which surfaces here as an
	// ExitError. That is a valid verdict (tests failed), not an adapter error, so
	// prefer a parsed verdict over the exec error and only fail hard when no
	// verdict was emitted.
	res, parseErr := parseVerdict(out)
	if parseErr != nil {
		if err != nil {
			return ports.TestRunResult{}, fmt.Errorf("daytona: run failed and no verdict emitted: %w (output tail: %s)", err, tail(out, 500))
		}
		return ports.TestRunResult{}, parseErr
	}
	return res, nil
}

type driverVerdict struct {
	Passed  bool   `json:"passed"`
	Summary string `json:"summary"`
	Detail  string `json:"detail"`
}

func parseVerdict(out []byte) (ports.TestRunResult, error) {
	m := verdictLine.FindSubmatch(out)
	if m == nil {
		return ports.TestRunResult{}, fmt.Errorf("daytona: no AO_VERDICT line in driver output")
	}
	var v driverVerdict
	if err := json.Unmarshal(m[1], &v); err != nil {
		return ports.TestRunResult{}, fmt.Errorf("daytona: bad verdict json: %w", err)
	}
	return ports.TestRunResult{Passed: v.Passed, Summary: v.Summary, Detail: v.Detail}, nil
}

func tail(b []byte, n int) string {
	s := strings.TrimSpace(string(b))
	if len(s) <= n {
		return s
	}
	return s[len(s)-n:]
}

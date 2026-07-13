// Package testrunner is the single source of truth for the sandbox test-runner
// adapters the daemon ships. It mirrors the reviewer registry: adding a provider
// here (and to domain.AllTestProviders) registers it, without widening any other
// provider vocabulary.
package testrunner

import (
	"fmt"

	"github.com/aoagents/agent-orchestrator/backend/internal/adapters/testrunner/daytona"
	"github.com/aoagents/agent-orchestrator/backend/internal/domain"
	"github.com/aoagents/agent-orchestrator/backend/internal/ports"
)

// Adapter is a registered test runner: a ports.TestRunner that names its provider.
type Adapter interface {
	ports.TestRunner
	Provider() domain.TestProvider
}

// Constructors returns every test-runner adapter the daemon ships. Add a
// provider here (and to domain.AllTestProviders) to register it.
func Constructors() []Adapter {
	return []Adapter{
		daytona.New(),
	}
}

// Resolver maps a test provider onto its adapter.
type Resolver struct {
	runners map[domain.TestProvider]ports.TestRunner
}

var _ ports.TestRunnerResolver = (*Resolver)(nil)

// NewResolver builds a Resolver from the shipped adapters. It fails if two
// adapters claim the same provider, or if a registered provider is not in the
// domain test-provider vocabulary (the two must stay in sync).
func NewResolver() (*Resolver, error) {
	m := make(map[domain.TestProvider]ports.TestRunner)
	for _, a := range Constructors() {
		p := a.Provider()
		if !p.IsKnown() {
			return nil, fmt.Errorf("test-runner adapter %q is not in domain.AllTestProviders", p)
		}
		if _, dup := m[p]; dup {
			return nil, fmt.Errorf("test provider %q is registered twice", p)
		}
		m[p] = a
	}
	return &Resolver{runners: m}, nil
}

// TestRunner returns the adapter for a provider, ok=false when none is registered.
func (r *Resolver) TestRunner(provider domain.TestProvider) (ports.TestRunner, bool) {
	rn, ok := r.runners[provider]
	return rn, ok
}

package testrunner

import (
	"testing"

	"github.com/aoagents/agent-orchestrator/backend/internal/domain"
)

func TestNewResolver_RegistersDaytona(t *testing.T) {
	r, err := NewResolver()
	if err != nil {
		t.Fatalf("NewResolver: %v", err)
	}
	if _, ok := r.TestRunner(domain.TestProviderDaytona); !ok {
		t.Fatal("daytona provider not resolvable")
	}
	if _, ok := r.TestRunner(domain.TestProvider("nope")); ok {
		t.Fatal("unknown provider should not resolve")
	}
}

func TestConstructors_AllProvidersKnown(t *testing.T) {
	for _, a := range Constructors() {
		if !a.Provider().IsKnown() {
			t.Fatalf("adapter provider %q missing from domain.AllTestProviders", a.Provider())
		}
	}
}

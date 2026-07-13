package domain

// TestProvider identifies a sandbox test-runner backend. It is its own
// vocabulary (like ReviewerHarness) so the set of supported test backends is
// validated independently of agents, reviewers, and SCM providers.
type TestProvider string

// Supported test providers. Add a backend here (and register its adapter in the
// testrunner registry) to widen the set.
const (
	TestProviderDaytona TestProvider = "daytona"
)

// AllTestProviders is the canonical set used to validate a configured provider.
var AllTestProviders = []TestProvider{
	TestProviderDaytona,
}

// IsKnown reports whether p is one of the supported test providers.
func (p TestProvider) IsKnown() bool {
	for _, k := range AllTestProviders {
		if p == k {
			return true
		}
	}
	return false
}

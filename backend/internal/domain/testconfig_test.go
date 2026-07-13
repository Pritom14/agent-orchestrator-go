package domain

import "testing"

func TestTestProviderIsKnown(t *testing.T) {
	if !TestProviderDaytona.IsKnown() {
		t.Fatal("daytona should be known")
	}
	if TestProvider("nope").IsKnown() {
		t.Fatal("unknown provider reported known")
	}
}

func TestTestConfigValidate(t *testing.T) {
	cases := []struct {
		name    string
		cfg     TestConfig
		wantErr bool
	}{
		{"disabled is always valid", TestConfig{Enabled: false, Provider: "bogus"}, false},
		{"enabled ok", TestConfig{Enabled: true, Provider: TestProviderDaytona, APIKeyEnvVar: "DAYTONA_API_KEY"}, false},
		{"enabled unknown provider", TestConfig{Enabled: true, Provider: "bogus", APIKeyEnvVar: "K"}, true},
		{"enabled missing api key var", TestConfig{Enabled: true, Provider: TestProviderDaytona}, true},
		{"enabled whitespace api key var", TestConfig{Enabled: true, Provider: TestProviderDaytona, APIKeyEnvVar: " K "}, true},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			err := tc.cfg.Validate()
			if (err != nil) != tc.wantErr {
				t.Fatalf("Validate() err=%v, wantErr=%v", err, tc.wantErr)
			}
		})
	}
}

// The gate config must round-trip through the ProjectConfig validator too.
func TestProjectConfigValidatesTestBlock(t *testing.T) {
	bad := ProjectConfig{Test: TestConfig{Enabled: true, Provider: "bogus", APIKeyEnvVar: "K"}}
	if err := bad.Validate(); err == nil {
		t.Fatal("expected ProjectConfig.Validate to reject a bad test block")
	}
	good := ProjectConfig{Test: TestConfig{Enabled: true, Provider: TestProviderDaytona, APIKeyEnvVar: "DAYTONA_API_KEY"}}
	if err := good.Validate(); err != nil {
		t.Fatalf("valid test block rejected: %v", err)
	}
}

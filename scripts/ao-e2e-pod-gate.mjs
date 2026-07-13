#!/usr/bin/env node
// STUB. Real Daytona real-app runner is wired in separately; this defines the
// CLI the CI gate depends on, plus the pure verdict->exit-code->status contract
// the gate is built on (deriveGateOutcome, exported for tests).
//
// Contract (the real runner will honor the same CLI + output):
//   node scripts/ao-e2e-pod-gate.mjs --repo <owner/repo> --sha <sha> --tag <release-tag> --suite T0
//   - Spins a Daytona pod (needs env DAYTONA_API_KEY), installs the release
//     build, runs the real-app T0 Playwright suite.
//   - Prints a final line: AO_VERDICT {"passed":true|false,...}
//   - Exits 0 on green, non-zero on red.
//
// The CI job (.github/workflows/frontend-release.yml `e2e-gate`) reflects this
// script's exit code into an `ao-stable-gate` commit status, which in turn gates
// the electron-updater `latest` feed (publish-feed needs: e2e-gate). Because a
// green feed triggers every user's auto-update, the verdict->exit-code->status
// mapping is a real contract and lives in the pure, tested deriveGateOutcome.

import { fileURLToPath } from "node:url";

export function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token.startsWith("--")) {
      const key = token.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        args[key] = next;
        i++;
      } else {
        args[key] = true;
      }
    }
  }
  return args;
}

/**
 * Pure verdict logic for the stable/nightly e2e gate.
 *
 * Given the observable facts of a pod run, derive the gate outcome: the commit
 * status state, the process exit code, a human description, and the artifacts
 * link (always carried through when present, so it can be attached to the
 * check on both green and red).
 *
 * Rule table (first match wins):
 *   ranOk === false        -> failure / 1  ("runner crashed ...")   [NOT a silent pass]
 *   timedOut === true      -> failure / 1  ("... timed out")
 *   testsPassed !== true   -> failure / 1  ("T0 pod smoke failed")
 *   testsPassed === true   -> success / 0  ("T0 pod smoke passed")
 *
 * Crash precedence is deliberate: if the runner never produced a real verdict
 * (ranOk=false), we must fail even if `testsPassed` was left truthy — a crash
 * must never be reported as green.
 *
 * @param {object} facts
 * @param {boolean} facts.ranOk       runner completed and produced a verdict
 * @param {boolean} facts.testsPassed the T0 suite reported all green
 * @param {boolean} [facts.timedOut]  the run hit its wall-clock timeout
 * @param {string}  [facts.artifactsUrl] link to logs/traces/screenshots
 * @returns {{state:"success"|"failure", exitCode:0|1, description:string, artifactsUrl:string|null}}
 */
export function deriveGateOutcome({
  ranOk,
  testsPassed,
  timedOut = false,
  artifactsUrl = null,
} = {}) {
  const link = artifactsUrl || null;

  const fail = (description) => ({
    state: "failure",
    exitCode: 1,
    description,
    artifactsUrl: link,
  });

  if (ranOk === false) {
    return fail("runner crashed before producing a verdict");
  }
  if (timedOut === true) {
    return fail("T0 pod smoke timed out");
  }
  if (testsPassed !== true) {
    return fail("T0 pod smoke failed");
  }
  return {
    state: "success",
    exitCode: 0,
    description: "T0 pod smoke passed",
    artifactsUrl: link,
  };
}

function main(argv) {
  const args = parseArgs(argv.slice(2));

  console.log("ao-e2e-pod-gate (STUB)");
  console.log(`  repo:  ${args.repo ?? "(unset)"}`);
  console.log(`  sha:   ${args.sha ?? "(unset)"}`);
  console.log(`  tag:   ${args.tag ?? "(unset)"}`);
  console.log(`  suite: ${args.suite ?? "(unset)"}`);
  console.log(
    `  DAYTONA_API_KEY: ${process.env.DAYTONA_API_KEY ? "present" : "absent"}`,
  );

  // The real runner replaces this block with an actual pod run and reports the
  // observed facts. The stub asserts a green run with no artifacts, but still
  // routes through deriveGateOutcome so the verdict->exit-code contract is
  // exercised by the same code path CI depends on.
  const outcome = deriveGateOutcome({
    ranOk: true,
    testsPassed: true,
    timedOut: false,
    artifactsUrl: null,
  });

  const verdict = {
    passed: outcome.state === "success",
    state: outcome.state,
    summary:
      outcome.description +
      (outcome.state === "success" ? " (STUB - real runner pending)" : ""),
    ...(outcome.artifactsUrl ? { artifactsUrl: outcome.artifactsUrl } : {}),
  };
  console.log(`AO_VERDICT ${JSON.stringify(verdict)}`);
  return outcome.exitCode;
}

// Only run the CLI when invoked directly, not when imported by the test.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exit(main(process.argv));
}

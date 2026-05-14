"use client";

import { SessionCard } from "@/components/SessionCard";
import type { DashboardSession, DashboardPR } from "@/lib/types";

/**
 * Mock session states for display testing.
 * All 7 SessionCard variants for screenshot capture.
 */
function createMockSessions(): Array<{ title: string; session: DashboardSession }> {
  const now = new Date().toISOString();

  const basePR: DashboardPR = {
    number: 42,
    url: "https://github.com/test/repo/pull/42",
    title: "Add feature",
    owner: "test",
    repo: "repo",
    branch: "feat/test",
    baseBranch: "main",
    isDraft: false,
    state: "open",
    additions: 123,
    deletions: 45,
    ciStatus: "passing",
    ciChecks: [
      { name: "lint", status: "passed", url: "https://github.com/test" },
      { name: "test", status: "passed", url: "https://github.com/test" },
    ],
    reviewDecision: "approved",
    mergeability: {
      mergeable: true,
      ciPassing: true,
      approved: true,
      noConflicts: true,
      blockers: [],
    },
    unresolvedThreads: 0,
    unresolvedComments: [],
    enriched: true,
  };

  const failingPR: DashboardPR = {
    ...basePR,
    ciStatus: "failing",
    ciChecks: [
      { name: "lint", status: "passed" },
      { name: "test", status: "failed", url: "https://github.com/test" },
    ],
    mergeability: {
      ...basePR.mergeability,
      ciPassing: false,
      mergeable: false,
      blockers: ["CI failing"],
    },
  };

  const sessions: Array<{ title: string; session: DashboardSession }> = [
    // 1. Standard Idle Card
    {
      title: "1. Standard Idle Card - Waiting for review",
      session: {
        id: "demo-idle-01",
        projectId: "test",
        status: "review_pending",
        activity: null,
        branch: "feat/idle-card",
        issueId: null,
        issueUrl: "https://github.com/test/repo/issues/1",
        issueLabel: "ISSUE-1",
        issueTitle: "Implement user authentication",
        userPrompt: null,
        summary: "Adding user authentication system",
        summaryIsFallback: false,
        createdAt: now,
        lastActivityAt: now,
        pr: {
          ...basePR,
          number: 100,
          state: "open",
          reviewDecision: "pending",
          ciStatus: "passing",
          mergeability: {
            ...basePR.mergeability,
            approved: false,
            mergeable: false,
            blockers: ["Awaiting review"],
          },
        },
        metadata: {},
        displayName: null,
        displayNameUserSet: false,
      },
    },

    // 2. Merge-Ready Card
    {
      title: "2. Merge-Ready Card - PR approved, ready to merge",
      session: {
        id: "demo-merge-01",
        projectId: "test",
        status: "approved",
        activity: null,
        branch: "feat/merge-ready",
        issueId: null,
        issueUrl: "https://github.com/test/repo/issues/2",
        issueLabel: "ISSUE-2",
        issueTitle: "Fix authentication bug",
        userPrompt: null,
        summary: "Bug fix for auth token refresh",
        summaryIsFallback: false,
        createdAt: now,
        lastActivityAt: now,
        pr: {
          ...basePR,
          number: 101,
          state: "open",
          reviewDecision: "approved",
          ciStatus: "passing",
          mergeability: {
            ...basePR.mergeability,
            approved: true,
            mergeable: true,
            ciPassing: true,
          },
        },
        metadata: {},
        displayName: null,
        displayNameUserSet: false,
      },
    },

    // 3. Quick-Reply Active
    {
      title: "3. Quick-Reply Active - Agent waiting for input",
      session: {
        id: "demo-respond-01",
        projectId: "test",
        status: "pr_open",
        activity: "waiting_input",
        branch: "feat/quick-reply",
        issueId: null,
        issueUrl: "https://github.com/test/repo/issues/3",
        issueLabel: "ISSUE-3",
        issueTitle: "Add API endpoint validation",
        userPrompt: null,
        summary: "Waiting for confirmation on validation approach",
        summaryIsFallback: false,
        createdAt: now,
        lastActivityAt: now,
        pr: {
          ...basePR,
          number: 102,
          state: "open",
          reviewDecision: "pending",
          mergeability: {
            ...basePR.mergeability,
            mergeable: false,
            blockers: ["Waiting for input"],
          },
        },
        metadata: {},
        displayName: null,
        displayNameUserSet: false,
      },
    },

    // 4. Done/Merged
    {
      title: "4. Done/Merged - Terminal state, successfully merged",
      session: {
        id: "demo-merged-01",
        projectId: "test",
        status: "merged",
        activity: "exited",
        branch: "feat/merged-card",
        issueId: null,
        issueUrl: "https://github.com/test/repo/issues/4",
        issueLabel: "ISSUE-4",
        issueTitle: "Refactor database models",
        userPrompt: null,
        summary: "Database model refactoring completed",
        summaryIsFallback: false,
        createdAt: now,
        lastActivityAt: now,
        pr: {
          ...basePR,
          number: 103,
          state: "merged",
          reviewDecision: "approved",
        },
        metadata: {},
        displayName: null,
        displayNameUserSet: false,
      },
    },

    // 5. Done/Killed
    {
      title: "5. Done/Killed - Terminal state, killed by user",
      session: {
        id: "demo-killed-01",
        projectId: "test",
        status: "cleanup",
        activity: "exited",
        branch: "feat/killed-card",
        issueId: null,
        issueUrl: "https://github.com/test/repo/issues/5",
        issueLabel: "ISSUE-5",
        issueTitle: "Experimental feature branch",
        userPrompt: null,
        summary: "Session terminated by user",
        summaryIsFallback: false,
        createdAt: now,
        lastActivityAt: now,
        pr: {
          ...basePR,
          number: 104,
          state: "closed",
        },
        metadata: {},
        displayName: null,
        displayNameUserSet: false,
      },
    },

    // 6. Alert/CI Failure
    {
      title: "6. Alert/CI Failure - CI checks failing",
      session: {
        id: "demo-ci-fail-01",
        projectId: "test",
        status: "ci_failed",
        activity: "active",
        branch: "feat/ci-failure",
        issueId: null,
        issueUrl: "https://github.com/test/repo/issues/6",
        issueLabel: "ISSUE-6",
        issueTitle: "Add performance optimizations",
        userPrompt: null,
        summary: "Performance improvements with CI failures",
        summaryIsFallback: false,
        createdAt: now,
        lastActivityAt: now,
        pr: {
          ...failingPR,
          number: 105,
          state: "open",
          reviewDecision: "pending",
        },
        metadata: {},
        displayName: null,
        displayNameUserSet: false,
      },
    },

    // 7. Working/Active
    {
      title: "7. Working/Active - Agent actively working",
      session: {
        id: "demo-working-01",
        projectId: "test",
        status: "working",
        activity: "active",
        branch: "feat/working-card",
        issueId: null,
        issueUrl: "https://github.com/test/repo/issues/7",
        issueLabel: "ISSUE-7",
        issueTitle: "Implement new search feature",
        userPrompt: null,
        summary: "Building new search with filters",
        summaryIsFallback: false,
        createdAt: now,
        lastActivityAt: now,
        pr: {
          ...basePR,
          number: 106,
          state: "open",
          reviewDecision: "pending",
          mergeability: {
            ...basePR.mergeability,
            approved: false,
            mergeable: false,
            blockers: ["Under development"],
          },
        },
        metadata: {},
        displayName: null,
        displayNameUserSet: false,
      },
    },
  ];

  return sessions;
}

/**
 * SessionCard States Demo Page
 *
 * Displays all 7 SessionCard variants for screenshot capture and testing.
 * Access at: http://localhost:3000/test-direct/cards
 */
export default function SessionCardsDemoPage() {
  const sessions = createMockSessions();

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)]">
      {/* Header */}
      <div className="border-b border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] p-6">
        <div className="mx-auto max-w-7xl">
          <h1 className="text-3xl font-bold text-[var(--color-text-primary)]">
            SessionCard States Demo
          </h1>
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">
            All 7 SessionCard variants for screenshot capture. Each card demonstrates a different
            state in the session lifecycle.
          </p>
          <div className="mt-4 space-y-1 text-xs text-[var(--color-text-secondary)]">
            <p>
              Access directly at: <code className="font-mono">http://localhost:3000/test-direct/cards</code>
            </p>
            <p>
              For terminal test: <code className="font-mono">http://localhost:3000/test-direct</code>
            </p>
          </div>
        </div>
      </div>

      {/* Cards Grid */}
      <div className="p-6">
        <div className="mx-auto max-w-7xl space-y-8">
          {sessions.map(({ title, session }) => (
            <div key={session.id}>
              {/* Card title/label */}
              <div className="mb-3">
                <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
                  {title}
                </h2>
                <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                  Status: <code className="font-mono">{session.status}</code>
                  {session.activity && (
                    <>
                      {" "}
                      | Activity: <code className="font-mono">{session.activity}</code>
                    </>
                  )}
                </p>
              </div>

              {/* SessionCard component */}
              <div className="rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] p-4">
                <SessionCard
                  session={session}
                  onSend={(sessionId, message) => {
                    console.log(`[${sessionId}] Sent:`, message);
                  }}
                  onKill={(sessionId) => {
                    console.log(`[${sessionId}] Killed`);
                  }}
                  onMerge={(prNumber) => {
                    console.log(`[PR #${prNumber}] Merged`);
                  }}
                  onRestore={(sessionId) => {
                    console.log(`[${sessionId}] Restored`);
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer with summary */}
      <div className="border-t border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] p-6">
        <div className="mx-auto max-w-7xl">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
            Card States Summary
          </h3>
          <ul className="mt-3 space-y-2 text-xs text-[var(--color-text-secondary)]">
            <li>
              <code className="font-mono">1. Standard Idle</code> - Normal pending state, waiting for
              review
            </li>
            <li>
              <code className="font-mono">2. Merge-Ready</code> - PR approved and ready to merge (green
              accent)
            </li>
            <li>
              <code className="font-mono">3. Quick-Reply Active</code> - Agent waiting for human input
              (orange accent)
            </li>
            <li>
              <code className="font-mono">4. Done/Merged</code> - Terminal state, successfully merged
              (compact done card)
            </li>
            <li>
              <code className="font-mono">5. Done/Killed</code> - Terminal state, killed by user
              (compact done card)
            </li>
            <li>
              <code className="font-mono">6. Alert/CI Failure</code> - CI checks failing (alert badge)
            </li>
            <li>
              <code className="font-mono">7. Working/Active</code> - Agent actively working (blue
              accent)
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useCallback, useMemo, type ReactNode } from "react";
import { useParams, usePathname } from "next/navigation";
import { isOrchestratorSession } from "@aoagents/ao-core/types";
import { useSessionEvents } from "@/hooks/useSessionEvents";
import { useMuxOptional } from "@/providers/MuxProvider";
import { ProjectSidebar } from "@/components/ProjectSidebar";
import { SidebarContext } from "@/components/workspace/SidebarContext";
import { useMediaQuery, MOBILE_BREAKPOINT } from "@/hooks/useMediaQuery";
import type { DashboardSession } from "@/lib/types";
import type { ProjectInfo } from "@/lib/project-name";

function extractActiveSessionId(pathname: string | null): string | undefined {
  if (!pathname) return undefined;
  const match = pathname.match(/\/sessions\/([^/]+)/);
  return match?.[1] ?? undefined;
}

interface ProjectLayoutClientProps {
  children: ReactNode;
  initialSessions: DashboardSession[];
  initialProjects: ProjectInfo[];
}

export function ProjectLayoutClient({
  children,
  initialSessions,
  initialProjects,
}: ProjectLayoutClientProps) {
  const params = useParams();
  const pathname = usePathname();
  const projectId = typeof params.projectId === "string" ? params.projectId : undefined;
  const activeSessionId = extractActiveSessionId(pathname);
  const isMobile = useMediaQuery(MOBILE_BREAKPOINT);

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const mux = useMuxOptional();
  const { sessions, liveSessionsResolved } = useSessionEvents({
    initialSessions,
    muxSessions: mux?.status === "connected" ? mux.sessions : undefined,
    muxLastError: mux?.lastError,
    attentionZones: "simple",
  });

  const allSessionPrefixes = useMemo(
    () => initialProjects.map((p) => p.sessionPrefix ?? p.id),
    [initialProjects],
  );

  const sidebarOrchestrators = useMemo(
    () =>
      (sessions ?? [])
        .filter((s) =>
          isOrchestratorSession(
            s,
            initialProjects.find((p) => p.id === s.projectId)?.sessionPrefix ?? s.projectId,
            allSessionPrefixes,
          ),
        )
        .map((s) => ({ id: s.id, projectId: s.projectId })),
    [sessions, initialProjects, allSessionPrefixes],
  );

  const handleToggleSidebar = useCallback(() => {
    if (isMobile) {
      setMobileSidebarOpen((v) => !v);
    } else {
      setSidebarCollapsed((v) => !v);
    }
  }, [isMobile]);

  return (
    <SidebarContext.Provider value={{ onToggleSidebar: handleToggleSidebar, mobileSidebarOpen }}>
      <div className="dashboard-app-shell">
        <div
          className={`dashboard-shell--desktop${sidebarCollapsed ? " dashboard-shell--sidebar-collapsed" : ""}`}
        >
          <div
            className={`sidebar-wrapper${mobileSidebarOpen ? " sidebar-wrapper--mobile-open" : ""}`}
          >
            <ProjectSidebar
              projects={initialProjects}
              sessions={sessions}
              orchestrators={sidebarOrchestrators}
              activeProjectId={projectId}
              activeSessionId={activeSessionId}
              loading={!liveSessionsResolved}
              collapsed={sidebarCollapsed}
              onToggleCollapsed={() => setSidebarCollapsed((v) => !v)}
              onMobileClose={() => setMobileSidebarOpen(false)}
            />
          </div>
          {mobileSidebarOpen && (
            <div className="sidebar-mobile-backdrop" onClick={() => setMobileSidebarOpen(false)} />
          )}
          {children}
        </div>
      </div>
    </SidebarContext.Provider>
  );
}

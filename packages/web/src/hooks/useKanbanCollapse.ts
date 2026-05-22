"use client";

import { useCallback, useState } from "react";

export const KANBAN_COLLAPSE_PREFIX = "ao-kanban-collapsed:";

export function readKanbanCollapsed(columnId: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(`${KANBAN_COLLAPSE_PREFIX}${columnId}`) === "true";
  } catch {
    return false;
  }
}

export function writeKanbanCollapsed(columnId: string, collapsed: boolean): void {
  try {
    if (collapsed) {
      localStorage.setItem(`${KANBAN_COLLAPSE_PREFIX}${columnId}`, "true");
    } else {
      localStorage.removeItem(`${KANBAN_COLLAPSE_PREFIX}${columnId}`);
    }
  } catch {
    // localStorage unavailable — ignore
  }
}

export function useKanbanCollapse(columnId: string): [boolean, () => void] {
  const [collapsed, setCollapsed] = useState(() => readKanbanCollapsed(columnId));

  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      writeKanbanCollapsed(columnId, next);
      return next;
    });
  }, [columnId]);

  return [collapsed, toggle];
}

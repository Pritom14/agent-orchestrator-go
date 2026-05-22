/**
 * Format elapsed seconds into a human-readable duration string.
 * < 60s   → "Xs"
 * < 1h    → "Xm"
 * < 1d    → "Xh Ym"
 * >= 1d   → "Xd"
 */
export function formatDuration(elapsedMs: number): string {
  const totalSeconds = Math.floor(elapsedMs / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;

  const totalMinutes = Math.floor(totalSeconds / 60);
  if (totalMinutes < 60) return `${totalMinutes}m`;

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours < 24) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;

  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export function getElapsedMs(createdAt: string): number {
  return Date.now() - new Date(createdAt).getTime();
}

import type { Alert } from "./types";

/**
 * True when the newest alert differs from the one the previous poll saw. The
 * first poll only sets the baseline (`previousNewestId` undefined), so a drop
 * that happened while the app was closed does not add a second launch load.
 */
export function newestAlertChanged(
  previousNewestId: string | null | undefined,
  alerts: Alert[],
): boolean {
  if (previousNewestId === undefined) return false;
  return (alerts[0]?.id ?? null) !== previousNewestId;
}

/**
 * Houses an import brought into the catalogue for the first time. Without a
 * previous catalogue there is nothing to compare against, so nothing is new:
 * the one-time seeding on a new install (`followsSeeded`) covers that case.
 */
export function brandsToFollowAfterImport(previousBrandIds: string[], nextBrandIds: string[]): string[] {
  if (previousBrandIds.length === 0) return [];
  const previous = new Set(previousBrandIds);
  return nextBrandIds.filter((id) => !previous.has(id));
}

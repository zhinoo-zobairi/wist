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

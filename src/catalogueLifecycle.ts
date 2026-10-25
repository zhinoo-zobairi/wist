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
 * True while the followed houses are still the install default, as a set: no
 * house has been followed or unfollowed by hand, so the catalogue may seed them.
 */
export function shouldSeedFollows(followedBrandIds: string[], seedIds: string[]): boolean {
  const followed = new Set(followedBrandIds);
  return followed.size === new Set(seedIds).size && seedIds.every((id) => followed.has(id));
}

/**
 * Houses an import brought into the catalogue for the first time. Without a
 * previous catalogue there is nothing to compare against, so nothing is new:
 * the launch rule (`shouldSeedFollows`) decides that case.
 */
export function brandsToFollowAfterImport(previousBrandIds: string[], nextBrandIds: string[]): string[] {
  if (previousBrandIds.length === 0) return [];
  const previous = new Set(previousBrandIds);
  return nextBrandIds.filter((id) => !previous.has(id));
}

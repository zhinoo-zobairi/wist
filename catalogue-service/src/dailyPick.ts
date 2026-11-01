import type { Occasion } from "./styleProfile.js";

export const DAILY_PICK_HOUR = 6;
const MAX_REASON_LENGTH = 200;

export type Ranking = { order: string[]; reasons: Record<string, string> };

/** The server-local calendar date. Built from local fields, like capDay, so daylight saving cannot shift it. */
export function localDay(now: Date): string {
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

/** Due from 06:00 server-local until an attempt is recorded for today's local date (decision 2). */
export function isDailyPickDue(attemptedDay: string | null, now: Date): boolean {
  return now.getHours() >= DAILY_PICK_HOUR && attemptedDay !== localDay(now);
}

/**
 * Drops unknown and duplicate ids; keeps a reason only for the best-ranked valid outfit of each
 * occasion (so at most one per occasion, five in all), trimmed to 200 characters.
 */
export function keepValidRanking(
  order: readonly string[], bestPerOccasion: readonly { id: string; reason: string }[],
  occasionById: ReadonlyMap<string, Occasion>,
): Ranking {
  const kept: string[] = [];
  const bestIds = new Set<string>();
  const occasionsSeen = new Set<Occasion>();
  for (const id of order) {
    const occasion = occasionById.get(id);
    if (occasion === undefined || kept.includes(id)) continue;
    kept.push(id);
    if (!occasionsSeen.has(occasion)) {
      occasionsSeen.add(occasion);
      bestIds.add(id);
    }
  }
  const reasons = new Map<string, string>();
  for (const { id, reason } of bestPerOccasion) {
    const text = reason.trim().slice(0, MAX_REASON_LENGTH);
    if (bestIds.has(id) && text && !reasons.has(id)) reasons.set(id, text);
  }
  return { order: kept, reasons: Object.fromEntries(reasons) };
}

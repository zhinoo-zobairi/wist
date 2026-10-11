export const DAILY_PICK_HOUR = 6;
export const MAX_PICK_REASONS = 3;
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

/** Drops unknown and duplicate ids; keeps reasons only for the top 3 valid ids (decisions 5 and 7). */
export function keepValidRanking(
  order: readonly string[], top: readonly { id: string; reason: string }[], knownIds: ReadonlySet<string>,
): Ranking {
  const kept: string[] = [];
  for (const id of order) if (knownIds.has(id) && !kept.includes(id)) kept.push(id);
  const topIds = new Set(kept.slice(0, MAX_PICK_REASONS));
  const reasons = new Map<string, string>();
  for (const { id, reason } of top) {
    const text = reason.trim().slice(0, MAX_REASON_LENGTH);
    if (topIds.has(id) && text && !reasons.has(id)) reasons.set(id, text);
  }
  return { order: kept, reasons: Object.fromEntries(reasons) };
}

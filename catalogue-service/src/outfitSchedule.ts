export const DEBOUNCE_MS = 10 * 60_000;
export const DAILY_RUN_CAP = 12;
export const CATCH_UP_HOUR = 3;

export type RunTrigger = "debounced" | "catch_up" | "more_ideas";

export type ScheduleState = {
  /** When the tagged wardrobe last changed. */
  lastChangedAt: string | null;
  /** The change time read by the latest run, whatever its outcome. */
  lastAttemptedChangedAt: string | null;
  /** The change time read by the latest successful run. */
  lastSucceededChangedAt: string | null;
  /** Runs started in the current cap day, excluding skipped ones (D2). */
  runsThisCapDay: number;
  moreIdeasRequested: boolean;
  /** The cap day whose 03:00 catch-up has already been considered. */
  catchUpCheckedDay: string | null;
};

const HOUR_MS = 3_600_000;

/** The cap day runs 03:00→03:00 local, so changes left over after the cap wait for the catch-up. */
export function capDay(now: Date): string {
  const shifted = new Date(now.getTime() - CATCH_UP_HOUR * HOUR_MS);
  const month = String(shifted.getMonth() + 1).padStart(2, "0");
  const day = String(shifted.getDate()).padStart(2, "0");
  return `${shifted.getFullYear()}-${month}-${day}`;
}

export function capDayStart(now: Date): Date {
  const shifted = new Date(now.getTime() - CATCH_UP_HOUR * HOUR_MS);
  return new Date(shifted.getFullYear(), shifted.getMonth(), shifted.getDate(), CATCH_UP_HOUR);
}

export function decideRun(
  state: ScheduleState, now: Date,
): { trigger: RunTrigger | null; checkCatchUp: boolean } {
  const checkCatchUp = state.catchUpCheckedDay !== capDay(now);
  if (state.runsThisCapDay >= DAILY_RUN_CAP) return { trigger: null, checkCatchUp };
  if (state.moreIdeasRequested) return { trigger: "more_ideas", checkCatchUp };

  const changed = state.lastChangedAt;
  if (changed === null) return { trigger: null, checkCatchUp };
  const unattempted = state.lastAttemptedChangedAt === null || changed > state.lastAttemptedChangedAt;
  if (unattempted && now.getTime() - Date.parse(changed) >= DEBOUNCE_MS) {
    return { trigger: "debounced", checkCatchUp };
  }
  const outOfDate = state.lastSucceededChangedAt === null || changed > state.lastSucceededChangedAt;
  if (checkCatchUp && outOfDate) return { trigger: "catch_up", checkCatchUp };
  return { trigger: null, checkCatchUp };
}

import { describe, expect, it } from "vitest";
import { DAILY_RUN_CAP, capDay, decideRun, type ScheduleState } from "./outfitSchedule.js";

// Local-time constructor, so tests hold in any time zone.
const at = (day: number, hour: number, minute = 0) => new Date(2026, 9, day, hour, minute);
const iso = (date: Date) => date.toISOString();
const base: ScheduleState = {
  lastChangedAt: null, lastAttemptedChangedAt: null, lastSucceededChangedAt: null,
  runsThisCapDay: 0, moreIdeasRequested: false, catchUpCheckedDay: capDay(at(10, 12)),
};

describe("decideRun", () => {
  it("waits 10 quiet minutes after a change, and restarts the wait on every change", () => {
    const changed = { ...base, lastChangedAt: iso(at(10, 19, 6)) };
    expect(decideRun(changed, at(10, 19, 15)).trigger).toBeNull();
    expect(decideRun(changed, at(10, 19, 16)).trigger).toBe("debounced");
  });

  it("never retries a change it already attempted, even if that run failed", () => {
    const failed = { ...base, lastChangedAt: iso(at(10, 9)), lastAttemptedChangedAt: iso(at(10, 9)) };
    expect(decideRun(failed, at(10, 18)).trigger).toBeNull();
  });

  it("runs once for a change made during an earlier run (D7)", () => {
    const state = { ...base, lastChangedAt: iso(at(10, 9, 5)), lastAttemptedChangedAt: iso(at(10, 9)) };
    expect(decideRun(state, at(10, 9, 15)).trigger).toBe("debounced");
  });

  it("honours a More ideas request first", () => {
    const state = { ...base, moreIdeasRequested: true, lastChangedAt: iso(at(10, 9)) };
    expect(decideRun(state, at(10, 9, 1)).trigger).toBe("more_ideas");
  });

  it("stops at the daily cap, including More ideas", () => {
    const state = {
      ...base, runsThisCapDay: DAILY_RUN_CAP, moreIdeasRequested: true, lastChangedAt: iso(at(10, 9)),
    };
    expect(decideRun(state, at(10, 12)).trigger).toBeNull();
  });

  it("checks the catch-up once per cap day, and only runs it when outfits are out of date", () => {
    const yesterday = capDay(at(9, 12));
    const stale = {
      ...base, catchUpCheckedDay: yesterday,
      lastChangedAt: iso(at(9, 22)), lastAttemptedChangedAt: iso(at(9, 22)), lastSucceededChangedAt: iso(at(9, 8)),
    };
    expect(decideRun(stale, at(10, 2, 59))).toEqual({ trigger: null, checkCatchUp: false });
    expect(decideRun(stale, at(10, 3))).toEqual({ trigger: "catch_up", checkCatchUp: true });

    const fresh = { ...stale, lastSucceededChangedAt: iso(at(9, 22)) };
    expect(decideRun(fresh, at(10, 3))).toEqual({ trigger: null, checkCatchUp: true });

    const checked = { ...stale, catchUpCheckedDay: capDay(at(10, 3)) };
    expect(decideRun(checked, at(10, 14)).trigger).toBeNull();
  });

  it("does nothing for a wardrobe that never changed", () => {
    expect(decideRun({ ...base, catchUpCheckedDay: null }, at(10, 3))).toEqual({ trigger: null, checkCatchUp: true });
  });
});

// Must run before any Date is used, so the whole file sees a daylight-saving zone.
process.env.TZ = "Europe/Stockholm";

import { describe, expect, it } from "vitest";
import { capDay, capDayStart } from "./outfitSchedule.js";

describe("cap day across daylight saving (Europe/Stockholm)", () => {

  it("rolls at 03:00 local on the spring-forward day (2026-03-29)", () => {
    // 01:00Z is 03:00 CEST, the first moment after the clocks jump.
    expect(capDay(new Date("2026-03-29T00:59:00Z"))).toBe("2026-03-28");
    expect(capDay(new Date("2026-03-29T01:00:00Z"))).toBe("2026-03-29");
    expect(capDayStart(new Date("2026-03-29T01:00:00Z")).toISOString()).toBe("2026-03-29T01:00:00.000Z");
  });

  it("rolls at 03:00 local on the fall-back day (2026-10-25), not at the second 02:00", () => {
    // 01:30Z is the second 02:30 (CET); still before 03:00 local.
    expect(capDay(new Date("2026-10-25T01:30:00Z"))).toBe("2026-10-24");
    expect(capDayStart(new Date("2026-10-25T01:30:00Z")).toISOString()).toBe("2026-10-24T01:00:00.000Z");
    // 02:00Z is 03:00 CET.
    expect(capDay(new Date("2026-10-25T02:00:00Z"))).toBe("2026-10-25");
    expect(capDayStart(new Date("2026-10-25T02:00:00Z")).toISOString()).toBe("2026-10-25T02:00:00.000Z");
  });
});

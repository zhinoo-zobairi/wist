import { describe, expect, it } from "vitest";
import { keepValidRanking, localDay } from "./dailyPick.js";

// Local-time constructor, so tests hold in any time zone.
const at = (month: number, day: number, hour: number, minute = 0) => new Date(2026, month, day, hour, minute);

describe("localDay", () => {
  it("is the server-local calendar date, zero-padded", () => {
    expect(localDay(at(9, 11, 0))).toBe("2026-10-11");
    expect(localDay(at(9, 11, 23, 59))).toBe("2026-10-11");
    expect(localDay(at(0, 5, 12))).toBe("2026-01-05");
  });
});

describe("isDailyPickDue", () => {
});

describe("keepValidRanking", () => {
  const known = new Set(["a", "b", "c", "d"]);

  it("drops unknown and duplicate ids, keeping the first position", () => {
    expect(keepValidRanking(["x", "b", "a", "b", "d"], [], known).order).toEqual(["b", "a", "d"]);
  });

  it("keeps reasons only for the top 3 valid ids, trimmed to 200 characters", () => {
    const ranking = keepValidRanking(["x", "a", "b", "c", "d"], [
      { id: "a", reason: `  ${"r".repeat(250)}  ` },
      { id: "b", reason: "Layers for the wind." },
      { id: "d", reason: "Fourth place has no reason." },
      { id: "x", reason: "Unknown id." },
      { id: "c", reason: "   " },
      { id: "b", reason: "A second reason for b is ignored." },
    ], known);
    expect(ranking).toEqual({
      order: ["a", "b", "c", "d"],
      reasons: { a: "r".repeat(200), b: "Layers for the wind." },
    });
  });
});

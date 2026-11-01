import { describe, expect, it } from "vitest";
import { keepValidRanking, localDay } from "./dailyPick.js";
import { OCCASIONS, type Occasion } from "./styleProfile.js";

// Local-time constructor, so tests hold in any time zone.
const at = (month: number, day: number, hour: number, minute = 0) => new Date(2026, month, day, hour, minute);

describe("localDay", () => {
  it("is the server-local calendar date, zero-padded", () => {
    expect(localDay(at(9, 11, 0))).toBe("2026-10-11");
    expect(localDay(at(9, 11, 23, 59))).toBe("2026-10-11");
    expect(localDay(at(0, 5, 12))).toBe("2026-01-05");
  });
});

describe("keepValidRanking", () => {
  const occasions = new Map<string, Occasion>([
    ["a", "work"], ["b", "work"], ["c", "weekend"], ["d", "travel"], ["e", "weekend"],
  ]);

  it("drops unknown and duplicate ids, keeping the first position", () => {
    expect(keepValidRanking(["x", "b", "a", "b", "d"], [], occasions).order).toEqual(["b", "a", "d"]);
  });

  it("keeps a reason only for the best-ranked outfit of each occasion, trimmed to 200 characters", () => {
    const ranking = keepValidRanking(["x", "c", "a", "b", "e", "d"], [
      { id: "a", reason: `  ${"r".repeat(250)}  ` },
      { id: "b", reason: "Second work outfit has no reason." },
      { id: "c", reason: "Layers for the wind." },
      { id: "e", reason: "Second weekend outfit has no reason." },
      { id: "d", reason: "   " },
      { id: "x", reason: "Unknown id." },
      { id: "c", reason: "A second reason for c is ignored." },
    ], occasions);
    expect(ranking).toEqual({
      order: ["c", "a", "b", "e", "d"],
      reasons: { c: "Layers for the wind.", a: "r".repeat(200) },
    });
  });

  it("follows the ranking, not the order the reasons were listed in", () => {
    const ranking = keepValidRanking(["b", "a"], [
      { id: "a", reason: "Listed first, ranked second." },
      { id: "b", reason: "Ranked first." },
    ], occasions);
    expect(ranking.reasons).toEqual({ b: "Ranked first." });
  });

  it("gives at most five reasons, one per occasion, however many outfits there are", () => {
    const all = OCCASIONS.flatMap((occasion) => [`${occasion}-1`, `${occasion}-2`]);
    const ranking = keepValidRanking(all, all.map((id) => ({ id, reason: `Reason for ${id}.` })),
      new Map(all.map((id) => [id, id.split("-")[0] as Occasion])));
    expect(Object.keys(ranking.reasons)).toEqual(OCCASIONS.map((occasion) => `${occasion}-1`));
    expect(Object.keys(ranking.reasons)).toHaveLength(5);
  });
});

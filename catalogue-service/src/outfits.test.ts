import { describe, expect, it } from "vitest";
import { keepValidOutfits, parseOutfitRequest } from "./outfits.js";

describe("outfit domain", () => {
  it.each(["work", "evening", "weekend", "celebration", "travel"])("accepts occasion %s", (occasion) => {
    expect(parseOutfitRequest({ context: { occasion } })).toEqual({ occasion });
  });
  it.each([null, [], {}, { occasion: "work" }, { context: null }, { context: [] },
    { context: { occasion: "gym" } }, { context: { occasion: 1 } },
  ])("rejects an invalid request %j", (request) => {
    expect(parseOutfitRequest(request)).toBeNull();
  });
  const ids = new Set(["a", "b", "c", "d", "e", "f", "g"]);
  it("drops malformed outfits, hallucinations, duplicates, and invalid lengths", () => {
    const valid = { garmentIds: ["a", "b"], reason: "A balanced combination." };
    expect(keepValidOutfits([
      null, {}, { garmentIds: ["a", "unknown"], reason: "Invented" },
      { garmentIds: ["a", "a"], reason: "Duplicate" },
      { garmentIds: ["a"], reason: "Too small" },
      { garmentIds: [...ids], reason: "Too large" },
      { garmentIds: ["a", "b"], reason: " " },
      { garmentIds: ["a", "b"], reason: 3 }, valid,
    ], ids)).toEqual([valid]);
  });
  it("keeps only the first three valid outfits and truncates reasons to 200 characters", () => {
    const outfit = { garmentIds: ["a", "b"], reason: ` ${"x".repeat(250)} ` };
    expect(keepValidOutfits(Array(10).fill(outfit), ids)).toEqual(Array(3).fill({ ...outfit, reason: "x".repeat(200) }));
  });
  it("accepts six unique pieces and returns empty when no outfits survive", () => {
    expect(keepValidOutfits([{ garmentIds: ["a", "b", "c", "d", "e", "f"], reason: "Layered." }], ids)).toHaveLength(1);
    expect(keepValidOutfits([{ garmentIds: ["unknown", "a"], reason: "Invented" }], ids)).toEqual([]);
    expect(keepValidOutfits(null, ids)).toEqual([]);
  });
});

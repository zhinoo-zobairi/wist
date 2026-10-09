import { describe, expect, it } from "vitest";
import { parseGarmentInput } from "./wardrobe.js";

const input = {
  name: " Navy cotton shirt ", category: "top", colors: [" NAVY ", "Cream"],
  formality: "smart_casual", warmth: "light", occasions: ["travel", "work"],
};

describe("garment validation", () => {
  it("normalizes text and uses the permanent occasion order", () => {
    expect(parseGarmentInput(input)).toEqual({
      name: "Navy cotton shirt", category: "top", colors: ["navy", "cream"],
      formality: "smart_casual", warmth: "light", occasions: ["work", "travel"], notes: null,
    });
    expect(parseGarmentInput({ ...input, occasions: [], notes: " Cotton " }))
      .toMatchObject({ occasions: [], notes: "Cotton" });
  });

  it("accepts the exact field length limits", () => {
    expect(parseGarmentInput({
      ...input, name: "a".repeat(80), colors: ["a".repeat(24)], notes: "a".repeat(280),
    })).not.toBeNull();
  });

  it.each([
    null, [], "shirt", 3, {},
    { ...input, name: " " }, { ...input, name: "a".repeat(81) },
    { ...input, category: "unknown" }, { ...input, formality: "unknown" },
    { ...input, warmth: "unknown" }, { ...input, occasions: "work" },
    { ...input, occasions: ["unknown"] }, { ...input, occasions: ["work", "work"] },
    { ...input, colors: [] }, { ...input, colors: ["navy", "cream", "red", "olive"] },
    { ...input, colors: ["navy", " NAVY "] }, { ...input, colors: [null] },
    { ...input, colors: [" "] }, { ...input, colors: ["a".repeat(25)] },
    { ...input, notes: 2 }, { ...input, notes: "a".repeat(281) },
  ])("rejects invalid input: %j", (value) => {
    expect(parseGarmentInput(value)).toBeNull();
  });
});

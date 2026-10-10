import { describe, expect, it } from "vitest";
import { garmentKey, keepValidGeneratedOutfits } from "./outfits.js";

const eligible = new Set(["a", "b", "c", "d"]);
const outfit = (occasion: string, garmentIds: unknown[], reason: unknown = "Works well.") => ({ occasion, garmentIds, reason });

describe("garmentKey", () => {
  it("ignores garment order", () => {
    expect(garmentKey(["b", "a", "c"])).toBe("a,b,c");
    expect(garmentKey(["c", "b", "a"])).toBe(garmentKey(["a", "b", "c"]));
  });
});

describe("keepValidGeneratedOutfits", () => {
  it("keeps valid outfits and trims reasons to 200 characters", () => {
    const long = ` ${"x".repeat(250)} `;
    expect(keepValidGeneratedOutfits([outfit("work", ["a", "b"], long)], eligible, ["work"]))
      .toEqual([{ occasion: "work", garmentIds: ["a", "b"], reason: "x".repeat(200) }]);
  });

  it.each([
    ["unknown garment", outfit("work", ["a", "zzz"])],
    ["duplicate garment", outfit("work", ["a", "a"])],
    ["too few garments", outfit("work", ["a"])],
    ["too many garments", outfit("work", ["a", "b", "c", "d", "e", "f", "g"])],
    ["unrequested occasion", outfit("evening", ["a", "b"])],
    ["empty reason", outfit("work", ["a", "b"], "  ")],
    ["non-string id", outfit("work", ["a", 1])],
  ])("drops an outfit with %s", (_, candidate) => {
    expect(keepValidGeneratedOutfits([candidate], eligible, ["work"])).toEqual([]);
  });

  it("keeps at most 2 outfits per occasion", () => {
    const many = [outfit("work", ["a", "b"]), outfit("work", ["a", "c"]), outfit("work", ["a", "d"]), outfit("travel", ["b", "c"])];
    expect(keepValidGeneratedOutfits(many, eligible, ["work", "travel"]).map((o) => o.occasion))
      .toEqual(["work", "work", "travel"]);
  });

  it("returns nothing for non-array output", () => {
    expect(keepValidGeneratedOutfits(null, eligible, ["work"])).toEqual([]);
  });
});

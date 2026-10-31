import { describe, expect, it } from "vitest";

import { preselectedSizes } from "./sizePreselect";

const variants = [
  { id: "1", label: "36", available: true },
  { id: "2", label: "36/38", available: true },
  { id: "3", label: " s ", available: false },
  { id: "4", label: "38", available: true },
];

describe("default size pre-selection", () => {
  it("picks only labels equal to a default after trimming and ignoring case", () => {
    expect(preselectedSizes(variants, { tops: "S", bottoms: "36" })).toEqual(["36", " s "]);
  });

  it("never converts between labels", () => {
    expect(preselectedSizes(variants, { bottoms: "37" })).toEqual([]);
  });

  it("picks nothing without defaults", () => {
    expect(preselectedSizes(variants, {})).toEqual([]);
  });
});

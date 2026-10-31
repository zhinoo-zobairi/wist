import { describe, expect, it } from "vitest";

import { parseStyleProfile } from "./styleProfile.js";

describe("style profile validation", () => {
  it("accepts empty selections", () => {
    expect(parseStyleProfile({ occasions: [], styles: [] })).toEqual({
      occasions: [],
      styles: [],
    });
  });

  it("validates and canonicalizes the permanent vocabulary", () => {
    expect(
      parseStyleProfile({
        occasions: ["travel", "work"],
        styles: ["bold", "minimal"],
      }),
    ).toEqual({
      occasions: ["work", "travel"],
      styles: ["minimal", "bold"],
    });
  });

  it.each([
    null,
    {},
    { occasions: "work", styles: [] },
    { occasions: ["unknown"], styles: [] },
    { occasions: ["work", "work"], styles: [] },
    { occasions: [], styles: ["minimal", "minimal"] },
    {
      occasions: [],
      styles: ["minimal", "tailored", "romantic", "bold"],
    },
  ])("rejects an invalid profile: %j", (profile) => {
    expect(parseStyleProfile(profile)).toBeNull();
  });

  it("accepts every brief answer and returns sets in vocabulary order", () => {
    expect(
      parseStyleProfile({
        occasions: [],
        styles: [],
        shopsFor: "both",
        helpWith: ["weather", "use_what_i_own"],
        workDressCode: "smart",
        tasteAxes: { structure: "fluid", edge: "both", finish: "lived_in" },
        palettes: ["ink_grey", "ivory_camel"],
        neverColours: ["neon", "orange"],
        prints: "small_doses",
        fit: { tops: "relaxed", coats: "long" },
        defaultSizes: { tops: " S ", shoes: "38" },
        signature: ["loafers", "blazer"],
        gaps: ["long_coat"],
        dropThreshold: 20,
      }),
    ).toEqual({
      occasions: [],
      styles: [],
      shopsFor: "both",
      helpWith: ["use_what_i_own", "weather"],
      workDressCode: "smart",
      tasteAxes: { structure: "fluid", edge: "both", finish: "lived_in" },
      palettes: ["ivory_camel", "ink_grey"],
      neverColours: ["orange", "neon"],
      prints: "small_doses",
      fit: { tops: "relaxed", coats: "long" },
      defaultSizes: { tops: "S", shoes: "38" },
      signature: ["blazer", "loafers"],
      gaps: ["long_coat"],
      dropThreshold: 20,
    });
  });

  // Decision 4: an absent answer keeps what is stored, so the parser leaves
  // it out; null clears it.
  it("leaves out an absent answer and turns null into a cleared one", () => {
    expect(
      parseStyleProfile({
        occasions: [],
        styles: [],
        shopsFor: null,
        palettes: null,
        fit: null,
      }),
    ).toStrictEqual({
      occasions: [],
      styles: [],
      shopsFor: null,
      palettes: [],
      fit: {},
    });
  });

  it("accepts the boundary values", () => {
    const boundary = {
      occasions: [],
      styles: [],
      defaultSizes: { tops: "123456789012" },
      dropThreshold: 0,
      helpWith: [],
    };
    expect(parseStyleProfile(boundary)).toStrictEqual(boundary);
  });

  // `includes` treats -0 as 0, so without care -0 would be stored as -0.
  it("parses a negative zero threshold to zero", () => {
    expect(
      parseStyleProfile({ occasions: [], styles: [], dropThreshold: -0 }),
    ).toStrictEqual({ occasions: [], styles: [], dropThreshold: 0 });
  });

  // Typed explicitly: `toString` and `constructor` as keys clash with
  // Object.prototype, so TypeScript cannot infer one element type for the table.
  it.each<Record<string, unknown>>([
    { shopsFor: "kids" },
    { helpWith: ["weather", "weather"] },
    { helpWith: ["weather", "fewer_better", "use_what_i_own"] },
    { workDressCode: "black_tie" },
    { tasteAxes: { structure: "sharp" } },
    { tasteAxes: { colour: "tonal" } },
    { tasteAxes: ["fluid"] },
    { palettes: ["earth", "jewel", "brights"] },
    { neverColours: ["beige"] },
    { prints: "none" },
    { fit: { tops: "wide" } },
    { defaultSizes: { tops: "" } },
    { defaultSizes: { tops: "   " } },
    { defaultSizes: { tops: "1234567890123" } },
    { defaultSizes: { hats: "M" } },
    { defaultSizes: { tops: 38 } },
    { signature: ["blazer", "blazer"] },
    { gaps: ["umbrella"] },
    { dropThreshold: 15 },
    { dropThreshold: "20" },
    { tasteAxes: { toString: "both" } },
    { fit: { constructor: "slim" } },
    { palettes: "earth" },
    { signature: [1] },
    { defaultSizes: ["M"] },
    { fit: ["slim"] },
  ])("rejects an invalid brief answer: %j", (answer) => {
    expect(
      parseStyleProfile({ occasions: [], styles: [], ...answer }),
    ).toBeNull();
  });
});

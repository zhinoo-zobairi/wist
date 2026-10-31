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
    ).toEqual({ occasions: [], styles: [], shopsFor: null, palettes: [], fit: {} });
  });

  it.each([
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
  ])("rejects an invalid brief answer: %j", (answer) => {
    expect(
      parseStyleProfile({ occasions: [], styles: [], ...answer }),
    ).toBeNull();
  });
});

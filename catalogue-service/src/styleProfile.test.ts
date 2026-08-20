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
});

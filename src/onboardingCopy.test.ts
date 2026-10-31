import { describe, expect, it } from "vitest";

import {
  alertPriceText, briefHeadline, briefPromises, briefRows, composingLines, hasStyleBrief,
  listJoin, paletteInterlude, revealSummary, workInterlude,
} from "./onboardingCopy";
import { emptyStyleDetails, type OnboardingAnswers } from "./types";

const blank: OnboardingAnswers = {
  occasions: [], styles: [], details: emptyStyleDetails(), houseIds: [], notificationsAllowed: null,
};
const reader: OnboardingAnswers = {
  ...blank,
  occasions: ["work", "weekend"],
  styles: ["minimal", "tailored"],
  details: {
    ...emptyStyleDetails(),
    shopsFor: "womenswear",
    workDressCode: "smart",
    tasteAxes: { structure: "fluid", edge: "soft", contrast: "tonal" },
    palettes: ["ivory_camel", "ink_grey"],
    neverColours: ["orange", "neon"],
    prints: "small_doses",
    fit: { tops: "relaxed", trousers: "wide", lengths: "midi" },
    defaultSizes: { tops: "S", bottoms: "36", shoes: "38" },
    signature: ["blazer", "fine_knits", "loafers"],
    gaps: ["long_coat", "evening_shoes"],
    dropThreshold: 20,
  },
};

describe("onboarding copy", () => {
  it("joins words as a sentence would", () => {
    expect(listJoin([])).toBe("");
    expect(listJoin(["a"])).toBe("a");
    expect(listJoin(["a", "b"])).toBe("a and b");
    expect(listJoin(["a", "b", "c"], "or")).toBe("a, b or c");
  });

  it("answers the work interlude from the dress code, else the week", () => {
    expect(workInterlude(reader)).toEqual({
      kicker: "For work, you said",
      title: "Sharp, quiet, nothing extra.",
      body: 'This is how WIST reads "work" for you. Every answer from here changes what you will see.',
    });
    expect(workInterlude({ ...blank, occasions: ["evening", "weekend"] }).title).toBe(
      "Evenings out and the weekend.",
    );
    expect(workInterlude(blank).title).toBe("Whatever the week asks for.");
  });

  it("names the chosen palettes", () => {
    expect(paletteInterlude(reader).title).toBe("Ivory, camel, ink and grey.");
    expect(paletteInterlude(blank).title).toBe("Colour, your way.");
  });

  it("heads the brief with the style words and the softest taste", () => {
    expect(briefHeadline(reader)).toBe("Minimal, tailored and a little soft.");
    expect(briefHeadline(blank)).toBe("Your style, in your words.");
  });

  it("reads every answer back and leaves out what was skipped", () => {
    expect(briefRows(reader)).toEqual([
      { label: "Your week", value: "Smart for work and the weekend" },
      { label: "Your eye", value: "Fluid, soft, tonal" },
      { label: "Palette", value: "Ivory, camel, ink and grey. Never orange or neon. Prints in small doses" },
      { label: "Fit", value: "Relaxed on top, wide below and midi lengths. S · 36 · 38" },
      { label: "Wardrobe", value: "Built on a blazer, fine knits and loafers. Missing a long coat and evening shoes" },
    ]);
    expect(briefRows(blank)).toEqual([]);
  });

  it("promises what WIST will do with the answers", () => {
    expect(briefPromises(reader, 3)).toEqual([
      "Dress you for work from what you own, starting with your blazer, fine knits and loafers.",
      "Keep a long coat and evening shoes on your list, in your palette and size.",
      "Tell you when your three pieces fall 20% or more, in your size.",
    ]);
    expect(briefPromises({ ...blank, notificationsAllowed: false }, 0)[2]).toBe(
      "Tell you when a piece you covet falls to a new low, in your size. You will find it in Alerts rather than as a banner.",
    );
  });

  it("composes from the houses, sizes and pieces", () => {
    expect(composingLines(reader, ["Sandro", "Claudie Pierlot", "Bobbies"], 3)).toEqual([
      "Reading Sandro, Claudie Pierlot and Bobbies",
      "Keeping what comes in S, 36 and 38, in your palette",
      "Setting a watch on your three pieces",
    ]);
  });

  it("sums up the edit", () => {
    expect(revealSummary(reader)).toBe(
      "Minimal and tailored, in ivory, camel, ink and grey. Relaxed on top, wide below and midi lengths. For work and the weekend, in S, 36 and 38.",
    );
    expect(revealSummary(blank)).toBe("Your edit starts here, and sharpens with every piece you covet.");
  });

  it("prices the alert at the chosen threshold", () => {
    expect(alertPriceText(455, "EUR", 20)).toBe("€ 364");
    expect(alertPriceText(215, "GBP", 0)).toBe("below £ 215");
    expect(alertPriceText(140, "GBP", null)).toBe("below £ 140");
  });

  it("knows whether any brief answer exists", () => {
    expect(hasStyleBrief(emptyStyleDetails())).toBe(false);
    expect(hasStyleBrief({ ...emptyStyleDetails(), dropThreshold: 0 })).toBe(true);
    expect(hasStyleBrief({ ...emptyStyleDetails(), gaps: ["bag"] })).toBe(true);
  });
});

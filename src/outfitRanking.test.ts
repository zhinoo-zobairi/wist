import { describe, expect, it } from "vitest";
import { rankByWeather } from "./outfitRanking";
import type { Garment, WeatherSummary } from "./types";

const weather: WeatherSummary = { minC: 6, maxC: 11, precipitationChancePct: 70, maxWindKph: 20, condition: "rain" };
const garment = (warmth: Garment["warmth"], category: Garment["category"] = "top"): Garment => ({
  id: `${warmth}-${category}`, name: "Piece", category, warmth, colors: ["navy"], formality: "casual", occasions: [],
  notes: null, source: "manual", catalogueItemId: null, photoUrl: null, tagStatus: "tagged",
  createdAt: "2026-10-11T10:00:00Z", updatedAt: "2026-10-11T10:00:00Z",
});
const outfits = [
  { id: "light", garments: [garment("light")] },
  { id: "medium", garments: [garment("medium")] },
  { id: "heavy", garments: [garment("heavy")] },
];
const ids = (ranked: typeof outfits) => ranked.map((outfit) => outfit.id);

describe("outfit weather ranking", () => {
  it.each([
    [9.9, ["heavy", "medium", "light"]],
    [10, ["medium", "light", "heavy"]],
    [18, ["medium", "light", "heavy"]],
    [18.1, ["light", "medium", "heavy"]],
  ])("uses the approved warmth band at mean %i °C", (mean, expected) => {
    expect(ids(rankByWeather(outfits, { ...weather, minC: mean, maxC: mean }))).toEqual(expected);
  });

  it("targets the mean of min/max rather than either extreme", () => {
    expect(ids(rankByWeather(outfits, { ...weather, minC: 5, maxC: 20 }))).toEqual(["medium", "light", "heavy"]);
  });

  it("uses the heaviest garment, even in a mostly light outfit", () => {
    const mixed = { id: "mixed", garments: [garment("light"), garment("heavy", "bottom"), garment("light", "shoes")] };
    expect(ids(rankByWeather([outfits[0]!, mixed], weather))).toEqual(["mixed", "light"]);
  });

  it.each([[9.9, ["plain", "layer"]], [10, ["layer", "plain"]]])(
    "prefers outerwear for tied scores only at a swing of %i °C", (swing, expected) => {
      const tied = [
        { id: "plain", garments: [garment("medium")] },
        { id: "layer", garments: [garment("medium", "outerwear")] },
      ];
      expect(ids(rankByWeather(tied, { ...weather, minC: 10, maxC: 10 + swing }))).toEqual(expected);
    },
  );

  it("never lets the outerwear tie-break override a better warmth score", () => {
    const lightLayer = { id: "layer", garments: [garment("light", "outerwear")] };
    expect(ids(rankByWeather([lightLayer, outfits[2]!], { ...weather, minC: 0, maxC: 10 }))).toEqual(["heavy", "layer"]);
  });

  it("preserves server order for ties and never mutates or removes outfits", () => {
    const tied = [
      { id: "newest", garments: [garment("light")] },
      { id: "middle", garments: [garment("light")] },
      { id: "oldest", garments: [garment("heavy")] },
    ];
    const before = structuredClone(tied);
    expect(rankByWeather(tied, { ...weather, minC: 10, maxC: 18 })).toEqual(tied);
    const ranked = rankByWeather(outfits, weather);
    expect(ranked).toHaveLength(outfits.length);
    expect(new Set(ranked)).toEqual(new Set(outfits));
    expect(tied).toEqual(before);
    expect(ids(outfits)).toEqual(["light", "medium", "heavy"]);
  });

  it("leaves the input order unchanged when weather is unavailable", () => {
    const saved = [{ id: "empty", garments: [] }, ...outfits];
    expect(rankByWeather(saved, null)).toBe(saved);
  });

  it("places saved outfits with no remaining garments last in their server order, without hiding them", () => {
    const saved = [
      { id: "empty-newest", garments: [] }, outfits[0]!,
      { id: "empty-oldest", garments: [] }, outfits[2]!,
    ];
    const ranked = rankByWeather(saved, weather);
    expect(ids(ranked)).toEqual(["heavy", "light", "empty-newest", "empty-oldest"]);
    expect(new Set(ranked)).toEqual(new Set(saved));
  });

  it("does not rank by rain, wind or condition", () => {
    expect(rankByWeather(outfits, { ...weather, precipitationChancePct: 100, maxWindKph: 150, condition: "thunderstorm" }))
      .toEqual(rankByWeather(outfits, weather));
  });
});

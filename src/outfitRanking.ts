import type { Garment, WeatherSummary } from "./types";

const WARMTH = { light: 1, medium: 2, heavy: 3 };

export function rankByWeather<T extends { garments: Garment[] }>(outfits: T[], weather: WeatherSummary | null): T[] {
  if (weather === null) return outfits;
  const mean = (weather.minC + weather.maxC) / 2;
  const target = mean < 10 ? 3 : mean <= 18 ? 2 : 1;
  const needsLayer = weather.maxC - weather.minC >= 10;
  return outfits.map((outfit) => ({
    outfit,
    // Empty saved outfits have no warmth; keep them last, never remove them.
    score: outfit.garments.length === 0 ? Infinity
      : Math.abs(Math.max(...outfit.garments.map((garment) => WARMTH[garment.warmth])) - target),
    hasLayer: outfit.garments.some((garment) => garment.category === "outerwear"),
  })).sort((left, right) => {
    if (left.score !== right.score) return left.score - right.score;
    if (needsLayer) return Number(right.hasLayer) - Number(left.hasLayer);
    return 0; // Stable sort keeps the server's order for remaining ties.
  }).map(({ outfit }) => outfit);
}

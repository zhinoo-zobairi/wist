import { describe, expect, it } from "vitest";
import { weatherLine } from "./weatherMessages";
import type { WeatherSummary } from "./types";

const weather: WeatherSummary = { minC: 6, maxC: 11, precipitationChancePct: 70, maxWindKph: 20, condition: "rain" };

describe("weather line", () => {
  it("uses the approved fallback for unavailable weather", () => {
    expect(weatherLine(null)).toBe("Weather not included");
  });
  it("shows the range, condition, rain/snow chance, wind and source", () => {
    expect(weatherLine(weather)).toBe("6–11 °C · rain likely · 70% chance of rain or snow · wind up to 20 km/h · Open-Meteo");
  });
  it("preserves negative and fractional temperatures", () => {
    expect(weatherLine({ ...weather, minC: -2.5, maxC: 3.1 })).toContain("-2.5–3.1 °C");
  });
  it.each([
    ["clear", "clear skies"], ["cloudy", "cloudy"], ["fog", "fog"], ["drizzle", "drizzle"],
    ["snow", "snow likely"], ["thunderstorm", "thunderstorms"],
  ] as const)("uses readable copy for %s", (condition, copy) => {
    expect(weatherLine({ ...weather, condition })).toContain(` · ${copy} · `);
  });
});

import { describe, expect, it } from "vitest";
import { weatherLine } from "./weatherMessages";
import type { WeatherSummary } from "./types";

const weather: WeatherSummary = { minC: 6, maxC: 11, precipitationChancePct: 70, maxWindKph: 20, condition: "rain" };

describe("weather line", () => {
  it("says weather is loading until the board arrives", () => {
    expect(weatherLine(null, true)).toBe("Loading today's pick…");
  });
  it("says today's pick isn't ready without one", () => {
    expect(weatherLine(null, false)).toBe("Today's pick isn't ready");
  });
  it("shows this morning's forecast with range, condition and source", () => {
    expect(weatherLine(weather, false)).toBe("This morning's forecast: 6–11 °C · rain likely · Open-Meteo");
  });
  it("rounds temperatures for display", () => {
    expect(weatherLine({ ...weather, minC: 10.3, maxC: 14.7 }, false))
      .toBe("This morning's forecast: 10–15 °C · rain likely · Open-Meteo");
  });
  it("keeps the sign of negative temperatures", () => {
    expect(weatherLine({ ...weather, minC: -2.6, maxC: 3.1 }, false)).toContain(": -3–3 °C");
  });
  it("shows one temperature when the range rounds to the same value", () => {
    expect(weatherLine({ ...weather, minC: 10.6, maxC: 11.2 }, false)).toContain(": 11 °C · ");
  });
  it.each([
    ["clear", "clear skies"], ["cloudy", "cloudy"], ["fog", "fog"], ["drizzle", "drizzle"],
    ["snow", "snow likely"], ["thunderstorm", "thunderstorms"],
  ] as const)("uses readable copy for %s", (condition, copy) => {
    expect(weatherLine({ ...weather, condition }, false)).toContain(` · ${copy} · `);
  });
});

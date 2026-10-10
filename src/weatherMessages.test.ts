import { describe, expect, it } from "vitest";
import { weatherLine } from "./weatherMessages";
import type { WeatherSummary } from "./types";

const weather: WeatherSummary = { minC: 6, maxC: 11, precipitationChancePct: 70, maxWindKph: 20, condition: "rain" };

describe("weather line", () => {
  it("uses the approved fallback for unavailable weather", () => {
    expect(weatherLine(null, false)).toBe("Weather not included");
  });
  it("says weather is loading until the lookup settles", () => {
    expect(weatherLine(null, true)).toBe("Checking today's weather…");
  });
  it("shows the range, condition, rain/snow chance, wind and source", () => {
    expect(weatherLine(weather, false)).toBe("6–11 °C · rain likely · 70% chance of rain or snow · wind up to 20 km/h · Open-Meteo");
  });
  it("rounds temperatures and wind for display", () => {
    expect(weatherLine({ ...weather, minC: 10.3, maxC: 14.7, maxWindKph: 15.2 }, false))
      .toBe("10–15 °C · rain likely · 70% chance of rain or snow · wind up to 15 km/h · Open-Meteo");
  });
  it("keeps the sign of negative temperatures", () => {
    expect(weatherLine({ ...weather, minC: -2.6, maxC: 3.1 }, false)).toContain("-3–3 °C");
  });
  it("shows one temperature when the range rounds to the same value", () => {
    expect(weatherLine({ ...weather, minC: 10.6, maxC: 11.2 }, false)).toContain("11 °C · ");
  });
  it.each([
    ["clear", "clear skies"], ["cloudy", "cloudy"], ["fog", "fog"], ["drizzle", "drizzle"],
    ["snow", "snow likely"], ["thunderstorm", "thunderstorms"],
  ] as const)("uses readable copy for %s", (condition, copy) => {
    expect(weatherLine({ ...weather, condition }, false)).toContain(` · ${copy} · `);
  });
});

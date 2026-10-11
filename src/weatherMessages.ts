import type { WeatherSummary } from "./types";

const CONDITIONS: Record<WeatherSummary["condition"], string> = {
  clear: "clear skies", cloudy: "cloudy", fog: "fog", drizzle: "drizzle",
  rain: "rain likely", snow: "snow likely", thunderstorm: "thunderstorms",
};

/** The 06:00 forecast the pick used, or why there is none. */
export function weatherLine(weather: WeatherSummary | null, loading: boolean): string {
  if (weather === null) return loading ? "Loading today's pick…" : "Today's pick isn't ready";
  const min = Math.round(weather.minC), max = Math.round(weather.maxC);
  const range = min === max ? `${min}` : `${min}–${max}`;
  return `This morning's forecast: ${range} °C · ${CONDITIONS[weather.condition]} · Open-Meteo`;
}

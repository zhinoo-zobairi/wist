import type { WeatherSummary } from "./types";

const CONDITIONS: Record<WeatherSummary["condition"], string> = {
  clear: "clear skies", cloudy: "cloudy", fog: "fog", drizzle: "drizzle",
  rain: "rain likely", snow: "snow likely", thunderstorm: "thunderstorms",
};

export function weatherLine(weather: WeatherSummary | null): string {
  if (weather === null) return "Weather not included";
  return `${weather.minC}–${weather.maxC} °C · ${CONDITIONS[weather.condition]} · ` +
    `${weather.precipitationChancePct}% chance of rain or snow · wind up to ${weather.maxWindKph} km/h · Open-Meteo`;
}

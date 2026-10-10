export type Coordinates = { latitude: number; longitude: number };
export type WeatherSummary = {
  minC: number;
  maxC: number;
  precipitationChancePct: number;
  maxWindKph: number;
  condition: "clear" | "cloudy" | "fog" | "drizzle" | "rain" | "snow" | "thunderstorm";
};
export interface WeatherSource { today(at: Coordinates): Promise<WeatherSummary | null>; }

// WMO interpretation table: https://open-meteo.com/en/docs#weathervariables
const CONDITIONS: Record<number, WeatherSummary["condition"]> = {
  0: "clear", 1: "clear", 2: "cloudy", 3: "cloudy", 45: "fog", 48: "fog",
  51: "drizzle", 53: "drizzle", 55: "drizzle", 56: "drizzle", 57: "drizzle",
  61: "rain", 63: "rain", 65: "rain", 66: "rain", 67: "rain", 80: "rain", 81: "rain", 82: "rain",
  71: "snow", 73: "snow", 75: "snow", 77: "snow", 85: "snow", 86: "snow",
  95: "thunderstorm", 96: "thunderstorm", 97: "thunderstorm", 99: "thunderstorm",
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function summarizeOpenMeteo(json: unknown): WeatherSummary | null {
  if (!isObject(json) || !isObject(json.hourly)) return null;
  const { time, temperature_2m: temperatures, precipitation_probability: rain,
    wind_speed_10m: wind, weather_code: codes } = json.hourly;
  if (!Array.isArray(time) || time.length === 0 ||
    ![temperatures, rain, wind, codes].every((values) => Array.isArray(values) && values.length === time.length)) return null;
  const arrays = [temperatures, rain, wind, codes] as unknown[][];
  const date = typeof time[0] === "string" ? time[0].slice(0, 10) : "";
  const hours = new Set<number>();
  let minC = Infinity, maxC = -Infinity, precipitationChancePct = 0, maxWindKph = 0, worstCode = 0;

  // timezone=auto gives location-local timestamps; never use the server's local day.
  for (let index = 0; index < time.length; index += 1) {
    const timestamp: unknown = time[index];
    if (typeof timestamp !== "string" || !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):00$/.test(timestamp) ||
      timestamp.slice(0, 10) !== date) return null;
    const hour = Number(timestamp.slice(11, 13));
    if (hour < 7 || hour > 22) continue;
    if (hours.has(hour)) return null;
    hours.add(hour);
    const [temperature, chance, speed, code] = arrays.map((values) => values[index]);
    if (typeof temperature !== "number" || !Number.isFinite(temperature) ||
      typeof chance !== "number" || !Number.isFinite(chance) || chance < 0 || chance > 100 ||
      typeof speed !== "number" || !Number.isFinite(speed) || speed < 0 ||
      typeof code !== "number" || !Number.isInteger(code) || !CONDITIONS[code]) return null;
    minC = Math.min(minC, temperature);
    maxC = Math.max(maxC, temperature);
    precipitationChancePct = Math.max(precipitationChancePct, chance);
    maxWindKph = Math.max(maxWindKph, speed);
    worstCode = Math.max(worstCode, code);
  }
  if (hours.size !== 16) return null;
  return { minC, maxC, precipitationChancePct, maxWindKph, condition: CONDITIONS[worstCode]! };
}

async function readBoundedJson(response: Response): Promise<unknown> {
  if (!response.body) throw new Error("Empty weather response");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const chunks: string[] = [];
  let bytesRead = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytesRead += value.byteLength;
      if (bytesRead > 256_000) {
        await reader.cancel();
        throw new Error("Weather response exceeds 256 KB");
      }
      chunks.push(decoder.decode(value, { stream: true }));
    }
    chunks.push(decoder.decode());
    return JSON.parse(chunks.join(""));
  } finally {
    reader.releaseLock();
  }
}

export class OpenMeteoWeatherSource implements WeatherSource {
  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

  async today(at: Coordinates): Promise<WeatherSummary | null> {
    try {
      const url = new URL("https://api.open-meteo.com/v1/forecast");
      url.search = new URLSearchParams({
        latitude: String(Math.round(at.latitude * 100) / 100),
        longitude: String(Math.round(at.longitude * 100) / 100),
        hourly: "temperature_2m,precipitation_probability,wind_speed_10m,weather_code",
        timezone: "auto", forecast_days: "1",
      }).toString();
      const response = await this.fetchImpl(url, {
        signal: AbortSignal.timeout(5000), redirect: "error", headers: { accept: "application/json" },
      });
      if (!response.ok) return null;
      return summarizeOpenMeteo(await readBoundedJson(response));
    } catch {
      // Coordinates and upstream errors are never logged or persisted by Wist.
      return null;
    }
  }
}

import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OpenMeteoWeatherSource, summarizeOpenMeteo } from "./weather.js";

// Real forecast captured on 2026-10-11 for Open-Meteo's example Berlin coordinates
// (52.52, 13.41), trimmed to the hourly data, units and timezone. Tests never fetch it.
const fixture = JSON.parse(readFileSync(new URL("./fixtures/open-meteo.json", import.meta.url), "utf8"));
const summary = { minC: 9, maxC: 12.7, precipitationChancePct: 83, maxWindKph: 15.2, condition: "rain" };
const at = { latitude: 52.5249, longitude: 13.4051 };
const response = () => new Response(JSON.stringify(fixture));

afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

describe("today's weather summary", () => {
  it("summarizes the real fixture from 07:00 through 22:00 local time", () => {
    expect(summarizeOpenMeteo(fixture)).toEqual(summary);
  });

  it("includes both endpoints and ignores extremes outside the daytime window", () => {
    const value = structuredClone(fixture);
    value.hourly.temperature_2m[6] = -30;
    value.hourly.temperature_2m[23] = 50;
    value.hourly.precipitation_probability[0] = 100;
    value.hourly.wind_speed_10m[23] = 150;
    value.hourly.weather_code[6] = 99;
    value.hourly.temperature_2m[7] = -2;
    value.hourly.temperature_2m[22] = 20;
    expect(summarizeOpenMeteo(value)).toEqual({ ...summary, minC: -2, maxC: 20 });
  });

  it.each([
    [[0, 1], "clear"], [[2, 3], "cloudy"], [[45, 48], "fog"],
    [[51, 53, 55, 56, 57], "drizzle"], [[61, 63, 65, 66, 67, 80, 81, 82], "rain"],
    [[71, 73, 75, 77, 85, 86], "snow"], [[95, 96, 97, 99], "thunderstorm"],
  ] as const)("maps WMO codes %j to %s", (codes, condition) => {
    for (const code of codes) {
      const value = structuredClone(fixture);
      value.hourly.weather_code.fill(code);
      expect(summarizeOpenMeteo(value)?.condition).toBe(condition);
    }
  });

  it("uses the most severe daytime weather code", () => {
    const value = structuredClone(fixture);
    value.hourly.weather_code[10] = 95;
    value.hourly.weather_code[21] = 99;
    expect(summarizeOpenMeteo(value)?.condition).toBe("thunderstorm");
  });

  it.each([null, [], {}, { hourly: {} }, { hourly: { ...fixture.hourly, time: [] } }])(
    "returns null for malformed data %#", (value) => expect(summarizeOpenMeteo(value)).toBeNull(),
  );

  it.each([
    ["temperature_2m", null], ["temperature_2m", "9"], ["temperature_2m", Infinity],
    ["precipitation_probability", -1], ["precipitation_probability", 101],
    ["wind_speed_10m", -1], ["weather_code", 123], ["time", "not a time"],
  ])("returns null for invalid %s data %j", (field, invalid) => {
    const value = structuredClone(fixture);
    value.hourly[field][12] = invalid;
    expect(summarizeOpenMeteo(value)).toBeNull();
  });

  it("returns null for mismatched arrays or a missing daytime hour", () => {
    const value = structuredClone(fixture);
    value.hourly.temperature_2m.pop();
    expect(summarizeOpenMeteo(value)).toBeNull();
    const missing = structuredClone(fixture);
    missing.hourly.time[7] = missing.hourly.time[6];
    expect(summarizeOpenMeteo(missing)).toBeNull();
  });
});

describe("Open-Meteo weather source", () => {
  it("fetches one day with rounded coordinates, local time, a 5 s timeout and no redirects", async () => {
    const timeout = vi.spyOn(AbortSignal, "timeout");
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(response());
    await expect(new OpenMeteoWeatherSource(fetchImpl).today(at)).resolves.toEqual(summary);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [input, init] = fetchImpl.mock.calls[0]!;
    const url = new URL(String(input));
    expect(url.origin + url.pathname).toBe("https://api.open-meteo.com/v1/forecast");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      latitude: "52.52", longitude: "13.41", timezone: "auto", forecast_days: "1",
      hourly: "temperature_2m,precipitation_probability,wind_speed_10m,weather_code",
    });
    expect(init).toMatchObject({ redirect: "error", signal: expect.any(AbortSignal) });
    expect(timeout).toHaveBeenCalledWith(5000);
  });

  it.each([400, 429, 500])("returns null on HTTP %i without retrying", async (status) => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response("error", { status }));
    await expect(new OpenMeteoWeatherSource(fetchImpl).today(at)).resolves.toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("returns null on network or redirect failure without retrying", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockRejectedValueOnce(new TypeError("fetch failed"));
    await expect(new OpenMeteoWeatherSource(fetchImpl).today(at)).resolves.toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("stops a pending fetch after 5 seconds without retrying", async () => {
    vi.useFakeTimers();
    vi.spyOn(AbortSignal, "timeout").mockImplementation((ms) => {
      const controller = new AbortController();
      setTimeout(() => controller.abort(), ms);
      return controller.signal;
    });
    const fetchImpl = vi.fn<typeof fetch>((_input, init) => new Promise((_resolve, reject) => {
      init!.signal!.addEventListener("abort", () => reject(new DOMException("Timed out", "AbortError")), { once: true });
    }));
    const pending = new OpenMeteoWeatherSource(fetchImpl).today(at);
    await vi.advanceTimersByTimeAsync(5000);
    await expect(pending).resolves.toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("cancels a streamed body exceeding 256 KB, counting bytes rather than characters", async () => {
    const cancel = vi.fn();
    const body = new ReadableStream({
      start(controller) { controller.enqueue(new TextEncoder().encode("é".repeat(128_001))); },
      cancel,
    });
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(body));
    await expect(new OpenMeteoWeatherSource(fetchImpl).today(at)).resolves.toBeNull();
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it.each(["not json", "{}", "null"])("returns null for an unusable body %s", async (body) => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(body));
    await expect(new OpenMeteoWeatherSource(fetchImpl).today(at)).resolves.toBeNull();
  });
});

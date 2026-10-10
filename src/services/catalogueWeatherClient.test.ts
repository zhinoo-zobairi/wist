import { afterEach, describe, expect, it, vi } from "vitest";
import { loadWeather } from "./catalogueClient";

const at = { latitude: 52.52, longitude: 13.41 };
const weather = { minC: 6, maxC: 11, precipitationChancePct: 70, maxWindKph: 20, condition: "rain" };
const baseUrl = "http://catalogue.test/";
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

describe("weather client", () => {
  it("loads weather with owner auth and only coarse coordinates", async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(json({ weather }));
    await expect(loadWeather(at, fetchImpl, baseUrl, "owner")).resolves.toEqual(weather);
    expect(fetchImpl).toHaveBeenCalledExactlyOnceWith("http://catalogue.test/v1/weather?latitude=52.52&longitude=13.41", {
      headers: expect.objectContaining({ authorization: "Bearer owner" }), signal: expect.any(AbortSignal),
    });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("rounds even if given more precise coordinates", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(json({ weather }));
    await loadWeather({ latitude: 52.5249, longitude: 13.4051 }, fetchImpl, baseUrl, "owner");
    expect(fetchImpl.mock.calls[0]![0]).toBe("http://catalogue.test/v1/weather?latitude=52.52&longitude=13.41");
  });

  it.each([400, 401, 503])("maps HTTP %i to null without retrying", async (status) => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(json({ error: "raw_code" }, status));
    await expect(loadWeather(at, fetchImpl, baseUrl, "owner")).resolves.toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it.each([
    { weather: null }, {}, { weather: { ...weather, minC: "6" } },
    { weather: { ...weather, minC: 20 } }, { weather: { ...weather, precipitationChancePct: 101 } },
    { weather: { ...weather, maxWindKph: -1 } }, { weather: { ...weather, condition: "storm" } },
  ])("maps an unavailable or invalid summary to null %#", async (body) => {
    await expect(loadWeather(at, vi.fn<typeof fetch>().mockResolvedValueOnce(json(body)), baseUrl, "owner")).resolves.toBeNull();
  });

  it("maps a network error to null without retrying", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockRejectedValueOnce(new TypeError("offline"));
    await expect(loadWeather(at, fetchImpl, baseUrl, "owner")).resolves.toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("maps malformed JSON and missing owner configuration to null", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response("{"));
    await expect(loadWeather(at, fetchImpl, baseUrl, "owner")).resolves.toBeNull();
    await expect(loadWeather(at, fetchImpl, baseUrl, "")).resolves.toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("aborts a pending request at 10 seconds and returns null without retrying", async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn<typeof fetch>((_url, init) => new Promise((_resolve, reject) => {
      init!.signal!.addEventListener("abort", () => reject(new DOMException("Timed out", "AbortError")), { once: true });
    }));
    const pending = loadWeather(at, fetchImpl, baseUrl, "owner");
    await vi.advanceTimersByTimeAsync(9999);
    expect(fetchImpl.mock.calls[0]![1]!.signal!.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await expect(pending).resolves.toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
});

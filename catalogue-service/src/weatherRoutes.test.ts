import { describe, expect, it, vi } from "vitest";
import { handleRequest } from "./app.js";
import { SeedCatalogueRepository } from "./seedRepository.js";
import type { WeatherSource } from "./weather.js";

const catalogue = new SeedCatalogueRepository();
const auth = { ownerToken: "owner", authorization: "Bearer owner" };
const path = "/v1/weather?latitude=52.5249&longitude=13.4051";
const weather = { minC: 6, maxC: 11, precipitationChancePct: 70, maxWindKph: 20, condition: "rain" as const };

describe("weather API", () => {
  it("serves weather with owner auth and rounds coordinates before passing them to the source", async () => {
    const today = vi.fn<WeatherSource["today"]>().mockResolvedValueOnce(weather);
    await expect(handleRequest("GET", path, catalogue, auth, { weatherSource: { today } }))
      .resolves.toEqual({ status: 200, body: { weather } });
    expect(today).toHaveBeenCalledExactlyOnceWith({ latitude: 52.52, longitude: 13.41 });
  });

  it.each([{}, { ownerToken: "owner" }, { ownerToken: "owner", authorization: "Bearer wrong" }])(
    "requires configured owner authentication %#", async (requestAuth) => {
      const today = vi.fn<WeatherSource["today"]>();
      const result = await handleRequest("GET", path, catalogue, requestAuth, { weatherSource: { today } });
      expect(result.status).toBe(requestAuth.ownerToken ? 401 : 503);
      expect(today).not.toHaveBeenCalled();
    },
  );

  it.each([
    "", "?latitude=52", "?longitude=13", "?latitude=&longitude=13", "?latitude=52&longitude=%20",
    "?latitude=NaN&longitude=13", "?latitude=Infinity&longitude=13", "?latitude=90.01&longitude=13",
    "?latitude=-90.01&longitude=13", "?latitude=52&longitude=180.01", "?latitude=52&longitude=-180.01",
    "?latitude=0x10&longitude=13", "?latitude=52,48&longitude=13", "?latitude=52&latitude=48&longitude=13",
    "?latitude=52&longitude=13&longitude=12",
  ])("rejects invalid coordinates %s before calling the source", async (query) => {
    const today = vi.fn<WeatherSource["today"]>();
    await expect(handleRequest("GET", `/v1/weather${query}`, catalogue, auth, { weatherSource: { today } }))
      .resolves.toEqual({ status: 400, body: { error: "invalid_location" } });
    expect(today).not.toHaveBeenCalled();
  });

  it.each([[90, 180], [-90, -180], [0, 0]])("accepts inclusive coordinate bounds (%i, %i)", async (latitude, longitude) => {
    const today = vi.fn<WeatherSource["today"]>().mockResolvedValueOnce(weather);
    await expect(handleRequest("GET", `/v1/weather?latitude=${latitude}&longitude=${longitude}`, catalogue, auth,
      { weatherSource: { today } })).resolves.toEqual({ status: 200, body: { weather } });
    expect(today).toHaveBeenCalledExactlyOnceWith({ latitude, longitude });
  });

  it("returns unavailable weather as null, including when no source is configured", async () => {
    await expect(handleRequest("GET", path, catalogue, auth))
      .resolves.toEqual({ status: 200, body: { weather: null } });
    const today = vi.fn<WeatherSource["today"]>().mockResolvedValueOnce(null);
    await expect(handleRequest("GET", path, catalogue, auth, { weatherSource: { today } }))
      .resolves.toEqual({ status: 200, body: { weather: null } });
  });

  it("also fails open if a weather source unexpectedly throws", async () => {
    const today = vi.fn<WeatherSource["today"]>().mockRejectedValueOnce(new Error("unavailable"));
    await expect(handleRequest("GET", path, catalogue, auth, { weatherSource: { today } }))
      .resolves.toEqual({ status: 200, body: { weather: null } });
  });

  it.each(["POST", "PUT", "DELETE"])("refuses %s without calling the source", async (method) => {
    const today = vi.fn<WeatherSource["today"]>();
    await expect(handleRequest(method, path, catalogue, auth, { weatherSource: { today } }))
      .resolves.toEqual({ status: 405, body: { error: "method_not_allowed" } });
    expect(today).not.toHaveBeenCalled();
  });
});

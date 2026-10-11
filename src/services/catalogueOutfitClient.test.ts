import { describe, expect, it, vi } from "vitest";
import type { Garment } from "../types";
import { loadOutfits, removeSavedOutfit, requestMoreIdeas, saveLocation, saveOutfitIdea } from "./catalogueClient";

const baseUrl = "http://catalogue.test/";
const garment: Garment = {
  id: "01234567-1234-1234-1234-012345678901", name: "Navy shirt", category: "top", colors: ["navy"], formality: "smart_casual",
  warmth: "light", occasions: ["work"], notes: null, source: "manual", catalogueItemId: null, tagStatus: "tagged", photoUrl: null,
  createdAt: "2026-10-10T10:00:00.000Z", updatedAt: "2026-10-10T10:00:00.000Z",
};
const trousers: Garment = { ...garment, id: "01234567-1234-1234-1234-012345678902", name: "Cream trousers", category: "bottom" };
const status = { pending: false, running: false, lastRunAt: null, lastRunStatus: null, runsLeftToday: 12, generationEnabled: true };
const idea = { id: "s1", occasion: "work", reason: "Polished.", createdAt: "2026-10-10T10:00:00.000Z", garments: [garment, trousers] };
const saved = { id: "v1", occasion: "work", reason: "Kept.", savedAt: "2026-10-10T11:00:00.000Z", garments: [garment], missingGarmentIds: ["01234567-1234-1234-1234-012345678902"] };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const weather = { minC: 6, maxC: 11, precipitationChancePct: 70, maxWindKph: 20, condition: "rain" };
const today = { day: "2026-10-11", weather, order: ["s1", "v1"], reasons: { s1: "Warm enough for the rain." } };

describe("outfit client", () => {
  it("loads ideas, saved outfits and status with owner auth", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(json({ suggestions: [idea], saved: [saved], status }));
    await expect(loadOutfits(fetchImpl, baseUrl, "owner")).resolves.toEqual({ suggestions: [idea], saved: [saved], status, today: null });
    expect(fetchImpl).toHaveBeenCalledWith("http://catalogue.test/v1/outfits", {
      headers: expect.objectContaining({ authorization: "Bearer owner" }),
    });
  });

  it.each([
    { suggestions: [{ ...idea, garments: [garment] }], saved: [], status },
    { suggestions: [{ ...idea, occasion: "gala" }], saved: [], status },
    { suggestions: [], saved: [{ ...saved, missingGarmentIds: [1] }], status },
    { suggestions: [], saved: [], status: { ...status, pending: "yes" } },
  ])("rejects an invalid board %#", async (body) => {
    await expect(loadOutfits(vi.fn<typeof fetch>().mockResolvedValueOnce(json(body)), baseUrl, "owner")).rejects.toThrow();
  });

  it.each([-1, 1.5, null, "3"])("rejects runsLeftToday %j", async (runsLeftToday) => {
    const body = { suggestions: [], saved: [], status: { ...status, runsLeftToday } };
    await expect(loadOutfits(vi.fn<typeof fetch>().mockResolvedValueOnce(json(body)), baseUrl, "owner")).rejects.toThrow();
  });

  it("drops unknown status fields", async () => {
    const body = { suggestions: [], saved: [], status: { ...status, extra: "x" } };
    const board = await loadOutfits(vi.fn<typeof fetch>().mockResolvedValueOnce(json(body)), baseUrl, "owner");
    expect(board.status).toEqual(status);
  });

  it("saves an idea and removes a saved outfit", async () => {
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json({ saved }, 201))
      .mockResolvedValueOnce(json({ id: "v1", deleted: true }));
    await expect(saveOutfitIdea("s1", fetchImpl, baseUrl, "owner")).resolves.toEqual(saved);
    expect(fetchImpl.mock.calls[0]).toEqual(["http://catalogue.test/v1/outfits/saved", expect.objectContaining({
      method: "POST", body: JSON.stringify({ suggestionId: "s1" }),
    })]);
    await expect(removeSavedOutfit("v1", fetchImpl, baseUrl, "owner")).resolves.toBeUndefined();
    expect(fetchImpl.mock.calls[1]![0]).toBe("http://catalogue.test/v1/outfits/saved/v1");
  });

  it.each([
    [json({ queued: true }, 202), "queued"],
    [json({ error: "daily_limit_reached" }, 429), "daily_limit_reached"],
    [json({ error: "wardrobe_too_small" }, 422), "wardrobe_too_small"],
    [json({ error: "outfits_not_configured" }, 503), "unavailable"],
  ] as const)("maps More ideas responses %#", async (response, expected) => {
    await expect(requestMoreIdeas(vi.fn<typeof fetch>().mockResolvedValueOnce(response), baseUrl, "owner"))
      .resolves.toBe(expected);
  });

  it.each([[401, "unauthorized"], [503, "outfits_not_configured"]])("loadOutfits throws on status %i", async (code, error) => {
    await expect(loadOutfits(vi.fn<typeof fetch>().mockResolvedValueOnce(json({ error }, code)), baseUrl, "owner"))
      .rejects.toMatchObject({ status: code });
  });

  it("loadOutfits throws on a network error", async () => {
    await expect(loadOutfits(vi.fn<typeof fetch>().mockRejectedValueOnce(new TypeError("offline")), baseUrl, "owner"))
      .rejects.toThrow("offline");
  });

  it("saveOutfitIdea throws on a 404", async () => {
    await expect(saveOutfitIdea("gone", vi.fn<typeof fetch>().mockResolvedValueOnce(json({ error: "not_found" }, 404)), baseUrl, "owner"))
      .rejects.toMatchObject({ status: 404 });
  });

  it("maps a network failure on More ideas to unavailable", async () => {
    await expect(requestMoreIdeas(vi.fn<typeof fetch>().mockRejectedValueOnce(new TypeError("offline")), baseUrl, "owner"))
      .resolves.toBe("unavailable");
  });

  it("reads today's pick with the board", async () => {
    const body = { suggestions: [idea], saved: [saved], status, today };
    await expect(loadOutfits(vi.fn<typeof fetch>().mockResolvedValueOnce(json(body)), baseUrl, "owner"))
      .resolves.toEqual({ suggestions: [idea], saved: [saved], status, today });
  });

  it.each([
    undefined, null, [], { ...today, day: 11 }, { ...today, day: "11 October" }, { ...today, order: [1] },
    { ...today, order: "s1" }, { ...today, reasons: [] }, { ...today, reasons: { s1: 2 } },
    { ...today, reasons: { s1: "x".repeat(201) } }, { ...today, weather: null }, { ...today, weather: { ...weather, minC: 20 } },
    { ...today, weather: { ...weather, precipitationChancePct: 101 } }, { ...today, weather: { ...weather, condition: "storm" } },
  ])("treats a missing or invalid pick %# as not ready without failing the board", async (value) => {
    const body = { suggestions: [], saved: [], status, today: value };
    await expect(loadOutfits(vi.fn<typeof fetch>().mockResolvedValueOnce(json(body)), baseUrl, "owner"))
      .resolves.toMatchObject({ today: null });
  });

  it("saves only the rounded location with owner auth and clears its timer", async () => {
    vi.useFakeTimers();
    try {
      const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(null, { status: 204 }));
      await expect(saveLocation({ latitude: 52.5249, longitude: 13.4051 }, fetchImpl, baseUrl, "owner")).resolves.toBeUndefined();
      expect(fetchImpl).toHaveBeenCalledExactlyOnceWith("http://catalogue.test/v1/location", {
        method: "PUT", body: JSON.stringify({ latitude: 52.52, longitude: 13.41 }),
        headers: expect.objectContaining({ authorization: "Bearer owner", "content-type": "application/json" }),
        signal: expect.any(AbortSignal),
      });
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("throws once, without retrying, when the location is refused or the network fails", async () => {
    const at = { latitude: 52.52, longitude: 13.41 };
    const refused = vi.fn<typeof fetch>().mockResolvedValueOnce(json({ error: "invalid_location" }, 400));
    await expect(saveLocation(at, refused, baseUrl, "owner")).rejects.toMatchObject({ status: 400, code: "invalid_location" });
    const offline = vi.fn<typeof fetch>().mockRejectedValueOnce(new TypeError("offline"));
    await expect(saveLocation(at, offline, baseUrl, "owner")).rejects.toThrow("offline");
    expect(refused).toHaveBeenCalledTimes(1);
    expect(offline).toHaveBeenCalledTimes(1);
  });

  it("aborts a pending location save at 10 seconds without retrying (owner answer 1)", async () => {
    vi.useFakeTimers();
    try {
      const fetchImpl = vi.fn<typeof fetch>((_url, init) => new Promise((_resolve, reject) => {
        init!.signal!.addEventListener("abort", () => reject(new DOMException("Timed out", "AbortError")), { once: true });
      }));
      const pending = saveLocation({ latitude: 52.52, longitude: 13.41 }, fetchImpl, baseUrl, "owner");
      const settled = expect(pending).rejects.toMatchObject({ name: "AbortError" });
      await vi.advanceTimersByTimeAsync(9999);
      expect(fetchImpl.mock.calls[0]![1]!.signal!.aborted).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      await settled;
      expect(fetchImpl).toHaveBeenCalledTimes(1);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});

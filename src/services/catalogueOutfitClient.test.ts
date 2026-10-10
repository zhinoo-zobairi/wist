import { afterEach, describe, expect, it, vi } from "vitest";
import type { Garment, SuggestedOutfit } from "../types";
import { suggestOutfits } from "./catalogueClient";

const baseUrl = "http://catalogue.test/";
const context = { occasion: "evening" as const };
const garment: Garment = {
  id: "01234567-1234-1234-1234-012345678901", name: "Navy shirt", category: "top",
  colors: ["navy"], formality: "smart_casual", warmth: "light", occasions: ["evening"],
  notes: null, source: "photo", tagStatus: "tagged",
  photoUrl: "/v1/wardrobe/01234567-1234-1234-1234-012345678901/photo",
  createdAt: "2026-10-10T10:00:00.000Z", updatedAt: "2026-10-10T10:00:00.000Z",
};
const trousers: Garment = { ...garment, id: "01234567-1234-1234-1234-012345678902", name: "Cream trousers", category: "bottom", source: "manual", photoUrl: null };
const outfit: SuggestedOutfit = { garments: [garment, trousers], reason: "Polished tones for the evening." };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const request = (fetchImpl: typeof fetch, signal?: AbortSignal, token = "owner") =>
  suggestOutfits(context, signal, fetchImpl, baseUrl, token);

afterEach(() => vi.useRealTimers());

describe("outfit suggestion client", () => {
  it("posts only the occasion with owner auth and parses full garment records", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(json({ outfits: [outfit] }));
    await expect(request(fetchImpl)).resolves.toEqual({ ok: true, outfits: [outfit] });
    expect(fetchImpl).toHaveBeenCalledWith("http://catalogue.test/v1/outfits/suggestions", {
      method: "POST", body: JSON.stringify({ context }), signal: expect.any(AbortSignal),
      headers: { accept: "application/json", authorization: "Bearer owner", "content-type": "application/json" },
    });
  });

  it("accepts three outfits with six unique owned garments each", async () => {
    const garments = Array.from({ length: 6 }, (_, index) => ({ ...trousers,
      id: `01234567-1234-1234-1234-01234567890${index}`,
    }));
    const outfits = Array.from({ length: 3 }, () => ({ garments, reason: "Suitable layers." }));
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(json({ outfits }));
    await expect(request(fetchImpl)).resolves.toEqual({ ok: true, outfits });
  });

  it("maps the specific too-small error to the wardrobe action", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(json({ error: "wardrobe_too_small" }, 422));
    await expect(request(fetchImpl)).resolves.toEqual({ ok: false, reason: "wardrobe_too_small" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it.each([
    [502, "suggestion_failed"], [503, "outfits_not_configured"], [401, "unauthorized"],
    [400, "invalid_outfit_request"], [422, "other_failure"], [500, "internal_error"],
  ])("maps HTTP %s / %s to unavailable without retrying", async (status, error) => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(json({ error }, status));
    await expect(request(fetchImpl)).resolves.toEqual({ ok: false, reason: "unavailable" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("maps network loss and non-JSON responses to unavailable", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockRejectedValueOnce(new TypeError("Network request failed"));
    await expect(request(fetchImpl)).resolves.toEqual({ ok: false, reason: "unavailable" });
    fetchImpl.mockResolvedValueOnce(new Response("not JSON"));
    await expect(request(fetchImpl)).resolves.toEqual({ ok: false, reason: "unavailable" });
    fetchImpl.mockResolvedValueOnce(new Response("upstream down", { status: 502 }));
    await expect(request(fetchImpl)).resolves.toEqual({ ok: false, reason: "unavailable" });
  });

  it.each([
    {}, { outfits: [] }, { outfits: Array(4).fill(outfit) }, { outfits: [null] },
    { outfits: [{ ...outfit, garments: [garment] }] },
    { outfits: [{ ...outfit, garments: [garment, garment] }] },
    { outfits: [{ ...outfit, garments: [garment, { ...trousers, tagStatus: "failed" }] }] },
    { outfits: [{ ...outfit, garments: [garment, { ...trousers, category: "unknown" }] }] },
    { outfits: [{ ...outfit, garments: [garment, { ...trousers, photoUrl: "https://example.com/photo" }] }] },
    { outfits: [{ ...outfit, reason: " " }] },
    { outfits: [{ ...outfit, reason: "x".repeat(201) }] },
  ])("rejects invalid suggestions without exposing a partial outfit: %j", async (body) => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(json(body));
    await expect(request(fetchImpl)).resolves.toEqual({ ok: false, reason: "unavailable" });
  });

  it("aborts at exactly 120 seconds, with no automatic retry and no remaining timer", async () => {
    vi.useFakeTimers();
    let requestSignal: AbortSignal | undefined;
    const fetchImpl = vi.fn<typeof fetch>().mockImplementationOnce(async (_url, options) => {
      requestSignal = options?.signal ?? undefined;
      return new Promise((_resolve, reject) => {
        requestSignal?.addEventListener("abort", () => reject(new Error("AbortError")));
      });
    });
    const result = request(fetchImpl);
    await vi.advanceTimersByTimeAsync(119_999);
    expect(requestSignal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await expect(result).resolves.toEqual({ ok: false, reason: "unavailable" });
    expect(requestSignal?.aborted).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("cancels when the screen leaves and removes its timer/listener", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const removeListener = vi.spyOn(controller.signal, "removeEventListener");
    const fetchImpl = vi.fn<typeof fetch>().mockImplementationOnce(async (_url, options) =>
      new Promise((_resolve, reject) => options?.signal?.addEventListener("abort", () => reject(new Error("AbortError")))),
    );
    const result = request(fetchImpl, controller.signal);
    controller.abort();
    await expect(result).resolves.toEqual({ ok: false, reason: "cancelled" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
    expect(removeListener).toHaveBeenCalledWith("abort", expect.any(Function));
  });

  it("sends nothing for an already-cancelled screen or missing owner token", async () => {
    const controller = new AbortController();
    controller.abort();
    const fetchImpl = vi.fn<typeof fetch>();
    await expect(request(fetchImpl, controller.signal)).resolves.toEqual({ ok: false, reason: "cancelled" });
    await expect(request(fetchImpl, undefined, "")).resolves.toEqual({ ok: false, reason: "unavailable" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each(["timeout", "cancel"])("ignores a response delivered after %s even if fetch ignores abort", async (mode) => {
    vi.useFakeTimers();
    const controller = new AbortController();
    let finish!: (response: Response) => void;
    const fetchImpl = vi.fn<typeof fetch>().mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const result = request(fetchImpl, controller.signal);
    if (mode === "cancel") controller.abort();
    else await vi.advanceTimersByTimeAsync(120_000);
    finish(json({ outfits: [outfit] }));
    await expect(result).resolves.toEqual({ ok: false, reason: mode === "cancel" ? "cancelled" : "unavailable" });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("clears the timer on both success and HTTP failure; repeated calls are explicit", async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(json({ outfits: [outfit] }))
      .mockResolvedValueOnce(json({ error: "suggestion_failed" }, 502));
    await request(fetchImpl);
    expect(vi.getTimerCount()).toBe(0);
    await request(fetchImpl);
    expect(vi.getTimerCount()).toBe(0);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});

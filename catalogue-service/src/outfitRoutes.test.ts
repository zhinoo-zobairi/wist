import { afterEach, describe, expect, it, vi } from "vitest";
import { handleRequest, type RequestOptions } from "./app.js";
import { DAILY_RUN_CAP } from "./outfitSchedule.js";
import type { OutfitSuggester } from "./outfitSuggester.js";
import { SeedCatalogueRepository } from "./seedRepository.js";
import { SqliteOutfitRepository } from "./sqliteOutfitRepository.js";
import { SqliteWardrobeRepository } from "./sqliteWardrobeRepository.js";
import type { GarmentInput } from "./wardrobe.js";

const auth = { ownerToken: "owner", authorization: "Bearer owner" };
const catalogue = new SeedCatalogueRepository();
const input: GarmentInput = { name: "Shirt", category: "top", colors: ["navy"], formality: "smart_casual", warmth: "light", occasions: ["work"], notes: null };
const closers: { close: () => void }[] = [];

function setup() {
  const wardrobe = new SqliteWardrobeRepository(":memory:");
  const outfits = new SqliteOutfitRepository(":memory:");
  closers.push(wardrobe, outfits);
  const suggester: OutfitSuggester = { suggest: vi.fn() };
  const request = (method: string, path: string, options: RequestOptions = {}) =>
    handleRequest(method, path, catalogue, auth, { wardrobe, outfits, suggester, ...options });
  const populate = async () => {
    const ids: string[] = [];
    for (const category of ["top", "bottom", "shoes"] as const) ids.push((await wardrobe.createGarment({ ...input, category }, "manual")).id);
    return ids;
  };
  return { wardrobe, outfits, request, populate };
}

describe("outfits API", () => {
  afterEach(() => { closers.splice(0).forEach((c) => c.close()); vi.restoreAllMocks(); });

  it("requires the owner token on every route", async () => {
    const { wardrobe, outfits } = setup();
    for (const [method, path] of [["GET", "/v1/outfits"], ["POST", "/v1/outfits/more"], ["POST", "/v1/outfits/saved"], ["DELETE", "/v1/outfits/saved/x"]]) {
      await expect(handleRequest(method!, path!, catalogue, { ownerToken: "owner", authorization: "Bearer wrong" }, { wardrobe, outfits }))
        .resolves.toEqual({ status: 401, body: { error: "unauthorized" } });
    }
  });

  it("returns stored suggestions and saved outfits instantly with full garments", async () => {
    const { outfits, request, populate, wardrobe } = setup();
    const [a, b, c] = await populate();
    await outfits.storeSuggestions([
      { occasion: "work", garmentIds: [a!, b!], reason: "Keep." },
      { occasion: "work", garmentIds: [a!, c!], reason: "Idea." },
    ]);
    const keep = (await outfits.listSuggestions()).find((s) => s.reason === "Keep.")!;
    await outfits.saveSuggestion(keep.id);
    await wardrobe.deleteGarment(b!);

    const result = await request("GET", "/v1/outfits");
    expect(result.status).toBe(200);
    const body = result.body as { suggestions: { reason: string; garments: { id: string }[] }[]; saved: { reason: string; garments: { id: string }[]; missingGarmentIds: string[] }[]; status: Record<string, unknown> };
    expect(body.suggestions.map((s) => [s.reason, s.garments.map((g) => g.id)])).toEqual([["Idea.", [a, c]]]);
    expect(body.saved.map((s) => [s.reason, s.garments.map((g) => g.id), s.missingGarmentIds])).toEqual([["Keep.", [a], [b]]]);
    expect(body.status).toEqual({
      pending: true, running: false, lastRunAt: null, lastRunStatus: null, runsLeftToday: DAILY_RUN_CAP, generationEnabled: true,
    });
  });

  it("reports generation as disabled and never pending without a suggester (decision 12)", async () => {
    const { request, populate } = setup();
    await populate();
    const result = await request("GET", "/v1/outfits", { suggester: undefined });
    expect((result.body as { status: { pending: boolean; generationEnabled: boolean } }).status)
      .toMatchObject({ pending: false, generationEnabled: false });
  });

  it("saves a suggestion and removes a saved outfit", async () => {
    const { outfits, request, populate } = setup();
    const [a, b] = await populate();
    await outfits.storeSuggestions([{ occasion: "work", garmentIds: [a!, b!], reason: "Keep." }]);
    const [suggestion] = await outfits.listSuggestions();
    const saved = await request("POST", "/v1/outfits/saved", { body: JSON.stringify({ suggestionId: suggestion!.id }) });
    expect(saved).toMatchObject({ status: 201, body: { saved: { reason: "Keep.", missingGarmentIds: [] } } });
    await expect(request("POST", "/v1/outfits/saved", { body: JSON.stringify({ suggestionId: suggestion!.id }) }))
      .resolves.toEqual({ status: 404, body: { error: "suggestion_not_found" } });
    await expect(request("POST", "/v1/outfits/saved", { body: "{" }))
      .resolves.toEqual({ status: 400, body: { error: "invalid_saved_outfit_request" } });

    const savedId = (saved.body as { saved: { id: string } }).saved.id;
    await expect(request("DELETE", `/v1/outfits/saved/${savedId}`))
      .resolves.toEqual({ status: 200, body: { id: savedId, deleted: true } });
    await expect(request("DELETE", `/v1/outfits/saved/${savedId}`))
      .resolves.toEqual({ status: 404, body: { error: "saved_outfit_not_found" } });
  });

  it("queues More ideas within the cap and refuses it otherwise", async () => {
    const { outfits, request, populate } = setup();
    await expect(request("POST", "/v1/outfits/more")).resolves.toEqual({ status: 422, body: { error: "wardrobe_too_small" } });
    await expect(request("POST", "/v1/outfits/more", { suggester: undefined }))
      .resolves.toEqual({ status: 503, body: { error: "outfits_not_configured" } });
    await populate();
    await expect(request("POST", "/v1/outfits/more", { suggester: undefined }))
      .resolves.toEqual({ status: 503, body: { error: "outfits_not_configured" } });
    await expect(request("POST", "/v1/outfits/more")).resolves.toEqual({ status: 202, body: { queued: true } });
    await expect(outfits.moreIdeasRequested()).resolves.toBe(true);
    for (let index = 0; index < DAILY_RUN_CAP; index += 1) {
      await outfits.finishRun(await outfits.startRun("debounced", null), "succeeded", 0, null);
    }
    await expect(request("POST", "/v1/outfits/more")).resolves.toEqual({ status: 429, body: { error: "daily_limit_reached" } });
  });

  it("no longer serves the waiting endpoint (decision 11)", async () => {
    const { request } = setup();
    await expect(request("POST", "/v1/outfits/suggestions")).resolves.toEqual({ status: 404, body: { error: "not_found" } });
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { handleRequest, type RequestOptions } from "./app.js";
import type { OutfitSuggester } from "./outfitSuggester.js";
import { SeedCatalogueRepository } from "./seedRepository.js";
import { SqliteStyleProfileRepository } from "./sqliteStyleProfileRepository.js";
import { SqliteWardrobeRepository } from "./sqliteWardrobeRepository.js";
import type { Garment, GarmentInput } from "./wardrobe.js";

const auth = { ownerToken: "owner", authorization: "Bearer owner" };
const catalogue = new SeedCatalogueRepository();
const path = "/v1/outfits/suggestions";
const body = JSON.stringify({ context: { occasion: "work" } });
const input: GarmentInput = { name: "Shirt", category: "top", colors: ["navy"], formality: "smart_casual", warmth: "light", occasions: ["work"], notes: null };

describe("outfit suggestions API", () => {
  const repositories: { close: () => void }[] = [];
  afterEach(() => { repositories.splice(0).forEach((repo) => repo.close()); vi.restoreAllMocks(); });
  function setup() {
    const wardrobe = new SqliteWardrobeRepository(":memory:");
    const profiles = new SqliteStyleProfileRepository(":memory:");
    repositories.push(wardrobe, profiles);
    const suggest = vi.fn<OutfitSuggester["suggest"]>();
    const request = (options: RequestOptions = {}, method = "POST") =>
      handleRequest(method, path, catalogue, auth, { body, wardrobe, profiles, suggester: { suggest }, ...options });
    const populate = async () => {
      const garments = [];
      for (const category of ["top", "bottom", "shoes"] as const) {
        garments.push(await wardrobe.createGarment({ ...input, category }, "manual"));
      }
      return garments;
    };
    return { wardrobe, profiles, suggest, request, populate };
  }

  it("authenticates before reading wardrobe or calling the model", async () => {
    const { wardrobe, profiles, suggest } = setup();
    const list = vi.spyOn(wardrobe, "listGarments");
    for (const authorization of [undefined, "Bearer wrong"]) {
      await expect(handleRequest("POST", path, catalogue, { ownerToken: "owner", authorization }, { body, wardrobe, profiles, suggester: { suggest } }))
        .resolves.toEqual({ status: 401, body: { error: "unauthorized" } });
    }
    expect(list).not.toHaveBeenCalled();
    expect(suggest).not.toHaveBeenCalled();
  });

  it("reports missing owner, repositories, or model configuration", async () => {
    const { request, suggest } = setup();
    await expect(handleRequest("POST", path, catalogue)).resolves.toEqual({ status: 503, body: { error: "outfits_not_configured" } });
    for (const options of [{ wardrobe: undefined }, { profiles: undefined }, { suggester: undefined }]) {
      await expect(request(options)).resolves.toEqual({ status: 503, body: { error: "outfits_not_configured" } });
    }
    expect(suggest).not.toHaveBeenCalled();
  });

  it.each([undefined, "{", "null", "[]", "{}", '{"context":{"occasion":"gym"}}'])("rejects malformed request %s without inference", async (body) => {
    const { request, suggest } = setup();
    await expect(request({ body })).resolves.toEqual({ status: 400, body: { error: "invalid_outfit_request" } });
    expect(suggest).not.toHaveBeenCalled();
  });
  it("preserves body limits, method handling, and unrelated-route 404", async () => {
    const { request, suggest } = setup();
    await expect(request({ bodyTooLarge: true })).resolves.toEqual({ status: 413, body: { error: "payload_too_large" } });
    for (const method of ["GET", "PUT", "DELETE", "PATCH"]) {
      await expect(request({}, method)).resolves.toEqual({ status: 405, body: { error: "method_not_allowed" } });
    }
    await expect(handleRequest("GET", `${path}/unknown`, catalogue, auth)).resolves.toMatchObject({ status: 404 });
    expect(suggest).not.toHaveBeenCalled();
  });

  it("requires three tagged records, ignoring untagged and failed photos", async () => {
    const { request, wardrobe, suggest } = setup();
    await wardrobe.createGarment(input, "manual");
    await wardrobe.createGarment(input, "manual");
    await wardrobe.createPhotoGarment("image/jpeg");
    const failed = await wardrobe.createPhotoGarment("image/jpeg");
    await wardrobe.markTagFailed(failed.id);
    await expect(request()).resolves.toEqual({ status: 422, body: { error: "wardrobe_too_small" } });
    expect(suggest).not.toHaveBeenCalled();
  });

  it("passes tagged records, profile, and context and expands only valid owned IDs", async () => {
    const { request, populate, wardrobe, profiles, suggest } = setup();
    const garments = await populate();
    const untagged = await wardrobe.createPhotoGarment("image/jpeg");
    const profile = await profiles.replaceProfile({ occasions: ["work"], styles: ["minimal"] });
    suggest.mockResolvedValue({ ok: true, outfits: [
      { garmentIds: [garments[0]!.id, "invented"], reason: "Invalid" },
      { garmentIds: [garments[0]!.id, untagged.id], reason: "Untagged" },
      { garmentIds: [garments[0]!.id, garments[0]!.id], reason: "Duplicate" },
      { garmentIds: [garments[0]!.id, garments[1]!.id], reason: "x".repeat(220) },
    ] });
    await expect(request()).resolves.toEqual({ status: 200, body: { outfits: [{
      garments: [garments[0], garments[1]], reason: "x".repeat(200),
    }] } });
    expect(suggest).toHaveBeenCalledWith({ garments: expect.arrayContaining(garments), profile, context: { occasion: "work" } });
    expect(suggest.mock.calls[0]![0].garments).toHaveLength(3);
  });

  it("supports absent style profile and performs new inference for every request", async () => {
    const { request, populate, suggest } = setup();
    const garments = await populate();
    suggest.mockResolvedValue({ ok: true, outfits: Array(5).fill({ garmentIds: [garments[0]!.id, garments[1]!.id], reason: "Suitable." }) });
    for (let i = 0; i < 2; i++) {
      const result = await request();
      expect(result.status).toBe(200);
      expect((result.body as { outfits: unknown[] }).outfits).toHaveLength(3);
    }
    expect(suggest).toHaveBeenCalledTimes(2);
    expect(suggest.mock.calls[0]![0].profile).toBeNull();
  });

  it.each(["refused", "invalid_output", "api_error"] as const)("maps model failure %s to 502", async (reason) => {
    const { request, populate, suggest } = setup();
    await populate();
    suggest.mockResolvedValue({ ok: false, reason });
    await expect(request()).resolves.toEqual({ status: 502, body: { error: "suggestion_failed" } });
  });
  it("returns 502 when all outfits are dropped, empty, or the injected suggester throws", async () => {
    const { request, populate, suggest } = setup();
    await populate();
    for (const outfits of [[], [{ garmentIds: ["unknown", "other"], reason: "Invalid" }]]) {
      suggest.mockResolvedValueOnce({ ok: true, outfits });
      await expect(request()).resolves.toEqual({ status: 502, body: { error: "suggestion_failed" } });
    }
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    suggest.mockRejectedValueOnce(new Error("private-provider-payload"));
    await expect(request()).resolves.toEqual({ status: 502, body: { error: "suggestion_failed" } });
    expect(JSON.stringify(log.mock.calls)).not.toContain("private-provider-payload");
  });

  it("does not return a garment deleted during inference", async () => {
    const { request, populate, wardrobe, suggest } = setup();
    const garments = await populate();
    suggest.mockImplementationOnce(async () => {
      await wardrobe.deleteGarment(garments[0]!.id);
      return { ok: true, outfits: [{ garmentIds: [garments[0]!.id, garments[1]!.id], reason: "Stale" }] };
    });
    await expect(request()).resolves.toEqual({ status: 502, body: { error: "suggestion_failed" } });
  });

  it("returns current owned attributes after an edit made during inference", async () => {
    const { request, populate, wardrobe, suggest } = setup();
    const garments = await populate();
    suggest.mockImplementationOnce(async () => {
      await wardrobe.replaceGarment(garments[0]!.id, { ...input, name: "Edited shirt" });
      return { ok: true, outfits: [{ garmentIds: [garments[0]!.id, garments[1]!.id], reason: "Suitable" }] };
    });
    const result = await request();
    expect((result.body as { outfits: { garments: Garment[] }[] }).outfits[0]!.garments[0]!.name).toBe("Edited shirt");
  });

  it("rejects IDs added after the prompt snapshot even if they now belong to the owner", async () => {
    const { request, populate, wardrobe, suggest } = setup();
    const garments = await populate();
    suggest.mockImplementationOnce(async () => {
      const newGarment = await wardrobe.createGarment(input, "manual");
      return { ok: true, outfits: [{ garmentIds: [newGarment.id, garments[0]!.id], reason: "Not in prompt" }] };
    });
    await expect(request()).resolves.toEqual({ status: 502, body: { error: "suggestion_failed" } });
  });
});

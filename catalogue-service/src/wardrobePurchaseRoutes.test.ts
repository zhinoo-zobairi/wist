import { afterEach, describe, expect, it, vi } from "vitest";
import { handleRequest, type RequestOptions } from "./app.js";
import { SeedCatalogueRepository } from "./seedRepository.js";
import { SqliteWardrobeRepository } from "./sqliteWardrobeRepository.js";
import { WardrobeFullError } from "./wardrobeRepository.js";
import type { Garment, GarmentInput } from "./wardrobe.js";
import type { GarmentTagger } from "./garmentTagger.js";

const auth = { authorization: "Bearer owner", ownerToken: "owner" };
const itemId = "sezane-wool-coat";
const input: GarmentInput = {
  name: "Camel wool coat", category: "outerwear", colors: ["camel"],
  formality: "smart_casual", warmth: "heavy", occasions: ["work"], notes: null,
};
const body = JSON.stringify({ itemId });

describe("purchased garment API", () => {
  const repositories: SqliteWardrobeRepository[] = [];
  afterEach(() => {
    repositories.splice(0).forEach((repository) => repository.close());
    vi.restoreAllMocks();
  });
  function setup() {
    const catalogue = new SeedCatalogueRepository();
    const wardrobe = new SqliteWardrobeRepository(":memory:");
    repositories.push(wardrobe);
    const request = (options: RequestOptions = {}, path = "/v1/wardrobe/from-item", method = "POST") =>
      handleRequest(method, path, catalogue, auth, { wardrobe, body, ...options });
    return { catalogue, wardrobe, request };
  }

  it("requires owner authentication", async () => {
    const { catalogue, wardrobe } = setup();
    await expect(handleRequest("POST", "/v1/wardrobe/from-item", catalogue, { ownerToken: "owner" }, { wardrobe, body }))
      .resolves.toMatchObject({ status: 401 });
    await expect(wardrobe.countGarments()).resolves.toBe(0);
  });

  it.each([undefined, "{", "null", "[]", "{}", '{"itemId":1}', '{"itemId":""}'])("rejects invalid purchase body %s", async (body) => {
    const { request, wardrobe } = setup();
    await expect(request({ body })).resolves.toEqual({ status: 400, body: { error: "invalid_purchase_request" } });
    await expect(wardrobe.countGarments()).resolves.toBe(0);
  });

  it("rejects oversized bodies and unsupported methods", async () => {
    const { request } = setup();
    await expect(request({ bodyTooLarge: true })).resolves.toMatchObject({ status: 413 });
    for (const method of ["GET", "PUT", "DELETE"]) {
      await expect(request({}, undefined, method)).resolves.toMatchObject({ status: 405 });
    }
  });

  it("returns item_not_found without creating, tagging or unwatching", async () => {
    const { catalogue, wardrobe, request } = setup();
    const unwatch = vi.spyOn(catalogue, "unwatchItem");
    const tag = vi.fn<GarmentTagger["tag"]>();
    await expect(request({ body: '{"itemId":"missing"}', tagger: { tag } }))
      .resolves.toEqual({ status: 404, body: { error: "item_not_found" } });
    expect(tag).not.toHaveBeenCalled();
    expect(unwatch).not.toHaveBeenCalled();
    await expect(wardrobe.countGarments()).resolves.toBe(0);
  });

  it("enforces the existing cap at the precheck and transaction-time race", async () => {
    const { request, wardrobe, catalogue } = setup();
    const tag = vi.fn<GarmentTagger["tag"]>();
    const unwatch = vi.spyOn(catalogue, "unwatchItem");
    const count = vi.spyOn(wardrobe, "countGarments").mockResolvedValue(300);
    await expect(request({ tagger: { tag } })).resolves.toEqual({ status: 409, body: { error: "wardrobe_full" } });
    count.mockResolvedValue(299);
    vi.spyOn(wardrobe, "createPurchaseGarment").mockRejectedValue(new WardrobeFullError());
    await expect(request({ tagger: { tag } })).resolves.toEqual({ status: 409, body: { error: "wardrobe_full" } });
    expect(tag).not.toHaveBeenCalled();
    expect(unwatch).not.toHaveBeenCalled();
  });

  it("keeps the cap under concurrent purchase requests that both pass the precheck", async () => {
    const { request, wardrobe, catalogue } = setup();
    for (let index = 0; index < 299; index += 1) await wardrobe.createGarment(input, "manual");
    const unwatch = vi.spyOn(catalogue, "unwatchItem");
    const results = await Promise.all([request(), request()]);
    expect(results.map((result) => result.status).sort()).toEqual([201, 409]);
    await expect(wardrobe.countGarments()).resolves.toBe(300);
    expect(unwatch).toHaveBeenCalledTimes(1);
  });

  it("creates a tagged purchase using catalogue image/name/brand and removes the watch and size", async () => {
    const { request, wardrobe, catalogue } = setup();
    const item = (await catalogue.getItem(itemId))!;
    await catalogue.watchItem(itemId);
    await catalogue.replaceWatchSizes(itemId, ["M"]);
    const tag = vi.fn<GarmentTagger["tag"]>().mockImplementation(async () => {
      await expect(wardrobe.lastChangedAt()).resolves.toBeNull();
      return { ok: true, tags: input };
    });
    const result = await request({ tagger: { tag } });
    expect(result).toMatchObject({ status: 201, body: { unwatched: true, garment: {
      ...input, notes: "Size: M", source: "purchase", catalogueItemId: itemId,
      photoUrl: item.imageUrl, tagStatus: "tagged",
    } } });
    expect(tag).toHaveBeenCalledWith({ kind: "product", imageUrl: item.imageUrl, productName: item.name, brandName: "Sézane" });
    const { garment } = result.body as { garment: Garment };
    await expect(wardrobe.getGarment(garment.id)).resolves.toEqual(garment);
    await expect(wardrobe.lastChangedAt()).resolves.toEqual(expect.any(String));
    await expect(catalogue.listWatchedItemIds()).resolves.toEqual([]);
    await expect(catalogue.listWatchSizes(itemId)).resolves.toEqual([]);
  });

  it.each(["refused", "invalid_output", "api_error"] as const)("keeps failed tagging on %s and still unwatches without recording a wardrobe change", async (reason) => {
    const { request, wardrobe, catalogue } = setup();
    await catalogue.watchItem(itemId);
    const tag = vi.fn<GarmentTagger["tag"]>().mockResolvedValue({ ok: false, reason });
    await expect(request({ tagger: { tag } })).resolves.toMatchObject({ status: 201, body: {
      unwatched: true, garment: { tagStatus: "failed", source: "purchase" },
    } });
    await expect(wardrobe.countGarments()).resolves.toBe(1);
    await expect(wardrobe.lastChangedAt()).resolves.toBeNull();
    await expect(catalogue.listWatchedItemIds()).resolves.toEqual([]);
  });

  it("handles an unexpected tagger exception without losing the garment or watch removal", async () => {
    const { request, catalogue, wardrobe } = setup();
    vi.spyOn(console, "error").mockImplementation(() => {});
    await catalogue.watchItem(itemId);
    const tag = vi.fn<GarmentTagger["tag"]>().mockRejectedValue(new Error("provider details"));
    await expect(request({ tagger: { tag } })).resolves.toMatchObject({ status: 201, body: {
      unwatched: true, garment: { tagStatus: "failed" },
    } });
    await expect(catalogue.listWatchedItemIds()).resolves.toEqual([]);
    await expect(wardrobe.lastChangedAt()).resolves.toBeNull();
  });

  it("creates untagged without a tagger and allows duplicate purchases", async () => {
    const { request, wardrobe } = setup();
    const first = await request();
    const second = await request();
    expect(first).toMatchObject({ status: 201, body: { unwatched: true, garment: { tagStatus: "untagged", notes: null } } });
    expect(second.status).toBe(201);
    const garments = await wardrobe.listGarments();
    expect(garments).toHaveLength(2);
    expect(garments[0]!.id).not.toBe(garments[1]!.id);
    await expect(wardrobe.lastChangedAt()).resolves.toBeNull();
  });

  it.each([{ sizes: [] }, { sizes: ["M"] }, { sizes: ["S", "M"] }])("copies only a single watch size: %j", async ({ sizes }) => {
    const { request, catalogue } = setup();
    await catalogue.watchItem(itemId);
    await catalogue.replaceWatchSizes(itemId, sizes);
    await expect(request()).resolves.toMatchObject({ status: 201, body: {
      garment: { notes: sizes.length === 1 ? "Size: M" : null },
    } });
  });

  it("keeps the garment and returns unwatched false when unwatching fails", async () => {
    const { request, catalogue, wardrobe } = setup();
    await catalogue.watchItem(itemId);
    vi.spyOn(catalogue, "unwatchItem").mockRejectedValue(new Error("database unavailable"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await request();
    expect(result).toMatchObject({ status: 201, body: { unwatched: false, garment: { source: "purchase" } } });
    await expect(wardrobe.countGarments()).resolves.toBe(1);
    await expect(catalogue.listWatchedItemIds()).resolves.toEqual([itemId]);
    expect(log).toHaveBeenCalledWith("Could not unwatch purchased item", itemId, expect.anything());
  });

  it("retags a purchase by its stored public URL without requiring or touching disk storage", async () => {
    const { request, catalogue, wardrobe } = setup();
    const item = (await catalogue.getItem(itemId))!;
    const garment = await wardrobe.createPurchaseGarment(itemId, item.imageUrl, "Size: M");
    vi.spyOn(catalogue, "getItem").mockResolvedValue({ ...item, imageUrl: "https://brand.example/new-image.jpg" });
    const tag = vi.fn<GarmentTagger["tag"]>().mockResolvedValue({ ok: true, tags: input });
    await expect(request({ tagger: { tag }, body: undefined }, `/v1/wardrobe/${garment.id}/tag`))
      .resolves.toMatchObject({ status: 200, body: { garment: { tagStatus: "tagged", photoUrl: item.imageUrl, notes: "Size: M" } } });
    expect(tag).toHaveBeenCalledWith({ kind: "product", imageUrl: item.imageUrl, productName: item.name, brandName: "Sézane" });
    await expect(request({ tagger: { tag }, body: undefined }, `/v1/wardrobe/${garment.id}/tag`))
      .resolves.toEqual({ status: 409, body: { error: "already_tagged" } });
    await expect(request({ tagger: { tag }, body: '{"force":true}' }, `/v1/wardrobe/${garment.id}/tag`))
      .resolves.toMatchObject({ status: 200, body: { garment: { tagStatus: "tagged", notes: null } } });
    const remove = vi.fn();
    await expect(request({ photoStore: { write: vi.fn(), read: vi.fn(), remove } }, `/v1/wardrobe/${garment.id}`, "DELETE"))
      .resolves.toMatchObject({ status: 200 });
    expect(remove).not.toHaveBeenCalled();
  });
});

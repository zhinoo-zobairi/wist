import { afterEach, describe, expect, it, vi } from "vitest";
import { handleRequest, type RequestOptions } from "./app.js";
import { SeedCatalogueRepository } from "./seedRepository.js";
import { SqliteWardrobeRepository } from "./sqliteWardrobeRepository.js";
import type { Garment, GarmentInput } from "./wardrobe.js";
import { WardrobeFullError } from "./wardrobeRepository.js";
import { MAX_PHOTO_BYTES, type GarmentPhotoStore } from "./garmentPhotoStore.js";

const input: GarmentInput = {
  name: "Navy shirt", category: "top", colors: ["navy"],
  formality: "casual", warmth: "light", occasions: ["weekend"], notes: null,
};
const auth = { authorization: "Bearer test-owner", ownerToken: "test-owner" };
const catalogue = new SeedCatalogueRepository();
const photoBytes = Buffer.from([255, 216, 255, 0, 128]);

class MemoryPhotoStore implements GarmentPhotoStore {
  photos = new Map<string, Buffer>();
  async write(id: string, _mediaType: string, bytes: Buffer) { this.photos.set(id, bytes); }
  async read(id: string, _mediaType: string) { return this.photos.get(id) ?? null; }
  async remove(id: string) { this.photos.delete(id); }
}

describe("wardrobe API", () => {
  const repositories: SqliteWardrobeRepository[] = [];
  afterEach(() => {
    repositories.splice(0).forEach((repository) => repository.close());
    vi.restoreAllMocks();
  });
  function setup() {
    const wardrobe = new SqliteWardrobeRepository(":memory:");
    repositories.push(wardrobe);
    const photoStore = new MemoryPhotoStore();
    const request = (method: string, path = "/v1/wardrobe", options: RequestOptions = {}) =>
      handleRequest(method, path, catalogue, auth, { wardrobe, photoStore, ...options });
    return { wardrobe, photoStore, request };
  }

  it.each(["GET", "POST", "PUT", "DELETE"])("requires owner auth for %s", async (method) => {
    const path = method === "PUT" || method === "DELETE" ? "/v1/wardrobe/missing" : "/v1/wardrobe";
    await expect(handleRequest(method, path, catalogue, { ownerToken: auth.ownerToken }))
      .resolves.toEqual({ status: 401, body: { error: "unauthorized" } });
    await expect(handleRequest(method, path, catalogue, { ...auth, authorization: "Bearer wrong" }))
      .resolves.toMatchObject({ status: 401 });
  });

  it("returns 503 when the owner token or wardrobe repository is absent", async () => {
    await expect(handleRequest("GET", "/v1/wardrobe", catalogue)).resolves.toEqual({
      status: 503, body: { error: "wardrobe_api_not_configured" },
    });
    await expect(handleRequest("GET", "/v1/wardrobe", catalogue, auth)).resolves.toEqual({
      status: 503, body: { error: "wardrobe_api_not_configured" },
    });
  });

  it("creates, reads, replaces, lists, and deletes an owned garment", async () => {
    const { request } = setup();
    const created = await request("POST", "/v1/wardrobe", { body: JSON.stringify(input) });
    expect(created.status).toBe(201);
    const { garment } = created.body as { garment: Garment };
    expect(garment).toMatchObject({ ...input, source: "manual" });
    await expect(request("GET", `/v1/wardrobe/${garment.id}`)).resolves.toEqual({ status: 200, body: { garment } });
    await expect(request("GET")).resolves.toEqual({ status: 200, body: { garments: [garment] } });
    await expect(request("PUT", `/v1/wardrobe/${garment.id}`, {
      body: JSON.stringify({ ...input, colors: ["cream"], occasions: [] }),
    })).resolves.toMatchObject({ status: 200, body: { garment: { colors: ["cream"], occasions: [] } } });
    await expect(request("DELETE", `/v1/wardrobe/${garment.id}`)).resolves.toEqual({
      status: 200, body: { id: garment.id, deleted: true },
    });
    await expect(request("GET")).resolves.toEqual({ status: 200, body: { garments: [] } });
  });

  it.each([undefined, "{", "null", "[]", "{}", JSON.stringify({ ...input, colors: [] })])(
    "rejects malformed JSON and invalid garment shapes: %s", async (body) => {
      const { request } = setup();
      await expect(request("POST", "/v1/wardrobe", { body }))
        .resolves.toEqual({ status: 400, body: { error: "invalid_garment" } });
      await expect(request("PUT", "/v1/wardrobe/missing", { body }))
        .resolves.toEqual({ status: 400, body: { error: "invalid_garment" } });
    },
  );

  it("rejects oversized JSON before parsing", async () => {
    const { request } = setup();
    for (const [method, path] of [["POST", "/v1/wardrobe"], ["PUT", "/v1/wardrobe/missing"]]) {
      await expect(request(method!, path!, { bodyTooLarge: true }))
        .resolves.toEqual({ status: 413, body: { error: "payload_too_large" } });
    }
  });

  it("reports wardrobe_full both at the pre-check and a transaction-time capacity race", async () => {
    const { wardrobe, request } = setup();
    const count = vi.spyOn(wardrobe, "countGarments").mockResolvedValue(300);
    await expect(request("POST", "/v1/wardrobe", { body: JSON.stringify(input) }))
      .resolves.toEqual({ status: 409, body: { error: "wardrobe_full" } });
    count.mockResolvedValue(299);
    vi.spyOn(wardrobe, "createGarment").mockRejectedValue(new WardrobeFullError());
    await expect(request("POST", "/v1/wardrobe", { body: JSON.stringify(input) }))
      .resolves.toEqual({ status: 409, body: { error: "wardrobe_full" } });
  });

  it.each(["GET", "PUT", "DELETE"])("returns 404 for %s on an unknown garment", async (method) => {
    const { request } = setup();
    await expect(request(method, "/v1/wardrobe/missing", { body: JSON.stringify(input) }))
      .resolves.toEqual({ status: 404, body: { error: "garment_not_found" } });
  });

  it.each([["PUT", "/v1/wardrobe"], ["DELETE", "/v1/wardrobe"], ["POST", "/v1/wardrobe/missing"], ["PATCH", "/v1/wardrobe/missing"]])(
    "rejects unsupported method %s on %s", async (method, path) => {
      const { request } = setup();
      await expect(request(method, path)).resolves.toEqual({ status: 405, body: { error: "method_not_allowed" } });
    },
  );

  it("keeps unknown nested routes and similar prefixes out of garment routes", async () => {
    const { request } = setup();
    await expect(request("GET", "/v1/wardrobe/missing/unknown"))
      .resolves.toEqual({ status: 404, body: { error: "not_found" } });
    await expect(request("GET", "/v1/wardrobex"))
      .resolves.toEqual({ status: 404, body: { error: "not_found" } });
  });

  it("uploads, serves, edits, and deletes a photo garment", async () => {
    const { request, photoStore } = setup();
    const created = await request("POST", "/v1/wardrobe/photos", { bodyBytes: photoBytes, contentType: "image/jpeg" });
    expect(created.status).toBe(201);
    const { garment } = created.body as { garment: Garment };
    expect(garment).toMatchObject({ source: "photo", tagStatus: "untagged", photoUrl: `/v1/wardrobe/${garment.id}/photo` });
    await expect(request("GET", garment.photoUrl!)).resolves.toEqual({ status: 200, contentType: "image/jpeg", body: photoBytes });
    await expect(request("PUT", `/v1/wardrobe/${garment.id}`, { body: JSON.stringify(input) }))
      .resolves.toMatchObject({ status: 200, body: { garment: { source: "photo", tagStatus: "tagged", photoUrl: garment.photoUrl } } });
    await expect(request("DELETE", `/v1/wardrobe/${garment.id}`)).resolves.toMatchObject({ status: 200 });
    expect(photoStore.photos.size).toBe(0);
    await expect(request("GET", garment.photoUrl!)).resolves.toEqual({ status: 404, body: { error: "photo_not_found" } });
  });

  it("requires owner auth for both photo endpoints", async () => {
    for (const [method, path] of [["POST", "/v1/wardrobe/photos"], ["GET", "/v1/wardrobe/missing/photo"]]) {
      await expect(handleRequest(method!, path!, catalogue, { ownerToken: auth.ownerToken }))
        .resolves.toEqual({ status: 401, body: { error: "unauthorized" } });
    }
  });

  it("rejects unsupported formats, empty photos, oversized bodies, and absent storage", async () => {
    const { request } = setup();
    await expect(request("POST", "/v1/wardrobe/photos", { bodyBytes: photoBytes, contentType: "image/gif" }))
      .resolves.toEqual({ status: 415, body: { error: "unsupported_media_type" } });
    await expect(request("POST", "/v1/wardrobe/photos", { bodyBytes: Buffer.alloc(0), contentType: "image/jpeg" }))
      .resolves.toEqual({ status: 400, body: { error: "invalid_photo" } });
    for (const options of [{ bodyTooLarge: true }, { bodyBytes: Buffer.alloc(MAX_PHOTO_BYTES + 1) }]) {
      await expect(request("POST", "/v1/wardrobe/photos", { ...options, contentType: "image/jpeg" }))
        .resolves.toEqual({ status: 413, body: { error: "payload_too_large" } });
    }
    await expect(request("POST", "/v1/wardrobe/photos", { photoStore: undefined }))
      .resolves.toEqual({ status: 503, body: { error: "photo_store_not_configured" } });
  });

  it("enforces capacity on photo uploads, including a transaction-time race", async () => {
    const { wardrobe, request } = setup();
    const options = { bodyBytes: photoBytes, contentType: "image/jpeg" };
    const count = vi.spyOn(wardrobe, "countGarments").mockResolvedValue(300);
    await expect(request("POST", "/v1/wardrobe/photos", options))
      .resolves.toEqual({ status: 409, body: { error: "wardrobe_full" } });
    count.mockResolvedValue(299);
    vi.spyOn(wardrobe, "createPhotoGarment").mockRejectedValue(new WardrobeFullError());
    await expect(request("POST", "/v1/wardrobe/photos", options))
      .resolves.toEqual({ status: 409, body: { error: "wardrobe_full" } });
  });

  it("removes the garment and partial file if the photo write fails", async () => {
    const { wardrobe, photoStore, request } = setup();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(photoStore, "write").mockImplementation(async (id) => {
      photoStore.photos.set(id, photoBytes);
      throw new Error("Disk full");
    });
    await expect(request("POST", "/v1/wardrobe/photos", { bodyBytes: photoBytes, contentType: "image/jpeg" }))
      .resolves.toEqual({ status: 500, body: { error: "photo_store_failed" } });
    await expect(wardrobe.countGarments()).resolves.toBe(0);
    expect(photoStore.photos.size).toBe(0);
  });

  it("still deletes the garment and logs its id when file removal fails", async () => {
    const { wardrobe, photoStore, request } = setup();
    const garment = await wardrobe.createPhotoGarment("image/jpeg");
    vi.spyOn(photoStore, "remove").mockRejectedValue(new Error("Permission denied"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(request("DELETE", `/v1/wardrobe/${garment.id}`)).resolves.toMatchObject({ status: 200 });
    await expect(wardrobe.getGarment(garment.id)).resolves.toBeNull();
    expect(log).toHaveBeenCalledWith("Could not remove garment photo", garment.id, expect.any(Error));
  });

  it("returns photo_not_found for manual garments and missing photo files", async () => {
    const { wardrobe, request, photoStore } = setup();
    const manual = await wardrobe.createGarment(input, "manual");
    const photo = await wardrobe.createPhotoGarment("image/jpeg");
    const read = vi.spyOn(photoStore, "read");
    await expect(request("GET", `/v1/wardrobe/${manual.id}/photo`))
      .resolves.toEqual({ status: 404, body: { error: "photo_not_found" } });
    expect(read).not.toHaveBeenCalled();
    await expect(request("GET", `/v1/wardrobe/${photo.id}/photo`))
      .resolves.toEqual({ status: 404, body: { error: "photo_not_found" } });
  });

  it.each([["GET", "/v1/wardrobe/photos"], ["PUT", "/v1/wardrobe/missing/photo"]])(
    "rejects unsupported photo method %s on %s", async (method, path) => {
      const { request } = setup();
      await expect(request(method, path)).resolves.toEqual({ status: 405, body: { error: "method_not_allowed" } });
    },
  );
});

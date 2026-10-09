import { afterEach, describe, expect, it, vi } from "vitest";
import { handleRequest, type RequestOptions } from "./app.js";
import { SeedCatalogueRepository } from "./seedRepository.js";
import { SqliteWardrobeRepository } from "./sqliteWardrobeRepository.js";
import type { Garment, GarmentInput } from "./wardrobe.js";
import { WardrobeFullError } from "./wardrobeRepository.js";

const input: GarmentInput = {
  name: "Navy shirt", category: "top", colors: ["navy"],
  formality: "casual", warmth: "light", occasions: ["weekend"], notes: null,
};
const auth = { authorization: "Bearer test-owner", ownerToken: "test-owner" };
const catalogue = new SeedCatalogueRepository();

describe("wardrobe API", () => {
  const repositories: SqliteWardrobeRepository[] = [];
  afterEach(() => {
    repositories.splice(0).forEach((repository) => repository.close());
    vi.restoreAllMocks();
  });
  function setup() {
    const wardrobe = new SqliteWardrobeRepository(":memory:");
    repositories.push(wardrobe);
    const request = (method: string, path = "/v1/wardrobe", options: RequestOptions = {}) =>
      handleRequest(method, path, catalogue, auth, { wardrobe, ...options });
    return { wardrobe, request };
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
});

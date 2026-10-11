import { afterEach, describe, expect, it } from "vitest";
import { handleRequest, type RequestAuth, type RequestOptions } from "./app.js";
import { SeedCatalogueRepository } from "./seedRepository.js";
import { SqliteOutfitRepository } from "./sqliteOutfitRepository.js";

const catalogue = new SeedCatalogueRepository();
const auth = { ownerToken: "owner", authorization: "Bearer owner" };
const closers: { close: () => void }[] = [];
function setup() {
  const outfits = new SqliteOutfitRepository(":memory:");
  closers.push(outfits);
  const put = (body: string, options: RequestOptions = {}, requestAuth: RequestAuth = auth) =>
    handleRequest("PUT", "/v1/location", catalogue, requestAuth, { outfits, body, ...options });
  return { outfits, put };
}

describe("location API", () => {
  afterEach(() => { closers.splice(0).forEach((c) => c.close()); });

  it("stores the latest location rounded to 2 decimals on the server too", async () => {
    const { outfits, put } = setup();
    await expect(put(JSON.stringify({ latitude: 52.5249, longitude: 13.4051 })))
      .resolves.toEqual({ status: 204, body: null });
    await expect(outfits.getLocation()).resolves.toEqual({ latitude: 52.52, longitude: 13.41 });
  });

  it.each([[90, 180], [-90, -180], [0, 0]])("accepts inclusive bounds (%i, %i)", async (latitude, longitude) => {
    const { outfits, put } = setup();
    await expect(put(JSON.stringify({ latitude, longitude }))).resolves.toMatchObject({ status: 204 });
    await expect(outfits.getLocation()).resolves.toEqual({ latitude, longitude });
  });

  it.each([
    "", "{", "null", "[]", "52", "{}", '{"latitude":52}', '{"longitude":13}',
    '{"latitude":"52","longitude":13}', '{"latitude":52,"longitude":null}',
    '{"latitude":90.01,"longitude":13}', '{"latitude":-90.01,"longitude":13}',
    '{"latitude":52,"longitude":180.01}', '{"latitude":52,"longitude":-180.01}',
    '{"latitude":1e999,"longitude":13}',
  ])("rejects %s without storing anything", async (body) => {
    const { outfits, put } = setup();
    await expect(put(body)).resolves.toEqual({ status: 400, body: { error: "invalid_location" } });
    await expect(outfits.getLocation()).resolves.toBeNull();
  });

  it.each([
    [{}, 503], [{ ownerToken: "owner" }, 401], [{ ownerToken: "owner", authorization: "Bearer wrong" }, 401],
  ] as const)("requires configured owner authentication %#", async (requestAuth, status) => {
    const { outfits, put } = setup();
    const result = await put(JSON.stringify({ latitude: 52, longitude: 13 }), {}, requestAuth);
    expect(result.status).toBe(status);
    await expect(outfits.getLocation()).resolves.toBeNull();
  });

  it("refuses an oversized body, other methods and a missing repository", async () => {
    const { outfits, put } = setup();
    await expect(put("", { bodyTooLarge: true })).resolves.toEqual({ status: 413, body: { error: "payload_too_large" } });
    for (const method of ["GET", "POST", "DELETE"]) {
      await expect(handleRequest(method, "/v1/location", catalogue, auth, { outfits }))
        .resolves.toEqual({ status: 405, body: { error: "method_not_allowed" } });
    }
    await expect(handleRequest("PUT", "/v1/location", catalogue, auth, { body: '{"latitude":52,"longitude":13}' }))
      .resolves.toEqual({ status: 503, body: { error: "location_not_configured" } });
  });
});

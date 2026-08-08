import { describe, expect, it } from "vitest";

import { handleRequest } from "./app.js";
import { SeedCatalogueRepository } from "./seedRepository.js";

const repository = new SeedCatalogueRepository();

describe("catalogue API", () => {
  const auth = {
    authorization: "Bearer owner-test-token",
    ownerToken: "owner-test-token",
  };

  it("reports service health", async () => {
    await expect(handleRequest("GET", "/health", repository)).resolves.toEqual({
      status: 200,
      body: { status: "ok", service: "wist-catalogue" },
    });
  });

  it("lists normalized items for a known brand", async () => {
    const response = await handleRequest(
      "GET",
      "/v1/brands/sezane/items",
      repository,
    );

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      items: [
        {
          id: "sezane-wool-coat",
          source: "seed",
          currency: "EUR",
          available: true,
        },
        { id: "sezane-silk-skirt" },
      ],
    });
  });

  it("returns explicit errors for unknown resources and methods", async () => {
    await expect(
      handleRequest("GET", "/v1/brands/unknown/items", repository),
    ).resolves.toEqual({
      status: 404,
      body: { error: "brand_not_found" },
    });
    await expect(handleRequest("POST", "/v1/brands", repository)).resolves.toEqual({
      status: 405,
      body: { error: "method_not_allowed" },
    });
  });

  it("requires the owner token for watch operations", async () => {
    await expect(
      handleRequest(
        "PUT",
        "/v1/watches/sandro-tweed-dress",
        repository,
        { ownerToken: "owner-test-token" },
      ),
    ).resolves.toEqual({ status: 401, body: { error: "unauthorized" } });
  });

  it("creates, lists, and removes a single-user watch", async () => {
    await expect(
      handleRequest(
        "PUT",
        "/v1/watches/sandro-tweed-dress",
        repository,
        auth,
      ),
    ).resolves.toEqual({
      status: 200,
      body: { itemId: "sandro-tweed-dress", watched: true },
    });
    await expect(
      handleRequest("GET", "/v1/watches", repository, auth),
    ).resolves.toEqual({
      status: 200,
      body: { itemIds: ["sandro-tweed-dress"] },
    });
    await expect(
      handleRequest(
        "DELETE",
        "/v1/watches/sandro-tweed-dress",
        repository,
        auth,
      ),
    ).resolves.toEqual({
      status: 200,
      body: { itemId: "sandro-tweed-dress", watched: false },
    });
  });
});

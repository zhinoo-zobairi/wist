import { describe, expect, it } from "vitest";

import { handleRequest } from "./app.js";
import { SeedCatalogueRepository } from "./seedRepository.js";

const repository = new SeedCatalogueRepository();

describe("catalogue API", () => {
  it("reports service health", async () => {
    await expect(handleRequest("GET", "/health", repository)).resolves.toEqual({
      status: 200,
      body: { status: "ok", service: "covet-catalogue" },
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
});

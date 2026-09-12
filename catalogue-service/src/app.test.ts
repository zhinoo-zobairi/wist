import { describe, expect, it } from "vitest";

import { handleRequest } from "./app.js";
import { SeedCatalogueRepository } from "./seedRepository.js";
import type {
  StyleProfile,
  StyleProfileSelection,
} from "./styleProfile.js";
import type { StyleProfileRepository } from "./styleProfileRepository.js";

const repository = new SeedCatalogueRepository();

// The seed items publish no variants, but label validation needs some to check
// against. This subclass lends every item the same small size grid so the API
// tests can exercise selecting, clearing, and rejecting sizes.
class SizedSeedRepository extends SeedCatalogueRepository {
  async getItem(itemId: string) {
    const item = await super.getItem(itemId);
    return item
      ? {
          ...item,
          variants: [
            { id: "137", label: "39", available: false },
            { id: "138", label: "40", available: true },
          ],
        }
      : null;
  }
}

class MemoryStyleProfileRepository implements StyleProfileRepository {
  profile: StyleProfile | null = null;

  async getProfile() {
    return this.profile;
  }

  async replaceProfile(selection: StyleProfileSelection) {
    this.profile = {
      ...selection,
      updatedAt: "2026-08-21T12:00:00.000Z",
    };
    return this.profile;
  }
}

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

  it("lists price-drop alerts only for the owner", async () => {
    await expect(
      handleRequest("GET", "/v1/alerts", repository, auth),
    ).resolves.toEqual({ status: 200, body: { alerts: [] } });
    await expect(
      handleRequest("GET", "/v1/alerts", repository, {
        ownerToken: "owner-test-token",
      }),
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
      body: { itemIds: ["sandro-tweed-dress"], sizes: {} },
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

  it("imports a product URL directly into the watch list", async () => {
    const importProduct = async (productUrl: string) => {
      expect(productUrl).toBe(
        "https://de.sandro-paris.com/de/p/tweed-kleid/SFPRO00001.html",
      );
      const item = await repository.getItem("sandro-tweed-dress");
      if (!item) throw new Error("Test product missing");
      return item;
    };

    await expect(
      handleRequest("POST", "/v1/watches", repository, auth, {
        body: JSON.stringify({
          url: " https://de.sandro-paris.com/de/p/tweed-kleid/SFPRO00001.html ",
        }),
        importProduct,
      }),
    ).resolves.toEqual({
      status: 201,
      body: { itemId: "sandro-tweed-dress", watched: true },
    });
    await expect(
      handleRequest("GET", "/v1/watches", repository, auth),
    ).resolves.toEqual({
      status: 200,
      body: { itemIds: ["sandro-tweed-dress"], sizes: {} },
    });
  });

  it("returns useful errors for invalid or unsupported product imports", async () => {
    await expect(
      handleRequest("POST", "/v1/watches", repository, auth, {
        body: JSON.stringify({ url: "" }),
        importProduct: async () => {
          throw new Error("should not run");
        },
      }),
    ).resolves.toEqual({
      status: 400,
      body: { error: "invalid_product_url" },
    });

    await expect(
      handleRequest("POST", "/v1/watches", repository, auth, {
        body: JSON.stringify({ url: "https://example.com/product" }),
        importProduct: async () => {
          throw new Error("URL must be a supported product page");
        },
      }),
    ).resolves.toEqual({
      status: 422,
      body: {
        error: "product_import_failed",
        message: "URL must be a supported product page",
      },
    });
  });

  it("stores the chosen sizes and returns them in the watch list", async () => {
    const sized = new SizedSeedRepository();
    await expect(
      handleRequest("PUT", "/v1/watches/sandro-tweed-dress", sized, auth, {
        body: JSON.stringify({ sizes: [" 40 ", "40"] }),
      }),
    ).resolves.toEqual({
      status: 200,
      body: { itemId: "sandro-tweed-dress", watched: true },
    });
    await expect(
      handleRequest("GET", "/v1/watches", sized, auth),
    ).resolves.toEqual({
      status: 200,
      body: {
        itemIds: ["sandro-tweed-dress"],
        sizes: { "sandro-tweed-dress": ["40"] },
      },
    });
  });

  // The covet toggle re-watches an item with no body. That must not be read as
  // "clear my sizes", or a user would lose their selection every time they
  // toggled covet off and on.
  it("leaves an existing selection untouched when no sizes are sent", async () => {
    const sized = new SizedSeedRepository();
    await handleRequest("PUT", "/v1/watches/sandro-tweed-dress", sized, auth, {
      body: JSON.stringify({ sizes: ["40"] }),
    });
    await expect(
      handleRequest("PUT", "/v1/watches/sandro-tweed-dress", sized, auth),
    ).resolves.toEqual({
      status: 200,
      body: { itemId: "sandro-tweed-dress", watched: true },
    });
    await expect(
      sized.listWatchSizes("sandro-tweed-dress"),
    ).resolves.toEqual(["40"]);
  });

  it("clears the selection when sent an explicit empty list", async () => {
    const sized = new SizedSeedRepository();
    await handleRequest("PUT", "/v1/watches/sandro-tweed-dress", sized, auth, {
      body: JSON.stringify({ sizes: ["40"] }),
    });
    await handleRequest("PUT", "/v1/watches/sandro-tweed-dress", sized, auth, {
      body: JSON.stringify({ sizes: [] }),
    });
    await expect(
      sized.listWatchSizes("sandro-tweed-dress"),
    ).resolves.toEqual([]);
  });

  it("rejects a size the item does not publish", async () => {
    const sized = new SizedSeedRepository();
    await expect(
      handleRequest("PUT", "/v1/watches/sandro-tweed-dress", sized, auth, {
        body: JSON.stringify({ sizes: ["99"] }),
      }),
    ).resolves.toEqual({
      status: 400,
      body: { error: "invalid_watch_sizes" },
    });
  });

  it("rejects a malformed sizes body", async () => {
    const sized = new SizedSeedRepository();
    await expect(
      handleRequest("PUT", "/v1/watches/sandro-tweed-dress", sized, auth, {
        body: JSON.stringify({ sizes: "40" }),
      }),
    ).resolves.toEqual({
      status: 400,
      body: { error: "invalid_watch_sizes" },
    });
    await expect(
      handleRequest("PUT", "/v1/watches/sandro-tweed-dress", sized, auth, {
        bodyTooLarge: true,
      }),
    ).resolves.toEqual({
      status: 413,
      body: { error: "payload_too_large" },
    });
  });

  it("reads and replaces the owner style profile", async () => {
    const profiles = new MemoryStyleProfileRepository();
    await expect(
      handleRequest("GET", "/v1/profile", repository, auth, { profiles }),
    ).resolves.toEqual({ status: 200, body: { profile: null } });

    await expect(
      handleRequest("PUT", "/v1/profile", repository, auth, {
        profiles,
        body: JSON.stringify({
          occasions: ["evening", "work"],
          styles: ["tailored"],
        }),
      }),
    ).resolves.toMatchObject({
      status: 200,
      body: {
        profile: {
          occasions: ["work", "evening"],
          styles: ["tailored"],
        },
      },
    });
  });

  it("protects and validates profile requests", async () => {
    const profiles = new MemoryStyleProfileRepository();
    await expect(
      handleRequest("GET", "/v1/profile", repository, {
        ownerToken: "owner-test-token",
      }, { profiles }),
    ).resolves.toEqual({ status: 401, body: { error: "unauthorized" } });
    await expect(
      handleRequest("PUT", "/v1/profile", repository, auth, {
        profiles,
        body: "not json",
      }),
    ).resolves.toEqual({
      status: 400,
      body: { error: "invalid_profile" },
    });
    await expect(
      handleRequest("PUT", "/v1/profile", repository, auth, {
        profiles,
        bodyTooLarge: true,
      }),
    ).resolves.toEqual({
      status: 413,
      body: { error: "payload_too_large" },
    });
  });
});

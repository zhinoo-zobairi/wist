import { describe, expect, it, vi } from "vitest";

import {
  importCatalogueWatch,
  loadCatalogue,
  loadPriceDropAlerts,
  loadStyleProfile,
  loadWatchedItemIds,
  saveStyleProfile,
  setCatalogueWatch,
} from "./catalogueClient";

describe("catalogue client", () => {
  it("loads brands and their products from the backend", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ brands: [{ id: "bobbies", name: "Bobbies" }] }),
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            items: [
              {
                id: "bobbies-L-M24WO-OPE01",
                brandId: "bobbies",
                name: "Opéra - Iridescent Champagne",
                imageUrl: "https://images.bobbies.com/opera.jpg",
                media: [
                  {
                    type: "image",
                    url: "https://images.bobbies.com/opera.jpg",
                  },
                  {
                    type: "video",
                    url: "https://videos.bobbies.com/opera.mp4",
                  },
                ],
                variants: [
                  { id: "137", label: "39", available: false },
                  { id: "138", label: "40", available: false },
                ],
                currentPrice: 225,
                currency: "EUR",
                url: "https://www.bobbies.com/en/opera.html",
                available: true,
                observedAt: "2026-08-08T12:00:00.000Z",
                previousPrice: null,
                sourceProductId: "L-M24WO-OPE01",
              },
            ],
          }),
        ),
      );

    await expect(
      loadCatalogue(fetchImpl, "http://catalogue.test/"),
    ).resolves.toEqual({
      brands: [
        { id: "bobbies", name: "Bobbies", monogram: "B", curated: true },
      ],
      items: [
        {
          id: "bobbies-L-M24WO-OPE01",
          brandId: "bobbies",
          name: "Opéra - Iridescent Champagne",
          imageUrl: "https://images.bobbies.com/opera.jpg",
          media: [
            {
              type: "image",
              url: "https://images.bobbies.com/opera.jpg",
            },
            {
              type: "video",
              url: "https://videos.bobbies.com/opera.mp4",
            },
          ],
          variants: [
            { id: "137", label: "39", available: false },
            { id: "138", label: "40", available: false },
          ],
          currentPrice: 225,
          currency: "EUR",
          url: "https://www.bobbies.com/en/opera.html",
          available: true,
          observedAt: "2026-08-08T12:00:00.000Z",
          previousPrice: null,
          sourceProductId: "L-M24WO-OPE01",
        },
      ],
    });
    expect(fetchImpl).toHaveBeenNthCalledWith(
      1,
      "http://catalogue.test/v1/brands",
      { headers: { accept: "application/json" } },
    );
  });

  it("loads and mutates watches with the owner bearer token", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ itemIds: ["bobbies-L-M24WO-OPE01"] }),
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            itemId: "bobbies-L-M24WO-OPE01",
            watched: true,
          }),
        ),
      );

    await expect(
      loadWatchedItemIds(fetchImpl, "http://catalogue.test", "owner-token"),
    ).resolves.toEqual(["bobbies-L-M24WO-OPE01"]);
    await expect(
      setCatalogueWatch(
        "bobbies-L-M24WO-OPE01",
        true,
        fetchImpl,
        "http://catalogue.test",
        "owner-token",
      ),
    ).resolves.toBeUndefined();

    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      "http://catalogue.test/v1/watches/bobbies-L-M24WO-OPE01",
      {
        headers: {
          accept: "application/json",
          authorization: "Bearer owner-token",
        },
        method: "PUT",
      },
    );
  });

  it("imports a product URL directly into the watch list", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          itemId: "sandro-SFPRO00001",
          watched: true,
        }),
        { status: 201 },
      ),
    );

    await expect(
      importCatalogueWatch(
        "https://de.sandro-paris.com/de/p/tweed-kleid/SFPRO00001.html",
        fetchImpl,
        "http://catalogue.test/",
        "owner-token",
      ),
    ).resolves.toBe("sandro-SFPRO00001");
    expect(fetchImpl).toHaveBeenCalledWith("http://catalogue.test/v1/watches", {
      body: JSON.stringify({
        url: "https://de.sandro-paris.com/de/p/tweed-kleid/SFPRO00001.html",
      }),
      headers: {
        accept: "application/json",
        authorization: "Bearer owner-token",
        "content-type": "application/json",
      },
      method: "POST",
    });
  });

  it("surfaces the backend explanation when product import fails", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          error: "product_import_failed",
          message: "Only Bobbies and Sandro product URLs are supported",
        }),
        { status: 422 },
      ),
    );

    await expect(
      importCatalogueWatch(
        "https://example.com/product",
        fetchImpl,
        "http://catalogue.test",
        "owner-token",
      ),
    ).rejects.toThrow("Only Bobbies and Sandro product URLs are supported");
  });

  it("loads price-drop alerts with the owner bearer token", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          alerts: [
            {
              id: "price-drop-1",
              itemId: "bobbies-L-M24WO-OPE01",
              oldPrice: 225,
              newPrice: 180,
              currency: "EUR",
              pctOff: 20,
              observedAt: "2026-08-15T12:00:00.000Z",
            },
          ],
        }),
      ),
    );

    await expect(
      loadPriceDropAlerts(fetchImpl, "http://catalogue.test", "owner-token"),
    ).resolves.toEqual([
      {
        id: "price-drop-1",
        userId: "local-user",
        itemId: "bobbies-L-M24WO-OPE01",
        oldPrice: 225,
        newPrice: 180,
        pctOff: 20,
        createdAt: "2026-08-15T12:00:00.000Z",
        read: false,
      },
    ]);
    expect(fetchImpl).toHaveBeenCalledWith("http://catalogue.test/v1/alerts", {
      headers: {
        accept: "application/json",
        authorization: "Bearer owner-token",
      },
    });
  });

  it("loads and replaces the owner style profile", async () => {
    const profile = {
      occasions: ["work", "travel"],
      styles: ["minimal", "bold"],
      updatedAt: "2026-08-21T12:00:00.000Z",
    };
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ profile })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ profile })));

    await expect(
      loadStyleProfile(fetchImpl, "http://catalogue.test", "owner-token"),
    ).resolves.toEqual(profile);
    await expect(
      saveStyleProfile(
        ["work", "travel"],
        ["minimal", "bold"],
        fetchImpl,
        "http://catalogue.test",
        "owner-token",
      ),
    ).resolves.toEqual(profile);

    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      "http://catalogue.test/v1/profile",
      {
        body: JSON.stringify({
          occasions: ["work", "travel"],
          styles: ["minimal", "bold"],
        }),
        headers: {
          accept: "application/json",
          authorization: "Bearer owner-token",
          "content-type": "application/json",
        },
        method: "PUT",
      },
    );
  });

  it("distinguishes an unanswered profile and rejects invalid selections", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ profile: null })),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            profile: {
              occasions: ["unknown"],
              styles: [],
              updatedAt: "2026-08-21T12:00:00.000Z",
            },
          }),
        ),
      );

    await expect(
      loadStyleProfile(fetchImpl, "http://catalogue.test", "owner-token"),
    ).resolves.toBeNull();
    await expect(
      loadStyleProfile(fetchImpl, "http://catalogue.test", "owner-token"),
    ).rejects.toThrow("invalid style profile selections");
  });
});

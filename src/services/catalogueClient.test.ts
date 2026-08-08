import { describe, expect, it, vi } from "vitest";

import {
  loadCatalogue,
  loadWatchedItemIds,
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
});

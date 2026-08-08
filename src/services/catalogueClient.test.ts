import { describe, expect, it, vi } from "vitest";

import { loadCatalogue } from "./catalogueClient";

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
                currentPrice: 225,
                currency: "EUR",
                url: "https://www.bobbies.com/en/opera.html",
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
          currentPrice: 225,
          currency: "EUR",
          url: "https://www.bobbies.com/en/opera.html",
        },
      ],
    });
    expect(fetchImpl).toHaveBeenNthCalledWith(
      1,
      "http://catalogue.test/v1/brands",
      { headers: { accept: "application/json" } },
    );
  });
});

import { describe, expect, it, vi } from "vitest";

import { fetchProductObservation } from "./productObservation.js";

const bobbiesProduct = {
  "@type": "Product",
  name: "Opéra - Iridescent Champagne",
  sku: "L-M24WO-OPE01",
  image: "https://images.bobbies.com/opera.jpg",
  offers: {
    url: "https://www.bobbies.com/en/opera.html",
    availability: "http://schema.org/InStock",
    priceCurrency: "EUR",
    price: "225",
  },
};

describe("product observation", () => {
  it("routes an explicit Bobbies URL to its source adapter", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          `<script type="application/ld+json">${JSON.stringify(bobbiesProduct)}</script>`,
        ),
    );

    await expect(
      fetchProductObservation(
        "https://www.bobbies.com/en/opera.html",
        fetchImpl,
        "2026-08-08T12:00:00.000Z",
      ),
    ).resolves.toMatchObject({
      brand: { id: "bobbies", name: "Bobbies" },
      item: { id: "bobbies-L-M24WO-OPE01", currentPrice: 225 },
    });
  });

  it("rejects unsupported storefronts before requesting them", async () => {
    const fetchImpl = vi.fn();

    await expect(
      fetchProductObservation("https://example.com/product", fetchImpl),
    ).rejects.toThrow("Only Bobbies and Sandro product URLs are supported");
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

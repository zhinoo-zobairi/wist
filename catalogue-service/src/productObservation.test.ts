import { readFileSync } from "node:fs";

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

  it("routes an explicit Claudie Pierlot URL to its source adapter", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          readFileSync(
            new URL("./fixtures/claudie-pierlot-product.html", import.meta.url),
            "utf8",
          ),
        ),
    );

    await expect(
      fetchProductObservation(
        "https://de.claudiepierlot.com/de_DE/p/mittellanger-lederrock/christine/CFPJU00921_C016.html",
        fetchImpl,
        "2026-10-11T12:00:00.000Z",
      ),
    ).resolves.toMatchObject({
      brand: { id: "claudie-pierlot", name: "Claudie Pierlot" },
      item: { id: "claudie-pierlot-CFPJU00921_C016", currentPrice: 455 },
    });
  });

  it("routes a Shopify product URL through the reusable storefront adapter", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          id: 8108275171504,
          title: "100% Merino Wool Women H-Line Blazer",
          vendor: "GOELIA",
          price: 29900,
          available: true,
          featured_image: "//cdn.shopify.com/goelia/blazer.jpg",
          variants: [],
        }),
        { headers: { "set-cookie": "cart_currency=EUR; path=/" } },
      ),
    );

    await expect(
      fetchProductObservation(
        "https://www.goelia1995.com/en-eu/products/merino-blazer",
        fetchImpl,
        "2026-08-30T12:00:00.000Z",
      ),
    ).resolves.toMatchObject({
      brand: { name: "GOELIA" },
      item: { source: "shopify", currentPrice: 299 },
    });
  });
});

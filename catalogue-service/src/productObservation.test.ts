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

  it("routes a Goelia 1995 product URL through the Shopify adapter", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        readFileSync(new URL("./fixtures/goelia-product.json", import.meta.url), "utf8"),
        { headers: { "set-cookie": "cart_currency=EUR; path=/" } },
      ),
    );

    await expect(
      fetchProductObservation(
        "https://www.goelia1995.com/en-eu/products/100-merino-wool-women-h-line-blazer-1fnl6r1c0",
        fetchImpl,
        "2026-11-01T12:00:00.000Z",
      ),
    ).resolves.toMatchObject({
      brand: { id: "shopify-www-goelia1995-com", name: "GOELIA" },
      item: {
        id: "shopify-www-goelia1995-com-8108275171504",
        source: "shopify",
        currentPrice: 299,
        currency: "EUR",
        available: true,
      },
    });
  });

  it("routes a Gaala product URL through the Shopify adapter", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        readFileSync(new URL("./fixtures/gaala-product.json", import.meta.url), "utf8"),
        { headers: { "set-cookie": "cart_currency=EUR; path=/" } },
      ),
    );

    const observation = await fetchProductObservation(
      "https://gaala.com/products/wool-coat-paola",
      fetchImpl,
      "2026-11-01T12:00:00.000Z",
    );

    expect(observation).toMatchObject({
      brand: { id: "shopify-gaala-com", name: "Gaâla" },
      item: {
        id: "shopify-gaala-com-7002436206782",
        source: "shopify",
        name: "Paola Wool Coat",
        currentPrice: 385,
        currency: "EUR",
        available: true,
      },
    });
    expect(observation.item.variants).toContainEqual({
      id: "49931264622925",
      label: "Grey / XXS / In stock",
      available: true,
    });
  });
});

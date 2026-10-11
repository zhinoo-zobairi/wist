import { describe, expect, it, vi } from "vitest";

import {
  fetchJsonLdProduct,
  parseJsonLdProductPage,
  type JsonLdStorefront,
} from "./jsonLdProduct.js";

const store: JsonLdStorefront = {
  source: "sandro",
  brand: { id: "sandro", name: "Sandro" },
  host: "shop.example.com",
  pageKind: "product page",
  validatePath: (url) => url.pathname.startsWith("/p/"),
  maxHtmlBytes: 2_000,
};

const product = {
  "@type": "Product",
  name: "Dress",
  sku: "SKU1",
  image: ["https://shop.example.com/a.jpg", "https://shop.example.com/b.jpg"],
  offers: {
    url: "https://shop.example.com/p/dress.html",
    availability: "https://schema.org/InStock",
    priceCurrency: "EUR",
    price: "10.50",
  },
};
const ld = (value: unknown) =>
  `<script type="application/ld+json">${JSON.stringify(value)}</script>`;
const at = "2026-08-08T12:00:00.000Z";

describe("shared JSON-LD product core", () => {
  it("picks the Product among several ld+json blocks and takes the first image", () => {
    const item = parseJsonLdProductPage(
      store,
      `${ld({ "@type": "WebSite" })}${ld([{ "@type": "Org" }, product])}`,
      at,
    );
    expect(item).toMatchObject({
      id: "sandro-SKU1",
      brandId: "sandro",
      imageUrl: "https://shop.example.com/a.jpg",
      media: [{ type: "image", url: "https://shop.example.com/a.jpg" }],
      variants: [],
      currentPrice: 10.5,
      available: true,
    });
  });

  it("errors when no Product JSON-LD exists", () => {
    expect(() => parseJsonLdProductPage(store, ld({ "@type": "WebSite" }), at))
      .toThrow("Sandro page does not contain Product JSON-LD");
  });

  it("lets a storefront extend media and variants", () => {
    const item = parseJsonLdProductPage(
      {
        ...store,
        extend: () => ({
          media: [{ type: "video", url: "https://shop.example.com/v.mp4" }],
          variants: [{ id: "1", label: "M", available: true }],
        }),
      },
      ld(product),
      at,
    );
    expect(item.media).toEqual([
      { type: "video", url: "https://shop.example.com/v.mp4" },
    ]);
    expect(item.variants).toHaveLength(1);
  });

  it("reads http and https schema.org InStock as available, other values not", () => {
    const withAvailability = (availability: string) =>
      ld({ ...product, offers: { ...product.offers, availability } });
    for (const availability of [
      "http://schema.org/InStock",
      "https://schema.org/InStock",
    ]) {
      expect(
        parseJsonLdProductPage(store, withAvailability(availability), at).available,
      ).toBe(true);
    }
    expect(
      parseJsonLdProductPage(store, withAvailability("https://schema.org/OutOfStock"), at)
        .available,
    ).toBe(false);
  });

  it("fetches with redirect refusal and rejects oversize HTML", async () => {
    const fetchImpl = vi.fn(async () => new Response(ld(product)));
    const url = "https://shop.example.com/p/dress.html";
    await expect(
      fetchJsonLdProduct(store, url, fetchImpl, at),
    ).resolves.toMatchObject({ sourceProductId: "SKU1" });
    expect(fetchImpl).toHaveBeenCalledWith(new URL(url), {
      headers: { accept: "text/html" },
      redirect: "error",
    });

    const big = vi.fn(async () => new Response("x".repeat(2_001)));
    await expect(fetchJsonLdProduct(store, url, big, at)).rejects.toThrow(
      "Sandro page exceeds 2000 bytes",
    );
  });

  it("rejects wrong host, scheme and path before fetching", async () => {
    const fetchImpl = vi.fn();
    for (const bad of [
      "https://other.example.com/p/x.html",
      "http://shop.example.com/p/x.html",
      "https://shop.example.com/other/x.html",
    ]) {
      await expect(fetchJsonLdProduct(store, bad, fetchImpl, at)).rejects.toThrow(
        "URL must be an HTTPS product page on shop.example.com",
      );
    }
    await expect(fetchJsonLdProduct(store, "nope", fetchImpl, at)).rejects.toThrow(
      "A valid Sandro product URL is required",
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

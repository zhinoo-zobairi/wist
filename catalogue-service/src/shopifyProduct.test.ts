import { describe, expect, it, vi } from "vitest";

import {
  fetchShopifyProduct,
  parseShopifyProduct,
} from "./shopifyProduct.js";

const product = {
  id: 8108275171504,
  title: "100% Merino Wool Women H-Line Blazer",
  vendor: "GOELIA",
  price: 29900,
  available: true,
  images: ["//cdn.shopify.com/goelia/blazer.jpg"],
  variants: [
    { id: 45537105936560, title: "Smoke Grey / XS", available: true },
    { id: 45537106034864, title: "Smoke Grey / L", available: false },
  ],
};

const productUrl = new URL(
  "https://www.goelia1995.com/en-eu/products/100-merino-wool-women-h-line-blazer-1fnl6r1c0",
);

describe("Shopify product", () => {
  it("normalizes localized Shopify JSON into the catalogue model", () => {
    expect(
      parseShopifyProduct(
        product,
        productUrl,
        "EUR",
        "2026-08-30T12:00:00.000Z",
      ),
    ).toEqual({
      brand: { id: "shopify-www-goelia1995-com", name: "GOELIA" },
      item: {
        id: "shopify-www-goelia1995-com-8108275171504",
        source: "shopify",
        sourceProductId: "8108275171504",
        brandId: "shopify-www-goelia1995-com",
        name: "100% Merino Wool Women H-Line Blazer",
        url: productUrl.toString(),
        imageUrl: "https://cdn.shopify.com/goelia/blazer.jpg",
        media: [
          { type: "image", url: "https://cdn.shopify.com/goelia/blazer.jpg" },
        ],
        variants: [
          { id: "45537105936560", label: "Smoke Grey / XS", available: true },
          { id: "45537106034864", label: "Smoke Grey / L", available: false },
        ],
        currentPrice: 299,
        previousPrice: null,
        currency: "EUR",
        available: true,
        observedAt: "2026-08-30T12:00:00.000Z",
      },
    });
  });

  it("fetches a public Shopify product endpoint without following redirects", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify(product), {
        headers: { "set-cookie": "cart_currency=EUR; path=/" },
      }),
    );

    await expect(
      fetchShopifyProduct(
        productUrl.toString(),
        fetchImpl,
        "2026-08-30T12:00:00.000Z",
      ),
    ).resolves.toMatchObject({
      brand: { name: "GOELIA" },
      item: { currentPrice: 299 },
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      new URL(`${productUrl.toString()}.js`),
      {
        headers: { accept: "application/json" },
        redirect: "error",
      },
    );
  });

  it("uses the featured image when Shopify omits the image list", () => {
    const parsed = parseShopifyProduct(
      {
        ...product,
        images: undefined,
        featured_image: "//cdn.shopify.com/goelia/featured.jpg",
      },
      productUrl,
      "EUR",
      "2026-08-30T12:00:00.000Z",
    );

    expect(parsed.item.media).toEqual([
      { type: "image", url: "https://cdn.shopify.com/goelia/featured.jpg" },
    ]);
  });

  it("rejects non-product and local network URLs before requesting them", async () => {
    const fetchImpl = vi.fn();

    await expect(
      fetchShopifyProduct("https://example.com/collections/coats", fetchImpl),
    ).rejects.toThrow("public HTTPS Shopify product page");
    await expect(
      fetchShopifyProduct("https://127.0.0.1/products/private", fetchImpl),
    ).rejects.toThrow("public HTTPS Shopify product page");
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

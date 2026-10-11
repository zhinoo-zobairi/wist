import { describe, expect, it, vi } from "vitest";

import { createPoliteFetch, DEFAULT_USER_AGENT } from "./politeFetch.js";
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
    ).rejects.toThrow("public HTTPS Shopify product page");
    expect(fetchImpl).not.toHaveBeenCalled();
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

  it("sends the Wist user agent on every storefront request", async () => {
    const seen: { url: string; userAgent: string | null }[] = [];
    const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
      seen.push({
        url: String(input),
        userAgent: new Headers(init?.headers).get("user-agent"),
      });
      return new Response("", { status: 404 });
    }) as typeof fetch;
    const politeFetch = createPoliteFetch({
      userAgent: DEFAULT_USER_AGENT,
      minHostSpacingMs: 10_000,
      robotsTtlMs: 86_400_000,
      fetchImpl,
      sleep: async () => {},
    });

    for (const url of [
      "https://www.bobbies.com/en/opera.html",
      "https://de.sandro-paris.com/de/p/x.html",
      "https://shop.example/products/x",
    ]) {
      await fetchProductObservation(url, politeFetch).catch(() => undefined);
    }

    expect(seen.length).toBeGreaterThanOrEqual(6); // robots.txt and product per host
    expect(seen.every((request) => request.userAgent === DEFAULT_USER_AGENT)).toBe(true);
  });
});

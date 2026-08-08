import { describe, expect, it, vi } from "vitest";

import {
  fetchSandroProduct,
  parseSandroProductPage,
} from "./sandroProduct.js";

const product = {
  "@context": "https://schema.org",
  "@type": "Product",
  name: "Tweed-Kleid",
  sku: "3607170000001",
  image: "https://de.sandro-paris.com/image.jpg",
  offers: {
    "@type": "Offer",
    url: "https://de.sandro-paris.com/de/p/tweed-kleid/3607170000001.html",
    availability: "https://schema.org/InStock",
    priceCurrency: "EUR",
    price: "345.00",
  },
};

const html = `
  <script type="application/ld+json">{"@type":"WebSite"}</script>
  <script type="application/ld+json">${JSON.stringify(product)}</script>
`;

describe("Sandro product", () => {
  it("normalizes Product JSON-LD into the catalogue model", () => {
    expect(
      parseSandroProductPage(html, "2026-08-08T12:00:00.000Z"),
    ).toEqual({
      id: "sandro-3607170000001",
      source: "sandro",
      sourceProductId: "3607170000001",
      brandId: "sandro",
      name: "Tweed-Kleid",
      url: "https://de.sandro-paris.com/de/p/tweed-kleid/3607170000001.html",
      imageUrl: "https://de.sandro-paris.com/image.jpg",
      currentPrice: 345,
      previousPrice: null,
      currency: "EUR",
      available: true,
      observedAt: "2026-08-08T12:00:00.000Z",
    });
  });

  it("fetches one explicit German Sandro product page", async () => {
    const fetchImpl = vi.fn(async () => new Response(html));

    await expect(
      fetchSandroProduct(
        "https://de.sandro-paris.com/de/p/tweed-kleid/SFPRO00001.html",
        fetchImpl,
        "2026-08-08T12:00:00.000Z",
      ),
    ).resolves.toMatchObject({ sourceProductId: "3607170000001" });
    expect(fetchImpl).toHaveBeenCalledWith(
      new URL(
        "https://de.sandro-paris.com/de/p/tweed-kleid/SFPRO00001.html",
      ),
      {
        headers: { accept: "text/html" },
        redirect: "error",
      },
    );
  });

  it("rejects URLs outside the explicit Sandro product boundary", async () => {
    const fetchImpl = vi.fn();

    await expect(
      fetchSandroProduct(
        "http://127.0.0.1/private",
        fetchImpl,
      ),
    ).rejects.toThrow("URL must be an HTTPS product page");
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

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
      media: [
        { type: "image", url: "https://de.sandro-paris.com/image.jpg" },
      ],
      currentPrice: 345,
      previousPrice: null,
      currency: "EUR",
      available: true,
      observedAt: "2026-08-08T12:00:00.000Z",
    });
  });

  it("preserves Sandro style-colour SKUs and discounted current prices", () => {
    const discountedProduct = {
      ...product,
      name: "Cardigan aus Wolle",
      sku: "SFPCA01366_44",
      offers: {
        ...product.offers,
        url: "https://de.sandro-paris.com/de/p/cardigan-aus-wolle/SFPCA01366_44.html",
        price: "171.00",
      },
    };

    expect(
      parseSandroProductPage(
        `<script type="application/ld+json">${JSON.stringify(discountedProduct)}</script>`,
        "2026-08-08T12:00:00.000Z",
      ),
    ).toMatchObject({
      id: "sandro-SFPCA01366_44",
      sourceProductId: "SFPCA01366_44",
      name: "Cardigan aus Wolle",
      currentPrice: 171,
      previousPrice: null,
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

  it("rejects Sandro's separate second-hand storefront", async () => {
    const fetchImpl = vi.fn();

    await expect(
      fetchSandroProduct(
        "https://secondemain.sandro-paris.com/de_DE/products/bermuda-droit-a-bande-strassee-SFPSH00557",
        fetchImpl,
      ),
    ).rejects.toThrow("URL must be an HTTPS product page");
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

import { describe, expect, it, vi } from "vitest";

import {
  fetchBobbiesProduct,
  parseBobbiesProductPage,
} from "./bobbiesProduct.js";

const product = {
  "@context": "http://schema.org/",
  "@type": "Product",
  name: "Opéra - Iridescent Champagne",
  sku: "L-M24WO-OPE01",
  gtin13: "3663902758263",
  image: "https://images.bobbies.com/opera.jpg",
  offers: {
    "@type": "Offer",
    url: "https://www.bobbies.com/en/4000785248-opera-iridescent-champagne-3663902758263.html",
    availability: "http://schema.org/InStock",
    priceCurrency: "EUR",
    price: "225",
    image: [
      "https://images.bobbies.com/opera-front.jpg",
      "https://images.bobbies.com/opera-side.jpg",
    ],
  },
};

const html = `
  <script type="application/ld+json">{"@type":"Organization"}</script>
  <script type="application/ld+json">${JSON.stringify(product)}</script>
  <video src="https://videos.bobbies.com/produits/opera_normal.mp4" autoplay></video>
`;

describe("Bobbies product", () => {
  it("normalizes Product JSON-LD into the catalogue model", () => {
    expect(
      parseBobbiesProductPage(html, "2026-08-08T12:00:00.000Z"),
    ).toEqual({
      id: "bobbies-L-M24WO-OPE01",
      source: "bobbies",
      sourceProductId: "L-M24WO-OPE01",
      brandId: "bobbies",
      name: "Opéra - Iridescent Champagne",
      url: "https://www.bobbies.com/en/4000785248-opera-iridescent-champagne-3663902758263.html",
      imageUrl: "https://images.bobbies.com/opera.jpg",
      media: [
        { type: "image", url: "https://images.bobbies.com/opera-front.jpg" },
        { type: "image", url: "https://images.bobbies.com/opera-side.jpg" },
        { type: "video", url: "https://videos.bobbies.com/produits/opera_normal.mp4" },
      ],
      currentPrice: 225,
      previousPrice: null,
      currency: "EUR",
      available: true,
      observedAt: "2026-08-08T12:00:00.000Z",
    });
  });

  it("fetches one explicit English Bobbies product page", async () => {
    const fetchImpl = vi.fn(async () => new Response(html));
    const url =
      "https://www.bobbies.com/en/4000785248-opera-iridescent-champagne-3663902758263.html";

    await expect(
      fetchBobbiesProduct(url, fetchImpl, "2026-08-08T12:00:00.000Z"),
    ).resolves.toMatchObject({ sourceProductId: "L-M24WO-OPE01" });
    expect(fetchImpl).toHaveBeenCalledWith(new URL(url), {
      headers: { accept: "text/html" },
      redirect: "error",
    });
  });

  it("rejects URLs outside the explicit Bobbies product boundary", async () => {
    const fetchImpl = vi.fn();

    await expect(
      fetchBobbiesProduct("https://example.com/en/product.html", fetchImpl),
    ).rejects.toThrow("URL must be an HTTPS English product page");
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

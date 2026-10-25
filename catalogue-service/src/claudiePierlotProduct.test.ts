import { readFileSync } from "node:fs";

import { describe, expect, it, vi } from "vitest";

import {
  fetchClaudiePierlotProduct,
  parseClaudiePierlotProductPage,
} from "./claudiePierlotProduct.js";

const html = readFileSync(
  new URL("./fixtures/claudie-pierlot-product.html", import.meta.url),
  "utf8",
);
const productUrl =
  "https://de.claudiepierlot.com/de_DE/p/mittellanger-lederrock/christine/CFPJU00921_C016.html";

describe("Claudie Pierlot product", () => {
  it("normalizes the real page's Product JSON-LD into the catalogue model", () => {
    expect(
      parseClaudiePierlotProductPage(html, "2026-10-11T12:00:00.000Z"),
    ).toEqual({
      id: "claudie-pierlot-CFPJU00921_C016",
      source: "claudie-pierlot",
      sourceProductId: "CFPJU00921_C016",
      brandId: "claudie-pierlot",
      name: "Mittellanger Lederrock",
      url: productUrl,
      imageUrl:
        "https://de.claudiepierlot.com/dw/image/v2/BCND_PRD/on/demandware.static/-/Sites-claudie-master-catalog/default/dwe0e466f3/images/hi-res/Claudie_CFPJU00921-C016_F_1.jpg?sw=800",
      media: [
        {
          type: "image",
          url: "https://de.claudiepierlot.com/dw/image/v2/BCND_PRD/on/demandware.static/-/Sites-claudie-master-catalog/default/dwe0e466f3/images/hi-res/Claudie_CFPJU00921-C016_F_1.jpg",
        },
      ],
      variants: [],
      currentPrice: 455,
      previousPrice: null,
      currency: "EUR",
      available: true,
      observedAt: "2026-10-11T12:00:00.000Z",
    });
  });

  it("rejects a URL on another host", async () => {
    const fetchImpl = vi.fn();

    await expect(
      fetchClaudiePierlotProduct(
        "https://www.claudiepierlot.com/de_DE/p/x/y/CFPJU00921_C016.html",
        fetchImpl,
      ),
    ).rejects.toThrow("URL must be an HTTPS product page");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rejects a non-product path on the right host", async () => {
    const fetchImpl = vi.fn();

    await expect(
      fetchClaudiePierlotProduct(
        "https://de.claudiepierlot.com/de_DE/bekleidung/",
        fetchImpl,
      ),
    ).rejects.toThrow("URL must be an HTTPS product page");
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

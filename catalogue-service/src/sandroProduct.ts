import {
  fetchJsonLdProduct,
  parseJsonLdProductPage,
  type JsonLdStorefront,
} from "./jsonLdProduct.js";
import type { CatalogueItem } from "./model.js";

type Fetch = typeof fetch;

export const sandroStorefront: JsonLdStorefront = {
  source: "sandro",
  brand: { id: "sandro", name: "Sandro" },
  host: "de.sandro-paris.com",
  pageKind: "product page",
  validatePath: (url) => url.pathname.startsWith("/de/p/"),
  maxHtmlBytes: 1_000_000,
  acceptsHttpSchemaOrg: false,
};

export function parseSandroProductPage(
  html: string,
  observedAt: string,
): CatalogueItem {
  return parseJsonLdProductPage(sandroStorefront, html, observedAt);
}

export function fetchSandroProduct(
  productUrl: string,
  fetchImpl: Fetch = fetch,
  observedAt = new Date().toISOString(),
): Promise<CatalogueItem> {
  return fetchJsonLdProduct(sandroStorefront, productUrl, fetchImpl, observedAt);
}

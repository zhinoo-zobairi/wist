import type {
  CatalogueBrand,
  CatalogueItem,
  CatalogueMedia,
  CatalogueVariant,
} from "./model.js";

type Fetch = typeof fetch;
export type JsonObject = Record<string, unknown>;

export type JsonLdStorefront = {
  source: CatalogueItem["source"];
  brand: CatalogueBrand;
  /** Exact hostname, e.g. "de.sandro-paris.com". */
  host: string;
  /** Names the accepted page in the URL error, e.g. "English product page". */
  pageKind: string;
  /** Product-path shape check, optional. */
  validatePath?: (url: URL) => boolean;
  maxHtmlBytes: number;
  /** Whether http://schema.org/InStock counts as available. */
  acceptsHttpSchemaOrg: boolean;
  /** Fail when the offer carries no availability at all. */
  requiresAvailability?: boolean;
  /** Storefront extras the JSON-LD does not carry (sizes, extra media). */
  extend?: (
    html: string,
    product: JsonObject,
    offers: JsonObject,
  ) => Partial<{ variants: CatalogueVariant[]; media: CatalogueMedia[] }>;
};

export function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function requiredString(
  value: unknown,
  field: string,
  label: string,
): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} product is missing ${field}`);
  }
  return value.trim();
}

function firstImage(value: unknown, label: string): string {
  if (typeof value === "string") return requiredString(value, "image", label);
  if (Array.isArray(value)) return requiredString(value[0], "image", label);
  throw new Error(`${label} product is missing image`);
}

function productJsonLd(html: string, label: string): JsonObject {
  const scriptPattern =
    /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

  for (const match of html.matchAll(scriptPattern)) {
    const script = match[1]?.trim();
    if (!script) continue;

    let value: unknown;
    try {
      value = JSON.parse(script);
    } catch {
      continue;
    }

    const candidates = Array.isArray(value) ? value : [value];
    const product = candidates.find(
      (candidate) => isObject(candidate) && candidate["@type"] === "Product",
    );
    if (isObject(product)) return product;
  }

  throw new Error(`${label} page does not contain Product JSON-LD`);
}

export function parseJsonLdProductPage(
  store: JsonLdStorefront,
  html: string,
  observedAt: string,
): CatalogueItem {
  const label = store.brand.name;
  const product = productJsonLd(html, label);
  const offers = product.offers;
  if (!isObject(offers)) {
    throw new Error(`${label} product is missing offers`);
  }

  const sourceProductId = requiredString(product.sku, "sku", label);
  const imageUrl = firstImage(product.image, label);
  const price = Number(offers.price);
  if (!Number.isFinite(price) || price < 0) {
    throw new Error(`${label} product has an invalid price`);
  }

  const availability = store.requiresAvailability
    ? requiredString(offers.availability, "availability", label)
    : offers.availability;
  const available =
    availability === "https://schema.org/InStock" ||
    (store.acceptsHttpSchemaOrg && availability === "http://schema.org/InStock");

  return {
    id: `${store.brand.id}-${sourceProductId}`,
    source: store.source,
    sourceProductId,
    brandId: store.brand.id,
    name: requiredString(product.name, "name", label),
    url: requiredString(offers.url, "offer URL", label),
    imageUrl,
    media: [{ type: "image", url: imageUrl }],
    variants: [],
    ...store.extend?.(html, product, offers),
    currentPrice: price,
    previousPrice: null,
    currency: requiredString(offers.priceCurrency, "price currency", label),
    available,
    observedAt,
  };
}

function validateProductUrl(store: JsonLdStorefront, value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`A valid ${store.brand.name} product URL is required`);
  }

  if (
    url.protocol !== "https:" ||
    url.hostname !== store.host ||
    (store.validatePath && !store.validatePath(url))
  ) {
    throw new Error(
      `URL must be an HTTPS ${store.pageKind} on ${store.host}`,
    );
  }
  return url;
}

async function readBoundedHtml(
  response: Response,
  store: JsonLdStorefront,
): Promise<string> {
  if (!response.body) return "";

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const chunks: string[] = [];
  let bytesRead = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytesRead += value.byteLength;
    if (bytesRead > store.maxHtmlBytes) {
      await reader.cancel();
      throw new Error(
        `${store.brand.name} page exceeds ${store.maxHtmlBytes} bytes`,
      );
    }
    chunks.push(decoder.decode(value, { stream: true }));
  }
  chunks.push(decoder.decode());
  return chunks.join("");
}

export async function fetchJsonLdProduct(
  store: JsonLdStorefront,
  productUrl: string,
  fetchImpl: Fetch,
  observedAt: string,
): Promise<CatalogueItem> {
  const url = validateProductUrl(store, productUrl);
  const response = await fetchImpl(url, {
    headers: { accept: "text/html" },
    redirect: "error",
  });
  if (!response.ok) {
    throw new Error(
      `${store.brand.name} product request failed with HTTP ${response.status}`,
    );
  }
  return parseJsonLdProductPage(
    store,
    await readBoundedHtml(response, store),
    observedAt,
  );
}

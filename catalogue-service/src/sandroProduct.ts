import type { CatalogueItem } from "./model.js";

type Fetch = typeof fetch;

const sandroHost = "de.sandro-paris.com";
const maxPageBytes = 1_000_000;

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Sandro product is missing ${field}`);
  }
  return value.trim();
}

function firstImage(value: unknown): string {
  if (typeof value === "string") return requiredString(value, "image");
  if (Array.isArray(value)) return requiredString(value[0], "image");
  throw new Error("Sandro product is missing image");
}

function productJsonLd(html: string): JsonObject {
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

  throw new Error("Sandro page does not contain Product JSON-LD");
}

export function parseSandroProductPage(
  html: string,
  observedAt: string,
): CatalogueItem {
  const product = productJsonLd(html);
  const offers = product.offers;
  if (!isObject(offers)) {
    throw new Error("Sandro product is missing offers");
  }

  const sourceProductId = requiredString(product.sku, "sku");
  const imageUrl = firstImage(product.image);
  const price = Number(offers.price);
  if (!Number.isFinite(price) || price < 0) {
    throw new Error("Sandro product has an invalid price");
  }

  return {
    id: `sandro-${sourceProductId}`,
    source: "sandro",
    sourceProductId,
    brandId: "sandro",
    name: requiredString(product.name, "name"),
    url: requiredString(offers.url, "offer URL"),
    imageUrl,
    media: [{ type: "image", url: imageUrl }],
    currentPrice: price,
    previousPrice: null,
    currency: requiredString(offers.priceCurrency, "price currency"),
    available: offers.availability === "https://schema.org/InStock",
    observedAt,
  };
}

function validateSandroProductUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("A valid Sandro product URL is required");
  }

  if (
    url.protocol !== "https:" ||
    url.hostname !== sandroHost ||
    !url.pathname.startsWith("/de/p/")
  ) {
    throw new Error(
      `URL must be an HTTPS product page on ${sandroHost}`,
    );
  }
  return url;
}

async function readBoundedHtml(response: Response): Promise<string> {
  if (!response.body) return "";

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const chunks: string[] = [];
  let bytesRead = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytesRead += value.byteLength;
    if (bytesRead > maxPageBytes) {
      await reader.cancel();
      throw new Error(`Sandro page exceeds ${maxPageBytes} bytes`);
    }
    chunks.push(decoder.decode(value, { stream: true }));
  }
  chunks.push(decoder.decode());
  return chunks.join("");
}

export async function fetchSandroProduct(
  productUrl: string,
  fetchImpl: Fetch = fetch,
  observedAt = new Date().toISOString(),
): Promise<CatalogueItem> {
  const url = validateSandroProductUrl(productUrl);
  const response = await fetchImpl(url, {
    headers: { accept: "text/html" },
    redirect: "error",
  });
  if (!response.ok) {
    throw new Error(`Sandro product request failed with HTTP ${response.status}`);
  }
  return parseSandroProductPage(await readBoundedHtml(response), observedAt);
}

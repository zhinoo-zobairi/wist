import type { CatalogueItem } from "./model.js";

type Fetch = typeof fetch;
type JsonObject = Record<string, unknown>;

const bobbiesHost = "www.bobbies.com";
const maxPageBytes = 1_000_000;

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Bobbies product is missing ${field}`);
  }
  return value.trim();
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

  throw new Error("Bobbies page does not contain Product JSON-LD");
}

export function parseBobbiesProductPage(
  html: string,
  observedAt: string,
): CatalogueItem {
  const product = productJsonLd(html);
  const offers = product.offers;
  if (!isObject(offers)) {
    throw new Error("Bobbies product is missing offers");
  }

  const sourceProductId = requiredString(product.sku, "sku");
  const price = Number(offers.price);
  if (!Number.isFinite(price) || price < 0) {
    throw new Error("Bobbies product has an invalid price");
  }

  const availability = requiredString(offers.availability, "availability");

  return {
    id: `bobbies-${sourceProductId}`,
    source: "bobbies",
    sourceProductId,
    brandId: "bobbies",
    name: requiredString(product.name, "name"),
    url: requiredString(offers.url, "offer URL"),
    imageUrl: requiredString(product.image, "image"),
    currentPrice: price,
    previousPrice: null,
    currency: requiredString(offers.priceCurrency, "price currency"),
    available:
      availability === "http://schema.org/InStock" ||
      availability === "https://schema.org/InStock",
    observedAt,
  };
}

function validateBobbiesProductUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("A valid Bobbies product URL is required");
  }

  if (
    url.protocol !== "https:" ||
    url.hostname !== bobbiesHost ||
    !url.pathname.startsWith("/en/") ||
    !url.pathname.endsWith(".html")
  ) {
    throw new Error(`URL must be an HTTPS English product page on ${bobbiesHost}`);
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
      throw new Error(`Bobbies page exceeds ${maxPageBytes} bytes`);
    }
    chunks.push(decoder.decode(value, { stream: true }));
  }
  chunks.push(decoder.decode());
  return chunks.join("");
}

export async function fetchBobbiesProduct(
  productUrl: string,
  fetchImpl: Fetch = fetch,
  observedAt = new Date().toISOString(),
): Promise<CatalogueItem> {
  const url = validateBobbiesProductUrl(productUrl);
  const response = await fetchImpl(url, {
    headers: { accept: "text/html" },
    redirect: "error",
  });
  if (!response.ok) {
    throw new Error(`Bobbies product request failed with HTTP ${response.status}`);
  }
  return parseBobbiesProductPage(await readBoundedHtml(response), observedAt);
}

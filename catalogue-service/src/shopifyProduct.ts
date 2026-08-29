import { isIP } from "node:net";

import type { CatalogueBrand, CatalogueItem } from "./model.js";

type Fetch = typeof fetch;
type JsonObject = Record<string, unknown>;

const maxProductBytes = 512_000;

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Shopify product is missing ${field}`);
  }
  return value.trim();
}

function requiredNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`Shopify product has an invalid ${field}`);
  }
  return value;
}

function absoluteImageUrl(value: unknown): string {
  const url = requiredString(value, "image");
  return url.startsWith("//") ? `https:${url}` : url;
}

function identifier(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function currencyFrom(response: Response): string {
  const cookies = response.headers.get("set-cookie") ?? "";
  const currency = cookies.match(/(?:^|[,;]\s*)cart_currency=([A-Z]{3})/)?.[1];
  if (!currency) {
    throw new Error("Shopify response did not identify its currency");
  }
  return currency;
}

function validateProductUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("A valid Shopify product URL is required");
  }

  const parts = url.pathname.split("/").filter(Boolean);
  const productsIndex = parts.indexOf("products");
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.hostname === "localhost" ||
    isIP(url.hostname) !== 0 ||
    productsIndex < 0 ||
    !parts[productsIndex + 1] ||
    parts.length !== productsIndex + 2
  ) {
    throw new Error("URL must be a public HTTPS Shopify product page");
  }
  url.hash = "";
  return url;
}

async function readBoundedJson(response: Response): Promise<unknown> {
  if (!response.body) throw new Error("Shopify product response is empty");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const chunks: string[] = [];
  let bytesRead = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytesRead += value.byteLength;
    if (bytesRead > maxProductBytes) {
      await reader.cancel();
      throw new Error(`Shopify product exceeds ${maxProductBytes} bytes`);
    }
    chunks.push(decoder.decode(value, { stream: true }));
  }
  chunks.push(decoder.decode());

  try {
    return JSON.parse(chunks.join(""));
  } catch {
    throw new Error("Storefront did not return Shopify product JSON");
  }
}

export function parseShopifyProduct(
  value: unknown,
  productUrl: URL,
  currency: string,
  observedAt: string,
): { brand: CatalogueBrand; item: CatalogueItem } {
  if (!isObject(value)) throw new Error("Storefront returned an invalid Shopify product");
  if (currency !== "EUR") {
    throw new Error(`Unsupported Shopify currency: ${currency}`);
  }

  const sourceProductId = String(requiredNumber(value.id, "id"));
  const brandName = requiredString(value.vendor, "vendor");
  const brandId = `shopify-${identifier(productUrl.hostname)}`;
  const images = Array.isArray(value.images)
    ? value.images.map(absoluteImageUrl)
    : [];
  const imageUrl = images[0] ?? absoluteImageUrl(value.featured_image);
  const mediaImages = images.length > 0 ? images : [imageUrl];
  const variants = Array.isArray(value.variants)
    ? value.variants.map((candidate) => {
        if (!isObject(candidate) || typeof candidate.available !== "boolean") {
          throw new Error("Shopify product has invalid variants");
        }
        return {
          id: String(requiredNumber(candidate.id, "variant id")),
          label: requiredString(candidate.title, "variant title"),
          available: candidate.available,
        };
      })
    : [];

  return {
    brand: { id: brandId, name: brandName },
    item: {
      id: `${brandId}-${sourceProductId}`,
      source: "shopify",
      sourceProductId,
      brandId,
      name: requiredString(value.title, "title"),
      url: productUrl.toString(),
      imageUrl,
      media: mediaImages.map((url) => ({ type: "image", url })),
      variants,
      currentPrice: requiredNumber(value.price, "price") / 100,
      previousPrice: null,
      currency,
      available: value.available === true,
      observedAt,
    },
  };
}

export async function fetchShopifyProduct(
  productUrl: string,
  fetchImpl: Fetch = fetch,
  observedAt = new Date().toISOString(),
) {
  const url = validateProductUrl(productUrl);
  const endpoint = new URL(url);
  endpoint.pathname = `${endpoint.pathname}.js`;
  const response = await fetchImpl(endpoint, {
    headers: { accept: "application/json" },
    redirect: "error",
  });
  if (!response.ok) {
    throw new Error(`Shopify product request failed with HTTP ${response.status}`);
  }
  return parseShopifyProduct(
    await readBoundedJson(response),
    url,
    currencyFrom(response),
    observedAt,
  );
}

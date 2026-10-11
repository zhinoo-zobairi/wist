import {
  fetchJsonLdProduct,
  parseJsonLdProductPage,
  requiredString,
  type JsonLdStorefront,
  type JsonObject,
} from "./jsonLdProduct.js";
import type {
  CatalogueItem,
  CatalogueMedia,
  CatalogueVariant,
} from "./model.js";

type Fetch = typeof fetch;

function strings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (!Array.isArray(value)) return [];
  return value.filter(
    (candidate): candidate is string =>
      typeof candidate === "string" && candidate.trim().length > 0,
  );
}

function productMedia(
  html: string,
  product: JsonObject,
  offers: JsonObject,
): CatalogueMedia[] {
  const fallbackImage = requiredString(product.image, "image", "Bobbies");
  const images = strings(offers.image);
  const videoPattern = /<video\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi;
  const videos = [...html.matchAll(videoPattern)]
    .map((match) => match[1]?.trim())
    .filter((url): url is string => Boolean(url));

  return [
    ...(images.length > 0 ? images : [fallbackImage]).map(
      (url): CatalogueMedia => ({ type: "image", url }),
    ),
    ...videos.map((url): CatalogueMedia => ({ type: "video", url })),
  ].filter(
    (media, index, all) =>
      all.findIndex(
        (candidate) =>
          candidate.type === media.type && candidate.url === media.url,
      ) === index,
  );
}

function productVariants(html: string): CatalogueVariant[] {
  const rowPattern =
    /<li\b[^>]*class=["'][^"']*\bcustom-dropdown__item\b[^"']*\bvariant\b[^"']*["'][^>]*>([\s\S]*?)<\/li>/gi;

  return [...html.matchAll(rowPattern)].flatMap((match) => {
    const row = match[0];
    const content = match[1] ?? "";
    const id = row.match(/\bdata-value=["']r-variant-\d+-([^"']+)["']/i)?.[1];
    const label = content
      .match(
        /<span\b[^>]*class=["'][^"']*\bdisplay-fr\b[^"']*["'][^>]*>([^<]+)<\/span>/i,
      )?.[1]
      ?.trim();
    if (!id || !label) return [];
    return [
      {
        id,
        label,
        available: !/\bvariant--alert\b/i.test(row),
      },
    ];
  });
}

export const bobbiesStorefront: JsonLdStorefront = {
  source: "bobbies",
  brand: { id: "bobbies", name: "Bobbies" },
  host: "www.bobbies.com",
  pageKind: "English product page",
  validatePath: (url) =>
    url.pathname.startsWith("/en/") && url.pathname.endsWith(".html"),
  maxHtmlBytes: 1_000_000,
  acceptsHttpSchemaOrg: true,
  requiresAvailability: true,
  extend: (html, product, offers) => ({
    media: productMedia(html, product, offers),
    variants: productVariants(html),
  }),
};

export function parseBobbiesProductPage(
  html: string,
  observedAt: string,
): CatalogueItem {
  return parseJsonLdProductPage(bobbiesStorefront, html, observedAt);
}

export function fetchBobbiesProduct(
  productUrl: string,
  fetchImpl: Fetch = fetch,
  observedAt = new Date().toISOString(),
): Promise<CatalogueItem> {
  return fetchJsonLdProduct(bobbiesStorefront, productUrl, fetchImpl, observedAt);
}

import type { Brand, Item, ItemMedia } from "../types";

type Fetch = typeof fetch;
type JsonObject = Record<string, unknown>;

export type Catalogue = {
  brands: Brand[];
  items: Item[];
};

const defaultBaseUrl =
  process.env.EXPO_PUBLIC_CATALOGUE_URL ?? "http://127.0.0.1:4000";
const defaultOwnerToken = process.env.EXPO_PUBLIC_CATALOGUE_OWNER_TOKEN;

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringField(object: JsonObject, field: string): string {
  const value = object[field];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Catalogue response is missing ${field}`);
  }
  return value;
}

function toBrand(value: unknown): Brand {
  if (!isObject(value)) throw new Error("Catalogue returned an invalid brand");
  const id = stringField(value, "id");
  const name = stringField(value, "name");
  const monogram = name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return { id, name, monogram, curated: true };
}

function toItem(value: unknown): Item {
  if (!isObject(value)) throw new Error("Catalogue returned an invalid item");
  const currentPrice = value.currentPrice;
  const currency = stringField(value, "currency");
  if (typeof currentPrice !== "number" || !Number.isFinite(currentPrice)) {
    throw new Error("Catalogue response has an invalid currentPrice");
  }
  if (currency !== "EUR") {
    throw new Error(`Unsupported catalogue currency: ${currency}`);
  }
  const available = value.available;
  const observedAt = value.observedAt;
  const previousPrice = value.previousPrice;
  if (typeof available !== "boolean" || typeof observedAt !== "string") {
    throw new Error("Catalogue response is missing observation details");
  }
  if (previousPrice !== null && typeof previousPrice !== "number") {
    throw new Error("Catalogue response has an invalid previousPrice");
  }
  if (!Array.isArray(value.media)) {
    throw new Error("Catalogue response is missing product media");
  }
  const media = value.media.map((candidate): ItemMedia => {
    if (!isObject(candidate)) {
      throw new Error("Catalogue response has invalid product media");
    }
    const type = stringField(candidate, "type");
    if (type !== "image" && type !== "video") {
      throw new Error(`Unsupported product media type: ${type}`);
    }
    return { type, url: stringField(candidate, "url") };
  });
  return {
    id: stringField(value, "id"),
    brandId: stringField(value, "brandId"),
    name: stringField(value, "name"),
    imageUrl: stringField(value, "imageUrl"),
    media,
    currentPrice,
    currency,
    url: stringField(value, "url"),
    available,
    observedAt,
    previousPrice,
    sourceProductId: stringField(value, "sourceProductId"),
  };
}

async function responseJson(response: Response): Promise<JsonObject> {
  if (!response.ok) {
    throw new Error(`Catalogue request failed with HTTP ${response.status}`);
  }
  const value: unknown = await response.json();
  if (!isObject(value)) throw new Error("Catalogue returned invalid JSON");
  return value;
}

export async function loadCatalogue(
  fetchImpl: Fetch = fetch,
  baseUrl = defaultBaseUrl,
): Promise<Catalogue> {
  const root = baseUrl.replace(/\/$/, "");
  const brandsBody = await responseJson(
    await fetchImpl(`${root}/v1/brands`, { headers: { accept: "application/json" } }),
  );
  if (!Array.isArray(brandsBody.brands)) {
    throw new Error("Catalogue response is missing brands");
  }

  const brands = brandsBody.brands.map(toBrand);
  const items: Item[] = [];
  for (const brand of brands) {
    const itemsBody = await responseJson(
      await fetchImpl(`${root}/v1/brands/${encodeURIComponent(brand.id)}/items`, {
        headers: { accept: "application/json" },
      }),
    );
    if (!Array.isArray(itemsBody.items)) {
      throw new Error("Catalogue response is missing items");
    }
    items.push(...itemsBody.items.map(toItem));
  }

  return { brands, items };
}

function authorizationHeaders(ownerToken: string | undefined) {
  if (!ownerToken) {
    throw new Error("EXPO_PUBLIC_CATALOGUE_OWNER_TOKEN is required");
  }
  return {
    accept: "application/json",
    authorization: `Bearer ${ownerToken}`,
  };
}

export async function loadWatchedItemIds(
  fetchImpl: Fetch = fetch,
  baseUrl = defaultBaseUrl,
  ownerToken = defaultOwnerToken,
): Promise<string[]> {
  const root = baseUrl.replace(/\/$/, "");
  const body = await responseJson(
    await fetchImpl(`${root}/v1/watches`, {
      headers: authorizationHeaders(ownerToken),
    }),
  );
  if (
    !Array.isArray(body.itemIds) ||
    !body.itemIds.every((itemId) => typeof itemId === "string")
  ) {
    throw new Error("Catalogue response has invalid watch item IDs");
  }
  return body.itemIds;
}

export async function setCatalogueWatch(
  itemId: string,
  watched: boolean,
  fetchImpl: Fetch = fetch,
  baseUrl = defaultBaseUrl,
  ownerToken = defaultOwnerToken,
): Promise<void> {
  const root = baseUrl.replace(/\/$/, "");
  const body = await responseJson(
    await fetchImpl(`${root}/v1/watches/${encodeURIComponent(itemId)}`, {
      headers: authorizationHeaders(ownerToken),
      method: watched ? "PUT" : "DELETE",
    }),
  );
  if (body.itemId !== itemId || body.watched !== watched) {
    throw new Error("Catalogue returned an invalid watch result");
  }
}

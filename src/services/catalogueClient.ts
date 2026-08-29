import {
  LOCAL_USER_ID,
  type Alert,
  type Brand,
  type Item,
  type ItemMedia,
  type ItemVariant,
  OCCASION_OPTIONS,
  STYLE_OPTIONS,
  type Occasion,
  type Style,
  type StyleProfile,
} from "../types";

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
  if (!Array.isArray(value.variants)) {
    throw new Error("Catalogue response is missing product variants");
  }
  const variants = value.variants.map((candidate): ItemVariant => {
    if (!isObject(candidate)) {
      throw new Error("Catalogue response has invalid product variants");
    }
    if (typeof candidate.available !== "boolean") {
      throw new Error("Catalogue response has invalid variant availability");
    }
    return {
      id: stringField(candidate, "id"),
      label: stringField(candidate, "label"),
      available: candidate.available,
    };
  });
  return {
    id: stringField(value, "id"),
    brandId: stringField(value, "brandId"),
    name: stringField(value, "name"),
    imageUrl: stringField(value, "imageUrl"),
    media,
    variants,
    currentPrice,
    currency,
    url: stringField(value, "url"),
    available,
    observedAt,
    previousPrice,
    sourceProductId: stringField(value, "sourceProductId"),
  };
}

function toAlert(value: unknown): Alert {
  if (!isObject(value)) throw new Error("Catalogue returned an invalid alert");
  const oldPrice = value.oldPrice;
  const newPrice = value.newPrice;
  const pctOff = value.pctOff;
  if (
    typeof oldPrice !== "number" ||
    typeof newPrice !== "number" ||
    typeof pctOff !== "number" ||
    !Number.isFinite(oldPrice) ||
    !Number.isFinite(newPrice) ||
    !Number.isFinite(pctOff)
  ) {
    throw new Error("Catalogue response has invalid alert prices");
  }
  if (stringField(value, "currency") !== "EUR") {
    throw new Error("Catalogue response has an unsupported alert currency");
  }
  return {
    id: stringField(value, "id"),
    userId: LOCAL_USER_ID,
    itemId: stringField(value, "itemId"),
    oldPrice,
    newPrice,
    pctOff,
    createdAt: stringField(value, "observedAt"),
    read: false,
  };
}

function toStyleProfile(value: unknown): StyleProfile {
  if (!isObject(value)) {
    throw new Error("Catalogue returned an invalid style profile");
  }
  if (!Array.isArray(value.occasions) || !Array.isArray(value.styles)) {
    throw new Error("Catalogue response is missing style profile selections");
  }
  const occasionIds = new Set(value.occasions);
  const styleIds = new Set(value.styles);
  const validOccasions = new Set(OCCASION_OPTIONS.map((option) => option.id));
  const validStyles = new Set(STYLE_OPTIONS.map((option) => option.id));
  if (
    occasionIds.size !== value.occasions.length ||
    styleIds.size !== value.styles.length ||
    value.styles.length > 3 ||
    value.occasions.some((occasion) => !validOccasions.has(occasion as Occasion)) ||
    value.styles.some((style) => !validStyles.has(style as Style))
  ) {
    throw new Error("Catalogue returned invalid style profile selections");
  }

  return {
    occasions: OCCASION_OPTIONS.map((option) => option.id).filter((occasion) =>
      occasionIds.has(occasion),
    ),
    styles: STYLE_OPTIONS.map((option) => option.id).filter((style) =>
      styleIds.has(style),
    ),
    updatedAt: stringField(value, "updatedAt"),
  };
}

async function responseJson(response: Response): Promise<JsonObject> {
  const value: unknown = await response.json();
  if (!isObject(value)) throw new Error("Catalogue returned invalid JSON");
  if (!response.ok) {
    const message = value.message;
    throw new Error(
      typeof message === "string"
        ? message
        : `Catalogue request failed with HTTP ${response.status}`,
    );
  }
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

export async function loadPriceDropAlerts(
  fetchImpl: Fetch = fetch,
  baseUrl = defaultBaseUrl,
  ownerToken = defaultOwnerToken,
): Promise<Alert[]> {
  const root = baseUrl.replace(/\/$/, "");
  const body = await responseJson(
    await fetchImpl(`${root}/v1/alerts`, {
      headers: authorizationHeaders(ownerToken),
    }),
  );
  if (!Array.isArray(body.alerts)) {
    throw new Error("Catalogue response is missing alerts");
  }
  return body.alerts.map(toAlert);
}

export async function loadStyleProfile(
  fetchImpl: Fetch = fetch,
  baseUrl = defaultBaseUrl,
  ownerToken = defaultOwnerToken,
): Promise<StyleProfile | null> {
  const root = baseUrl.replace(/\/$/, "");
  const body = await responseJson(
    await fetchImpl(`${root}/v1/profile`, {
      headers: authorizationHeaders(ownerToken),
    }),
  );
  return body.profile === null ? null : toStyleProfile(body.profile);
}

export async function saveStyleProfile(
  occasions: Occasion[],
  styles: Style[],
  fetchImpl: Fetch = fetch,
  baseUrl = defaultBaseUrl,
  ownerToken = defaultOwnerToken,
): Promise<StyleProfile> {
  const root = baseUrl.replace(/\/$/, "");
  const body = await responseJson(
    await fetchImpl(`${root}/v1/profile`, {
      body: JSON.stringify({ occasions, styles }),
      headers: {
        ...authorizationHeaders(ownerToken),
        "content-type": "application/json",
      },
      method: "PUT",
    }),
  );
  return toStyleProfile(body.profile);
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

export async function importCatalogueWatch(
  productUrl: string,
  fetchImpl: Fetch = fetch,
  baseUrl = defaultBaseUrl,
  ownerToken = defaultOwnerToken,
): Promise<string> {
  const root = baseUrl.replace(/\/$/, "");
  const body = await responseJson(
    await fetchImpl(`${root}/v1/watches`, {
      body: JSON.stringify({ url: productUrl }),
      headers: {
        ...authorizationHeaders(ownerToken),
        "content-type": "application/json",
      },
      method: "POST",
    }),
  );
  if (typeof body.itemId !== "string" || body.watched !== true) {
    throw new Error("Catalogue returned an invalid imported watch");
  }
  return body.itemId;
}

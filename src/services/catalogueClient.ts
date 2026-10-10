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
  GARMENT_CATEGORY_OPTIONS,
  FORMALITY_OPTIONS,
  WARMTH_OPTIONS,
  type Garment,
  type GarmentInput,
  type OutfitContext,
  type SuggestedOutfit,
  type OutfitBoard,
  type OutfitIdea,
  type OutfitStatus,
  type SavedOutfit,
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

export class WardrobeApiError extends Error {
  constructor(public readonly code: string, public readonly status: number) {
    super(code);
    this.name = "WardrobeApiError";
  }
}

export class UncertainWardrobeRequestError extends Error {
  constructor() {
    super("The connection ended before a response arrived. Your garment may still be processing. Refresh your wardrobe before adding it again.");
    this.name = "UncertainWardrobeRequestError";
  }
}

async function wardrobeJson(response: Response): Promise<JsonObject> {
  if (!response.ok) {
    const value: unknown = await response.json().catch(() => null);
    throw new WardrobeApiError(
      isObject(value) && typeof value.error === "string" ? value.error : "wardrobe_request_failed",
      response.status,
    );
  }
  return responseJson(response);
}

function toGarment(value: unknown): Garment {
  const invalid = () => new Error("Catalogue returned an invalid garment");
  if (!isObject(value)) throw invalid();
  const id = stringField(value, "id");
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) ||
    typeof value.name !== "string" || !value.name.trim() || value.name.length > 80 ||
    !GARMENT_CATEGORY_OPTIONS.some((option) => option.id === value.category) ||
    !FORMALITY_OPTIONS.some((option) => option.id === value.formality) ||
    !WARMTH_OPTIONS.some((option) => option.id === value.warmth) ||
    !Array.isArray(value.colors) || value.colors.length < 1 || value.colors.length > 3 ||
    value.colors.some((color) => typeof color !== "string" || !color.trim() || color.length > 24 || color !== color.trim().toLowerCase()) ||
    new Set(value.colors).size !== value.colors.length ||
    !Array.isArray(value.occasions) ||
    value.occasions.some((occasion) => !OCCASION_OPTIONS.some((option) => option.id === occasion)) ||
    new Set(value.occasions).size !== value.occasions.length ||
    (value.notes !== null && (typeof value.notes !== "string" || value.notes.length > 280)) ||
    (value.source !== "manual" && value.source !== "photo") ||
    (value.tagStatus !== "tagged" && value.tagStatus !== "untagged" && value.tagStatus !== "failed") ||
    (value.photoUrl !== null && value.photoUrl !== `/v1/wardrobe/${id}/photo`) ||
    typeof value.createdAt !== "string" || !Number.isFinite(Date.parse(value.createdAt)) ||
    typeof value.updatedAt !== "string" || !Number.isFinite(Date.parse(value.updatedAt))
  ) throw invalid();
  return {
    id, name: value.name, category: value.category as Garment["category"],
    colors: value.colors as string[], formality: value.formality as Garment["formality"],
    warmth: value.warmth as Garment["warmth"], occasions: value.occasions as Occasion[],
    notes: value.notes as string | null, source: value.source, photoUrl: value.photoUrl as string | null,
    tagStatus: value.tagStatus, createdAt: value.createdAt, updatedAt: value.updatedAt,
  };
}

export async function loadWardrobe(
  fetchImpl: Fetch = fetch, baseUrl = defaultBaseUrl, ownerToken = defaultOwnerToken,
): Promise<Garment[]> {
  const body = await wardrobeJson(await fetchImpl(`${baseUrl.replace(/\/$/, "")}/v1/wardrobe`, {
    headers: authorizationHeaders(ownerToken),
  }));
  if (!Array.isArray(body.garments)) throw new Error("Catalogue response is missing garments");
  const garments = body.garments.map(toGarment);
  if (new Set(garments.map((garment) => garment.id)).size !== garments.length) {
    throw new Error("Catalogue returned duplicate garments");
  }
  return garments;
}

export async function uploadGarmentPhoto(
  uri: string, fetchImpl: Fetch = fetch, baseUrl = defaultBaseUrl, ownerToken = defaultOwnerToken,
): Promise<Garment> {
  const headers = { ...authorizationHeaders(ownerToken), "content-type": "image/jpeg" };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 90_000);
  let uploading = false;
  try {
    const local = await fetchImpl(uri, { signal: controller.signal });
    if (!local.ok) throw new Error("Could not read the selected photo");
    const blob = await local.blob();
    if (controller.signal.aborted) throw new Error("Photo preparation timed out");
    uploading = true;
    const body = await wardrobeJson(await fetchImpl(`${baseUrl.replace(/\/$/, "")}/v1/wardrobe/photos`, {
      method: "POST", headers, body: blob, signal: controller.signal,
    }));
    return toGarment(body.garment);
  } catch (error) {
    if (uploading && !(error instanceof WardrobeApiError)) throw new UncertainWardrobeRequestError();
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export async function saveGarment(
  id: string, input: GarmentInput, fetchImpl: Fetch = fetch,
  baseUrl = defaultBaseUrl, ownerToken = defaultOwnerToken,
): Promise<Garment> {
  const body = await wardrobeJson(await fetchImpl(`${baseUrl.replace(/\/$/, "")}/v1/wardrobe/${encodeURIComponent(id)}`, {
    method: "PUT", headers: { ...authorizationHeaders(ownerToken), "content-type": "application/json" },
    body: JSON.stringify(input),
  }));
  const garment = toGarment(body.garment);
  if (garment.id !== id) throw new Error("Catalogue returned a different garment");
  return garment;
}

export async function deleteGarment(
  id: string, fetchImpl: Fetch = fetch, baseUrl = defaultBaseUrl, ownerToken = defaultOwnerToken,
): Promise<void> {
  const body = await wardrobeJson(await fetchImpl(`${baseUrl.replace(/\/$/, "")}/v1/wardrobe/${encodeURIComponent(id)}`, {
    method: "DELETE", headers: authorizationHeaders(ownerToken),
  }));
  if (body.id !== id || body.deleted !== true) throw new Error("Catalogue returned an invalid deletion result");
}

export async function retagGarment(
  id: string, force = false, fetchImpl: Fetch = fetch,
  baseUrl = defaultBaseUrl, ownerToken = defaultOwnerToken,
): Promise<Garment> {
  const headers = { ...authorizationHeaders(ownerToken), "content-type": "application/json" };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 90_000);
  try {
    const body = await wardrobeJson(await fetchImpl(`${baseUrl.replace(/\/$/, "")}/v1/wardrobe/${encodeURIComponent(id)}/tag`, {
      method: "POST", headers, body: JSON.stringify({ force }), signal: controller.signal,
    }));
    const garment = toGarment(body.garment);
    if (garment.id !== id) throw new Error("Catalogue returned a different garment");
    return garment;
  } catch (error) {
    if (!(error instanceof WardrobeApiError)) throw new UncertainWardrobeRequestError();
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export function garmentPhotoSource(
  garment: Garment, baseUrl = defaultBaseUrl, ownerToken = defaultOwnerToken,
): { uri: string; headers: { authorization: string } } | undefined {
  if (!garment.photoUrl) return undefined;
  if (garment.photoUrl !== `/v1/wardrobe/${encodeURIComponent(garment.id)}/photo`) {
    throw new Error("Invalid garment photo URL");
  }
  return { uri: `${baseUrl.replace(/\/$/, "")}${garment.photoUrl}`, headers: {
    authorization: authorizationHeaders(ownerToken).authorization,
  } };
}

// Used by the waiting Dress me screen until Task 10 replaces it.
export type OutfitSuggestionResult =
  | { ok: true; outfits: SuggestedOutfit[] }
  | { ok: false; reason: "wardrobe_too_small" | "unavailable" | "cancelled" };

function toSuggestedOutfit(value: unknown): SuggestedOutfit {
  if (!isObject(value) || !Array.isArray(value.garments) ||
    value.garments.length < 2 || value.garments.length > 6 ||
    typeof value.reason !== "string" || !value.reason.trim() || value.reason.length > 200) {
    throw new Error("Catalogue returned an invalid outfit");
  }
  const garments = value.garments.map(toGarment);
  if (garments.some((garment) => garment.tagStatus !== "tagged") ||
    new Set(garments.map((garment) => garment.id)).size !== garments.length) {
    throw new Error("Catalogue returned invalid outfit garments");
  }
  return { garments, reason: value.reason.trim() };
}

export async function suggestOutfits(
  context: OutfitContext, signal?: AbortSignal, fetchImpl: Fetch = fetch,
  baseUrl = defaultBaseUrl, ownerToken = defaultOwnerToken,
): Promise<OutfitSuggestionResult> {
  if (signal?.aborted) return { ok: false, reason: "cancelled" };
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal?.addEventListener("abort", cancel, { once: true });
  const timer = setTimeout(cancel, 120_000);
  try {
    const body = await wardrobeJson(await fetchImpl(`${baseUrl.replace(/\/$/, "")}/v1/outfits/suggestions`, {
      method: "POST", body: JSON.stringify({ context }), signal: controller.signal,
      headers: { ...authorizationHeaders(ownerToken), "content-type": "application/json" },
    }));
    if (controller.signal.aborted) return { ok: false, reason: signal?.aborted ? "cancelled" : "unavailable" };
    if (!Array.isArray(body.outfits) || body.outfits.length < 1 || body.outfits.length > 3) {
      throw new Error("Catalogue returned an invalid outfit list");
    }
    return { ok: true, outfits: body.outfits.map(toSuggestedOutfit) };
  } catch (error) {
    if (signal?.aborted) return { ok: false, reason: "cancelled" };
    if (!controller.signal.aborted && error instanceof WardrobeApiError &&
      error.status === 422 && error.code === "wardrobe_too_small") {
      return { ok: false, reason: "wardrobe_too_small" };
    }
    return { ok: false, reason: "unavailable" };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", cancel);
  }
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

export type Watches = {
  itemIds: string[];
  /** Chosen size labels per item; absent entries mean "alert on any drop". */
  sizes: Record<string, string[]>;
};

function toWatchSizes(value: unknown): Record<string, string[]> {
  // An older backend may not send the map at all; that is simply "no selections".
  if (value === undefined) return {};
  if (!isObject(value)) {
    throw new Error("Catalogue response has an invalid watch sizes map");
  }
  const sizes: Record<string, string[]> = {};
  for (const [itemId, labels] of Object.entries(value)) {
    if (
      !Array.isArray(labels) ||
      !labels.every((label) => typeof label === "string")
    ) {
      throw new Error("Catalogue response has invalid watch sizes");
    }
    sizes[itemId] = labels;
  }
  return sizes;
}

export async function loadWatches(
  fetchImpl: Fetch = fetch,
  baseUrl = defaultBaseUrl,
  ownerToken = defaultOwnerToken,
): Promise<Watches> {
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
  return { itemIds: body.itemIds, sizes: toWatchSizes(body.sizes) };
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

// Replaces the sizes an already-coveted item should alert on. Kept separate from
// setCatalogueWatch on purpose: the covet toggle sends no body so it never
// disturbs a selection, while this always sends an explicit sizes list (an empty
// array clears it).
export async function saveWatchSizes(
  itemId: string,
  sizes: string[],
  fetchImpl: Fetch = fetch,
  baseUrl = defaultBaseUrl,
  ownerToken = defaultOwnerToken,
): Promise<void> {
  const root = baseUrl.replace(/\/$/, "");
  const body = await responseJson(
    await fetchImpl(`${root}/v1/watches/${encodeURIComponent(itemId)}`, {
      body: JSON.stringify({ sizes }),
      headers: {
        ...authorizationHeaders(ownerToken),
        "content-type": "application/json",
      },
      method: "PUT",
    }),
  );
  if (body.itemId !== itemId || body.watched !== true) {
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

const outfitsUrl = (baseUrl: string, path = "") => `${baseUrl.replace(/\/$/, "")}/v1/outfits${path}`;
const RUN_STATUSES = ["running", "succeeded", "failed", "skipped"];

function outfitFields(value: unknown, minGarments: number) {
  if (!isObject(value) || typeof value.id !== "string" || !value.id ||
    !OCCASION_OPTIONS.some((option) => option.id === value.occasion) ||
    typeof value.reason !== "string" || !value.reason.trim() || value.reason.length > 200 ||
    !Array.isArray(value.garments) || value.garments.length < minGarments || value.garments.length > 6) {
    throw new Error("Catalogue returned an invalid outfit");
  }
  return { id: value.id, occasion: value.occasion as Occasion, reason: value.reason, garments: value.garments.map(toGarment) };
}

function toOutfitIdea(value: unknown): OutfitIdea {
  const fields = outfitFields(value, 2);
  if (!isObject(value) || typeof value.createdAt !== "string") throw new Error("Catalogue returned an invalid outfit");
  return { ...fields, createdAt: value.createdAt };
}

function toSavedOutfit(value: unknown): SavedOutfit {
  // A saved outfit may have lost pieces, so it can hold fewer than two garments.
  const fields = outfitFields(value, 0);
  if (!isObject(value) || typeof value.savedAt !== "string" || !Array.isArray(value.missingGarmentIds) ||
    value.missingGarmentIds.some((id) => typeof id !== "string")) {
    throw new Error("Catalogue returned an invalid saved outfit");
  }
  return { ...fields, savedAt: value.savedAt, missingGarmentIds: value.missingGarmentIds as string[] };
}

function toOutfitStatus(value: unknown): OutfitStatus {
  if (!isObject(value) || typeof value.pending !== "boolean" || typeof value.running !== "boolean" ||
    typeof value.generationEnabled !== "boolean" || typeof value.runsLeftToday !== "number" ||
    (value.lastRunAt !== null && typeof value.lastRunAt !== "string") ||
    (value.lastRunStatus !== null && !RUN_STATUSES.includes(value.lastRunStatus as string))) {
    throw new Error("Catalogue returned an invalid outfit status");
  }
  return value as unknown as OutfitStatus;
}

export async function loadOutfits(
  fetchImpl: Fetch = fetch, baseUrl = defaultBaseUrl, ownerToken = defaultOwnerToken,
): Promise<OutfitBoard> {
  const body = await wardrobeJson(await fetchImpl(outfitsUrl(baseUrl), { headers: authorizationHeaders(ownerToken) }));
  if (!Array.isArray(body.suggestions) || !Array.isArray(body.saved)) throw new Error("Catalogue returned an invalid outfit board");
  return { suggestions: body.suggestions.map(toOutfitIdea), saved: body.saved.map(toSavedOutfit), status: toOutfitStatus(body.status) };
}

export async function saveOutfitIdea(
  suggestionId: string, fetchImpl: Fetch = fetch, baseUrl = defaultBaseUrl, ownerToken = defaultOwnerToken,
): Promise<SavedOutfit> {
  const body = await wardrobeJson(await fetchImpl(outfitsUrl(baseUrl, "/saved"), {
    method: "POST", body: JSON.stringify({ suggestionId }),
    headers: { ...authorizationHeaders(ownerToken), "content-type": "application/json" },
  }));
  return toSavedOutfit(body.saved);
}

export async function removeSavedOutfit(
  id: string, fetchImpl: Fetch = fetch, baseUrl = defaultBaseUrl, ownerToken = defaultOwnerToken,
): Promise<void> {
  const body = await wardrobeJson(await fetchImpl(outfitsUrl(baseUrl, `/saved/${encodeURIComponent(id)}`), {
    method: "DELETE", headers: authorizationHeaders(ownerToken),
  }));
  if (body.id !== id || body.deleted !== true) throw new Error("Catalogue returned an invalid deletion result");
}

export type MoreIdeasResult = "queued" | "daily_limit_reached" | "wardrobe_too_small" | "unavailable";

export async function requestMoreIdeas(
  fetchImpl: Fetch = fetch, baseUrl = defaultBaseUrl, ownerToken = defaultOwnerToken,
): Promise<MoreIdeasResult> {
  try {
    const body = await wardrobeJson(await fetchImpl(outfitsUrl(baseUrl, "/more"), {
      method: "POST", headers: authorizationHeaders(ownerToken),
    }));
    return body.queued === true ? "queued" : "unavailable";
  } catch (error) {
    if (error instanceof WardrobeApiError &&
      (error.code === "daily_limit_reached" || error.code === "wardrobe_too_small")) return error.code;
    return "unavailable";
  }
}

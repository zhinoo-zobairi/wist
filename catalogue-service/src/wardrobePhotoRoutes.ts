import type { ApiResponse, RequestOptions } from "./app.js";
import { MAX_PHOTO_BYTES, PHOTO_MEDIA_TYPES, type GarmentPhotoStore, type PhotoMediaType } from "./garmentPhotoStore.js";
import type { GarmentTagger, TagResult } from "./garmentTagger.js";
import { MAX_GARMENTS } from "./wardrobe.js";
import { WardrobeFullError, type WardrobeRepository } from "./wardrobeRepository.js";

export async function removeGarmentPhoto(store: GarmentPhotoStore | undefined, id: string): Promise<void> {
  if (!store) return;
  try {
    await store.remove(id);
  } catch (error) {
    console.error("Could not remove garment photo", id, error);
  }
}

async function uploadPhoto(wardrobe: WardrobeRepository, options: RequestOptions): Promise<ApiResponse> {
  const { photoStore, bodyBytes } = options;
  if (!photoStore) return { status: 503, body: { error: "photo_store_not_configured" } };
  // Clients may send parameters or other casing, e.g. "Image/JPEG; charset=binary".
  const contentType = options.contentType?.split(";")[0]?.trim().toLowerCase();
  if (!PHOTO_MEDIA_TYPES.includes(contentType as PhotoMediaType)) {
    return { status: 415, body: { error: "unsupported_media_type" } };
  }
  if (options.bodyTooLarge || (bodyBytes && bodyBytes.byteLength > MAX_PHOTO_BYTES)) {
    return { status: 413, body: { error: "payload_too_large" } };
  }
  if (!bodyBytes || bodyBytes.byteLength === 0) return { status: 400, body: { error: "invalid_photo" } };
  if (await wardrobe.countGarments() >= MAX_GARMENTS) {
    return { status: 409, body: { error: "wardrobe_full" } };
  }
  let garment;
  try {
    garment = await wardrobe.createPhotoGarment(contentType!);
  } catch (error) {
    if (error instanceof WardrobeFullError) return { status: 409, body: { error: "wardrobe_full" } };
    throw error;
  }
  try {
    await photoStore.write(garment.id, contentType!, bodyBytes);
  } catch (error) {
    await wardrobe.deleteGarment(garment.id);
    await removeGarmentPhoto(photoStore, garment.id);
    console.error("Could not store garment photo", garment.id, error);
    return { status: 500, body: { error: "photo_store_failed" } };
  }
  if (options.tagger) {
    garment = (await tagAndSave(wardrobe, options.tagger, garment.id, {
      kind: "photo", bytes: bodyBytes, mediaType: contentType as PhotoMediaType,
    })).garment ?? await wardrobe.getGarment(garment.id);
    if (!garment) return { status: 404, body: { error: "garment_not_found" } };
  }
  return { status: 201, body: { garment } };
}

async function tagAndSave(
  wardrobe: WardrobeRepository, tagger: GarmentTagger, id: string,
  photo: Parameters<GarmentTagger["tag"]>[0], expectedUpdatedAt?: string,
) {
  let result: TagResult;
  try {
    result = await tagger.tag(photo);
  } catch (error) {
    console.error("Garment tagger failed", { errorClass: error instanceof Error ? error.name : "UnknownError" });
    result = { ok: false, reason: "api_error" };
  }
  const garment = result.ok
    ? await wardrobe.applyTags(id, result.tags, expectedUpdatedAt)
    : await wardrobe.markTagFailed(id);
  return { ok: result.ok, garment };
}

async function retagPhoto(id: string, wardrobe: WardrobeRepository, options: RequestOptions): Promise<ApiResponse> {
  if (!options.tagger) return { status: 503, body: { error: "tagging_not_configured" } };
  if (!options.photoStore) return { status: 503, body: { error: "photo_store_not_configured" } };
  if (options.bodyTooLarge) return { status: 413, body: { error: "payload_too_large" } };
  let force = false;
  if (options.body?.trim()) {
    try {
      const value: unknown = JSON.parse(options.body);
      if (typeof value !== "object" || value === null || Array.isArray(value) ||
          ("force" in value && typeof value.force !== "boolean")) {
        return { status: 400, body: { error: "invalid_tag_request" } };
      }
      force = "force" in value && value.force === true;
    } catch {
      return { status: 400, body: { error: "invalid_tag_request" } };
    }
  }
  const garment = await wardrobe.getGarment(id);
  if (!garment) return { status: 404, body: { error: "garment_not_found" } };
  const mediaType = await wardrobe.getPhotoMediaType(garment.id);
  if (!PHOTO_MEDIA_TYPES.includes(mediaType as PhotoMediaType)) {
    return { status: 404, body: { error: "photo_not_found" } };
  }
  if (garment.tagStatus === "tagged" && !force) {
    return { status: 409, body: { error: "already_tagged" } };
  }
  const bytes = await options.photoStore.read(garment.id, mediaType!);
  if (!bytes) return { status: 404, body: { error: "photo_not_found" } };
  // A forced retag only overwrites the garment as it was read here, so an edit
  // saved while the model call runs is never silently replaced.
  const { ok, garment: tagged } = await tagAndSave(
    wardrobe, options.tagger, garment.id, { kind: "photo", bytes, mediaType: mediaType as PhotoMediaType },
    force ? garment.updatedAt : undefined,
  );
  if (tagged) return { status: 200, body: { garment: tagged } };
  if (!await wardrobe.getGarment(garment.id)) return { status: 404, body: { error: "garment_not_found" } };
  // A failed call never downgrades a tagged garment, so its attributes are untouched.
  if (!ok) return { status: 502, body: { error: "tagging_failed" } };
  return { status: 409, body: { error: force ? "garment_changed" : "already_tagged" } };
}

export async function handleWardrobePhotoRequest(
  method: string, pathname: string, wardrobe: WardrobeRepository, options: RequestOptions,
): Promise<ApiResponse | null> {
  const tagMatch = pathname.match(/^\/v1\/wardrobe\/([^/]+)\/tag$/);
  if (tagMatch?.[1]) {
    return method === "POST"
      ? retagPhoto(tagMatch[1], wardrobe, options)
      : { status: 405, body: { error: "method_not_allowed" } };
  }
  if (pathname === "/v1/wardrobe/photos") {
    return method === "POST"
      ? uploadPhoto(wardrobe, options)
      : { status: 405, body: { error: "method_not_allowed" } };
  }
  const match = pathname.match(/^\/v1\/wardrobe\/([^/]+)\/photo$/);
  if (!match?.[1]) return null;
  if (method !== "GET") return { status: 405, body: { error: "method_not_allowed" } };
  if (!options.photoStore) return { status: 503, body: { error: "photo_store_not_configured" } };
  const garment = await wardrobe.getGarment(match[1]);
  const mediaType = garment ? await wardrobe.getPhotoMediaType(garment.id) : null;
  if (!garment || !mediaType) return { status: 404, body: { error: "photo_not_found" } };
  const bytes = await options.photoStore.read(garment.id, mediaType);
  return bytes
    ? { status: 200, body: bytes, contentType: mediaType }
    : { status: 404, body: { error: "photo_not_found" } };
}

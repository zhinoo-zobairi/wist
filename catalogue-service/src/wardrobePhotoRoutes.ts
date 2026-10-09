import type { ApiResponse, RequestOptions } from "./app.js";
import { MAX_PHOTO_BYTES, PHOTO_MEDIA_TYPES, type GarmentPhotoStore, type PhotoMediaType } from "./garmentPhotoStore.js";
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
  const { photoStore, contentType, bodyBytes } = options;
  if (!photoStore) return { status: 503, body: { error: "photo_store_not_configured" } };
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
  return { status: 201, body: { garment } };
}

export async function handleWardrobePhotoRequest(
  method: string, pathname: string, wardrobe: WardrobeRepository, options: RequestOptions,
): Promise<ApiResponse | null> {
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

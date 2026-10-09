import type { ApiResponse, RequestAuth, RequestOptions } from "./app.js";
import { ownerAuthError } from "./ownerAuth.js";
import { MAX_GARMENTS, parseGarmentInput } from "./wardrobe.js";
import { WardrobeFullError } from "./wardrobeRepository.js";
import { handleWardrobePhotoRequest, removeGarmentPhoto } from "./wardrobePhotoRoutes.js";

function parseBody(body: string | undefined) {
  try {
    return parseGarmentInput(JSON.parse(body ?? ""));
  } catch {
    return null;
  }
}

export async function handleWardrobeRequest(
  method: string,
  pathname: string,
  auth: RequestAuth,
  options: RequestOptions,
): Promise<ApiResponse> {
  const authError = ownerAuthError(auth, "wardrobe_api_not_configured");
  if (authError) return authError;
  const wardrobe = options.wardrobe;
  if (!wardrobe) return { status: 503, body: { error: "wardrobe_api_not_configured" } };
  const photoResponse = await handleWardrobePhotoRequest(method, pathname, wardrobe, options);
  if (photoResponse) return photoResponse;

  if (pathname === "/v1/wardrobe") {
    if (method === "GET") {
      return { status: 200, body: { garments: await wardrobe.listGarments() } };
    }
    if (method !== "POST") return { status: 405, body: { error: "method_not_allowed" } };
    if (options.bodyTooLarge) return { status: 413, body: { error: "payload_too_large" } };
    const input = parseBody(options.body);
    if (!input) return { status: 400, body: { error: "invalid_garment" } };
    if (await wardrobe.countGarments() >= MAX_GARMENTS) {
      return { status: 409, body: { error: "wardrobe_full" } };
    }
    try {
      return { status: 201, body: { garment: await wardrobe.createGarment(input, "manual") } };
    } catch (error) {
      if (error instanceof WardrobeFullError) {
        return { status: 409, body: { error: "wardrobe_full" } };
      }
      throw error;
    }
  }

  const match = pathname.match(/^\/v1\/wardrobe\/([^/]+)$/);
  if (!match?.[1]) return { status: 404, body: { error: "not_found" } };
  if (!["GET", "PUT", "DELETE"].includes(method)) {
    return { status: 405, body: { error: "method_not_allowed" } };
  }
  const id = match[1];
  if (method === "PUT") {
    if (options.bodyTooLarge) return { status: 413, body: { error: "payload_too_large" } };
    const input = parseBody(options.body);
    if (!input) return { status: 400, body: { error: "invalid_garment" } };
    const garment = await wardrobe.replaceGarment(id, input);
    return garment
      ? { status: 200, body: { garment } }
      : { status: 404, body: { error: "garment_not_found" } };
  }
  if (method === "DELETE") {
    const garment = await wardrobe.getGarment(id);
    if (!garment || !await wardrobe.deleteGarment(garment.id)) {
      return { status: 404, body: { error: "garment_not_found" } };
    }
    if (garment.photoUrl) await removeGarmentPhoto(options.photoStore, garment.id);
    return { status: 200, body: { id: garment.id, deleted: true } };
  }
  const garment = await wardrobe.getGarment(id);
  return garment
    ? { status: 200, body: { garment } }
    : { status: 404, body: { error: "garment_not_found" } };
}

import type { ApiResponse, RequestAuth, RequestOptions } from "./app.js";
import { ownerAuthError } from "./ownerAuth.js";
import { keepValidOutfits, parseOutfitRequest } from "./outfits.js";
import type { SuggestionResult } from "./outfitSuggester.js";

export async function handleOutfitRequest(
  method: string, auth: RequestAuth, options: RequestOptions,
): Promise<ApiResponse> {
  const authError = ownerAuthError(auth, "outfits_not_configured");
  if (authError) return authError;
  if (method !== "POST") return { status: 405, body: { error: "method_not_allowed" } };
  if (options.bodyTooLarge) return { status: 413, body: { error: "payload_too_large" } };
  const { wardrobe, profiles, suggester } = options;
  if (!wardrobe || !profiles || !suggester) return { status: 503, body: { error: "outfits_not_configured" } };
  let value: unknown;
  try { value = JSON.parse(options.body ?? ""); } catch { value = null; }
  const context = parseOutfitRequest(value);
  if (!context) return { status: 400, body: { error: "invalid_outfit_request" } };
  const garments = (await wardrobe.listGarments()).filter((garment) => garment.tagStatus === "tagged");
  if (garments.length < 3) return { status: 422, body: { error: "wardrobe_too_small" } };
  const profile = await profiles.getProfile();
  let result: SuggestionResult;
  try {
    result = await suggester.suggest({ garments, profile, context });
  } catch (error) {
    console.error("Outfit suggester failed", { errorClass: error instanceof Error ? error.name : "UnknownError" });
    return { status: 502, body: { error: "suggestion_failed" } };
  }
  if (!result.ok) return { status: 502, body: { error: "suggestion_failed" } };
  // Model calls can outlive edits or deletions. Only return input records still
  // owned and tagged when the response is assembled.
  const inputIds = new Set(garments.map((garment) => garment.id));
  const current = (await wardrobe.listGarments()).filter((garment) =>
    garment.tagStatus === "tagged" && inputIds.has(garment.id));
  const garmentsById = new Map(current.map((garment) => [garment.id, garment]));
  const outfits = keepValidOutfits(result.outfits, new Set(garmentsById.keys()));
  if (outfits.length === 0) return { status: 502, body: { error: "suggestion_failed" } };
  return { status: 200, body: { outfits: outfits.map((outfit) => ({
    garments: outfit.garmentIds.map((id) => garmentsById.get(id)!), reason: outfit.reason,
  })) } };
}

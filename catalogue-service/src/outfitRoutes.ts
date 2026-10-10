import type { ApiResponse, RequestAuth, RequestOptions } from "./app.js";
import type { SavedOutfitRecord } from "./outfitRepository.js";
import { DAILY_RUN_CAP, capDayStart } from "./outfitSchedule.js";
import { ownerAuthError } from "./ownerAuth.js";
import type { Garment } from "./wardrobe.js";

const MIN_TAGGED_GARMENTS = 3;

function savedView(record: SavedOutfitRecord, byId: ReadonlyMap<string, Garment>) {
  return {
    id: record.id, occasion: record.occasion, reason: record.reason, savedAt: record.savedAt,
    garments: record.garmentIds.flatMap((id) => byId.get(id) ?? []),
    missingGarmentIds: record.garmentIds.filter((id) => !byId.has(id)),
  };
}

export async function handleOutfitRequest(
  method: string, pathname: string, auth: RequestAuth, options: RequestOptions,
): Promise<ApiResponse> {
  const authError = ownerAuthError(auth, "outfits_not_configured");
  if (authError) return authError;
  const { wardrobe, outfits, suggester } = options;
  if (!wardrobe || !outfits) return { status: 503, body: { error: "outfits_not_configured" } };

  if (pathname === "/v1/outfits") {
    if (method !== "GET") return { status: 405, body: { error: "method_not_allowed" } };
    const garments = await wardrobe.listGarments();
    const byId = new Map(garments.map((garment) => [garment.id, garment]));
    await outfits.deleteSuggestionsWithout(new Set(byId.keys()));
    const summary = await outfits.runSummary(capDayStart(new Date()));
    const lastChangedAt = await wardrobe.lastChangedAt();
    const unattempted = lastChangedAt !== null &&
      (summary.lastAttemptedChangedAt === null || lastChangedAt > summary.lastAttemptedChangedAt);
    const generationEnabled = suggester !== undefined;
    return { status: 200, body: {
      suggestions: (await outfits.listSuggestions())
        .filter((record) => record.garmentIds.every((id) => byId.has(id)))
        .map((record) => ({
          id: record.id, occasion: record.occasion, reason: record.reason, createdAt: record.createdAt,
          garments: record.garmentIds.map((id) => byId.get(id)!),
        })),
      saved: (await outfits.listSaved()).map((record) => savedView(record, byId)),
      status: {
        pending: generationEnabled && summary.runsThisCapDay < DAILY_RUN_CAP && (unattempted || await outfits.moreIdeasRequested()),
        running: summary.running,
        lastRunAt: summary.lastRun?.at ?? null,
        lastRunStatus: summary.lastRun?.status ?? null,
        runsLeftToday: Math.max(0, DAILY_RUN_CAP - summary.runsThisCapDay),
        generationEnabled,
      },
    } };
  }

  if (pathname === "/v1/outfits/saved") {
    if (method !== "POST") return { status: 405, body: { error: "method_not_allowed" } };
    if (options.bodyTooLarge) return { status: 413, body: { error: "payload_too_large" } };
    let value: unknown;
    try { value = JSON.parse(options.body ?? ""); } catch { value = null; }
    const suggestionId = typeof value === "object" && value !== null && "suggestionId" in value
      ? (value as { suggestionId: unknown }).suggestionId : null;
    if (typeof suggestionId !== "string" || !suggestionId) {
      return { status: 400, body: { error: "invalid_saved_outfit_request" } };
    }
    const saved = await outfits.saveSuggestion(suggestionId);
    if (!saved) return { status: 404, body: { error: "suggestion_not_found" } };
    const byId = new Map((await wardrobe.listGarments()).map((garment) => [garment.id, garment]));
    return { status: 201, body: { saved: savedView(saved, byId) } };
  }

  const savedMatch = pathname.match(/^\/v1\/outfits\/saved\/([^/]+)$/);
  if (savedMatch?.[1]) {
    if (method !== "DELETE") return { status: 405, body: { error: "method_not_allowed" } };
    const id = decodeURIComponent(savedMatch[1]);
    return await outfits.deleteSaved(id)
      ? { status: 200, body: { id, deleted: true } }
      : { status: 404, body: { error: "saved_outfit_not_found" } };
  }

  if (pathname === "/v1/outfits/more") {
    if (method !== "POST") return { status: 405, body: { error: "method_not_allowed" } };
    if (!suggester) return { status: 503, body: { error: "outfits_not_configured" } };
    const tagged = (await wardrobe.listGarments()).filter((garment) => garment.tagStatus === "tagged");
    if (tagged.length < MIN_TAGGED_GARMENTS) return { status: 422, body: { error: "wardrobe_too_small" } };
    const summary = await outfits.runSummary(capDayStart(new Date()));
    if (summary.runsThisCapDay >= DAILY_RUN_CAP) return { status: 429, body: { error: "daily_limit_reached" } };
    await outfits.requestMoreIdeas();
    return { status: 202, body: { queued: true } };
  }

  return { status: 404, body: { error: "not_found" } };
}

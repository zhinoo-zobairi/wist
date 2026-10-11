import type { ApiResponse, RequestAuth, RequestOptions } from "./app.js";
import { ownerAuthError } from "./ownerAuth.js";
import { roundCoordinate } from "./weather.js";

function coordinate(value: unknown, bound: number): number | null {
  return typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= bound ? roundCoordinate(value) : null;
}

export async function handleLocationRequest(
  method: string, auth: RequestAuth, options: RequestOptions,
): Promise<ApiResponse> {
  const authError = ownerAuthError(auth, "location_not_configured");
  if (authError) return authError;
  if (method !== "PUT") return { status: 405, body: { error: "method_not_allowed" } };
  if (!options.outfits) return { status: 503, body: { error: "location_not_configured" } };
  if (options.bodyTooLarge) return { status: 413, body: { error: "payload_too_large" } };
  let value: unknown;
  try { value = JSON.parse(options.body ?? ""); } catch { value = null; }
  const fields = typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const latitude = coordinate(fields.latitude, 90);
  const longitude = coordinate(fields.longitude, 180);
  if (latitude === null || longitude === null) return { status: 400, body: { error: "invalid_location" } };
  // Only the latest location is kept (decision 1); coordinates are never logged.
  await options.outfits.saveLocation({ latitude, longitude });
  return { status: 204, body: null };
}

import type { ApiResponse, RequestAuth, RequestOptions } from "./app.js";
import { ownerAuthError } from "./ownerAuth.js";

function coordinate(params: URLSearchParams, name: string, bound: number): number | null {
  const values = params.getAll(name);
  const value = values[0];
  if (values.length !== 1 || !value || !/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(value)) return null;
  const number = Number(value);
  if (!Number.isFinite(number) || Math.abs(number) > bound) return null;
  return Math.round(number * 100) / 100;
}

export async function handleWeatherRequest(
  method: string, params: URLSearchParams, auth: RequestAuth, options: RequestOptions,
): Promise<ApiResponse> {
  const authError = ownerAuthError(auth, "weather_not_configured");
  if (authError) return authError;
  if (method !== "GET") return { status: 405, body: { error: "method_not_allowed" } };
  const latitude = coordinate(params, "latitude", 90);
  const longitude = coordinate(params, "longitude", 180);
  if (latitude === null || longitude === null) return { status: 400, body: { error: "invalid_location" } };
  try {
    const weather = await options.weatherSource?.today({ latitude, longitude }) ?? null;
    return { status: 200, body: { weather } };
  } catch {
    return { status: 200, body: { weather: null } };
  }
}

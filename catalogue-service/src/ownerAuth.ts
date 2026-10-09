import { createHash, timingSafeEqual } from "node:crypto";
import type { ApiResponse, RequestAuth } from "./app.js";

export function ownerAuthError(
  auth: RequestAuth,
  notConfiguredError: string,
): ApiResponse | null {
  if (!auth.ownerToken) {
    return { status: 503, body: { error: notConfiguredError } };
  }
  if (!auth.authorization) return { status: 401, body: { error: "unauthorized" } };
  const expected = createHash("sha256").update(`Bearer ${auth.ownerToken}`).digest();
  const actual = createHash("sha256").update(auth.authorization).digest();
  return timingSafeEqual(actual, expected)
    ? null
    : { status: 401, body: { error: "unauthorized" } };
}

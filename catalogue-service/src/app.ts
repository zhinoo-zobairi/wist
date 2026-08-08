import { createHash, timingSafeEqual } from "node:crypto";

import type { CatalogueRepository } from "./repository.js";

export type ApiResponse = {
  status: number;
  body: unknown;
};

export type RequestAuth = {
  authorization?: string;
  ownerToken?: string;
};

function authorized(auth: RequestAuth): boolean {
  if (!auth.ownerToken || !auth.authorization) return false;
  const expected = createHash("sha256")
    .update(`Bearer ${auth.ownerToken}`)
    .digest();
  const actual = createHash("sha256").update(auth.authorization).digest();
  return timingSafeEqual(actual, expected);
}

function watchAuthError(auth: RequestAuth): ApiResponse | null {
  if (!auth.ownerToken) {
    return { status: 503, body: { error: "watch_api_not_configured" } };
  }
  return authorized(auth)
    ? null
    : { status: 401, body: { error: "unauthorized" } };
}

export async function handleRequest(
  method: string,
  rawUrl: string,
  repository: CatalogueRepository,
  auth: RequestAuth = {},
): Promise<ApiResponse> {
  const { pathname } = new URL(rawUrl, "http://catalogue.local");

  if (pathname === "/v1/watches") {
    if (method !== "GET") {
      return { status: 405, body: { error: "method_not_allowed" } };
    }
    const authError = watchAuthError(auth);
    if (authError) return authError;
    return {
      status: 200,
      body: { itemIds: await repository.listWatchedItemIds() },
    };
  }

  const watchMatch = pathname.match(/^\/v1\/watches\/([^/]+)$/);
  if (watchMatch?.[1]) {
    if (method !== "PUT" && method !== "DELETE") {
      return { status: 405, body: { error: "method_not_allowed" } };
    }
    const authError = watchAuthError(auth);
    if (authError) return authError;

    const itemId = decodeURIComponent(watchMatch[1]);
    if (!(await repository.getItem(itemId))) {
      return { status: 404, body: { error: "item_not_found" } };
    }
    if (method === "PUT") {
      await repository.watchItem(itemId);
      return { status: 200, body: { itemId, watched: true } };
    }
    await repository.unwatchItem(itemId);
    return { status: 200, body: { itemId, watched: false } };
  }

  if (method !== "GET") {
    return { status: 405, body: { error: "method_not_allowed" } };
  }

  if (pathname === "/health") {
    return {
      status: 200,
      body: { status: "ok", service: "wist-catalogue" },
    };
  }

  if (pathname === "/v1/brands") {
    return { status: 200, body: { brands: await repository.listBrands() } };
  }

  const brandMatch = pathname.match(/^\/v1\/brands\/([^/]+)\/items$/);
  if (brandMatch?.[1]) {
    const brandId = decodeURIComponent(brandMatch[1]);
    const brands = await repository.listBrands();
    if (!brands.some((brand) => brand.id === brandId)) {
      return { status: 404, body: { error: "brand_not_found" } };
    }
    return {
      status: 200,
      body: { items: await repository.listItems(brandId) },
    };
  }

  const itemMatch = pathname.match(/^\/v1\/items\/([^/]+)$/);
  if (itemMatch?.[1]) {
    const item = await repository.getItem(decodeURIComponent(itemMatch[1]));
    return item
      ? { status: 200, body: { item } }
      : { status: 404, body: { error: "item_not_found" } };
  }

  return { status: 404, body: { error: "not_found" } };
}

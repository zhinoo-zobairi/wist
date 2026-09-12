import { createHash, timingSafeEqual } from "node:crypto";

import type { CatalogueItem } from "./model.js";
import type { CatalogueRepository } from "./repository.js";
import { parseStyleProfile } from "./styleProfile.js";
import type { StyleProfileRepository } from "./styleProfileRepository.js";
import { parseWatchSizes } from "./watchedSizes.js";

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

function ownerAuthError(
  auth: RequestAuth,
  notConfiguredError: string,
): ApiResponse | null {
  if (!auth.ownerToken) {
    return { status: 503, body: { error: notConfiguredError } };
  }
  return authorized(auth)
    ? null
    : { status: 401, body: { error: "unauthorized" } };
}

export type RequestOptions = {
  body?: string;
  bodyTooLarge?: boolean;
  importProduct?: (productUrl: string) => Promise<CatalogueItem>;
  profiles?: StyleProfileRepository;
};

export async function handleRequest(
  method: string,
  rawUrl: string,
  repository: CatalogueRepository,
  auth: RequestAuth = {},
  options: RequestOptions = {},
): Promise<ApiResponse> {
  const { pathname } = new URL(rawUrl, "http://catalogue.local");

  if (pathname === "/v1/profile") {
    if (method !== "GET" && method !== "PUT") {
      return { status: 405, body: { error: "method_not_allowed" } };
    }
    const authError = ownerAuthError(auth, "profile_api_not_configured");
    if (authError) return authError;
    if (!options.profiles) {
      return {
        status: 503,
        body: { error: "profile_api_not_configured" },
      };
    }
    if (method === "GET") {
      return {
        status: 200,
        body: { profile: await options.profiles.getProfile() },
      };
    }
    if (options.bodyTooLarge) {
      return { status: 413, body: { error: "payload_too_large" } };
    }

    let value: unknown;
    try {
      value = JSON.parse(options.body ?? "");
    } catch {
      return { status: 400, body: { error: "invalid_profile" } };
    }
    const selection = parseStyleProfile(value);
    if (!selection) {
      return { status: 400, body: { error: "invalid_profile" } };
    }
    return {
      status: 200,
      body: { profile: await options.profiles.replaceProfile(selection) },
    };
  }

  if (pathname === "/v1/watches") {
    if (method !== "GET" && method !== "POST") {
      return { status: 405, body: { error: "method_not_allowed" } };
    }
    const authError = ownerAuthError(auth, "watch_api_not_configured");
    if (authError) return authError;
    if (method === "POST") {
      if (!options.importProduct) {
        return { status: 503, body: { error: "product_import_not_configured" } };
      }
      if (options.bodyTooLarge) {
        return { status: 413, body: { error: "payload_too_large" } };
      }

      let value: unknown;
      try {
        value = JSON.parse(options.body ?? "");
      } catch {
        return { status: 400, body: { error: "invalid_product_url" } };
      }
      if (
        typeof value !== "object" ||
        value === null ||
        !("url" in value) ||
        typeof value.url !== "string" ||
        value.url.trim().length === 0
      ) {
        return { status: 400, body: { error: "invalid_product_url" } };
      }

      try {
        const item = await options.importProduct(value.url.trim());
        await repository.watchItem(item.id);
        return {
          status: 201,
          body: { itemId: item.id, watched: true },
        };
      } catch (error) {
        return {
          status: 422,
          body: {
            error: "product_import_failed",
            message:
              error instanceof Error ? error.message : "Could not import product",
          },
        };
      }
    }
    const itemIds = await repository.listWatchedItemIds();
    const sizes: Record<string, string[]> = {};
    for (const id of itemIds) {
      const selected = await repository.listWatchSizes(id);
      // Empty means "any drop", which the client already assumes, so only the
      // items with an actual selection need to travel.
      if (selected.length > 0) sizes[id] = selected;
    }
    return { status: 200, body: { itemIds, sizes } };
  }

  if (pathname === "/v1/alerts") {
    if (method !== "GET") {
      return { status: 405, body: { error: "method_not_allowed" } };
    }
    const authError = ownerAuthError(auth, "watch_api_not_configured");
    if (authError) return authError;
    return {
      status: 200,
      body: { alerts: await repository.listPriceDropAlerts() },
    };
  }

  const watchMatch = pathname.match(/^\/v1\/watches\/([^/]+)$/);
  if (watchMatch?.[1]) {
    if (method !== "PUT" && method !== "DELETE") {
      return { status: 405, body: { error: "method_not_allowed" } };
    }
    const authError = ownerAuthError(auth, "watch_api_not_configured");
    if (authError) return authError;

    const itemId = decodeURIComponent(watchMatch[1]);
    const item = await repository.getItem(itemId);
    if (!item) {
      return { status: 404, body: { error: "item_not_found" } };
    }
    if (method === "PUT") {
      if (options.bodyTooLarge) {
        return { status: 413, body: { error: "payload_too_large" } };
      }

      // An absent or bodiless request touches only the watch, never the sizes:
      // the covet toggle re-watches with no body and must not wipe a selection.
      // An explicit "sizes" key — including [] — replaces the selection.
      let sizes: string[] | null = null;
      if (options.body !== undefined && options.body.trim().length > 0) {
        let value: unknown;
        try {
          value = JSON.parse(options.body);
        } catch {
          return { status: 400, body: { error: "invalid_watch_sizes" } };
        }
        if (
          typeof value === "object" &&
          value !== null &&
          "sizes" in value
        ) {
          sizes = parseWatchSizes((value as Record<string, unknown>).sizes);
          if (sizes === null) {
            return { status: 400, body: { error: "invalid_watch_sizes" } };
          }
          const published = new Set(item.variants.map((variant) => variant.label));
          if (sizes.some((label) => !published.has(label))) {
            return { status: 400, body: { error: "invalid_watch_sizes" } };
          }
        }
      }

      await repository.watchItem(itemId);
      if (sizes !== null) await repository.replaceWatchSizes(itemId, sizes);
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

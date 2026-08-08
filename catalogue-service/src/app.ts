import type { CatalogueRepository } from "./repository.js";

export type ApiResponse = {
  status: number;
  body: unknown;
};

export async function handleRequest(
  method: string,
  rawUrl: string,
  repository: CatalogueRepository,
): Promise<ApiResponse> {
  if (method !== "GET") {
    return { status: 405, body: { error: "method_not_allowed" } };
  }

  const { pathname } = new URL(rawUrl, "http://catalogue.local");

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

import { describe, expect, it } from "vitest";

import { UncertainWardrobeRequestError, WardrobeApiError } from "./services/catalogueClient";
import { WardrobeNotice, captureErrorMessage, garmentEditErrorMessage, purchaseRefreshErrorMessage, purchaseErrorMessage, catalogueWatchErrorMessage } from "./wardrobeMessages";

describe("captureErrorMessage", () => {
  it("explains a full wardrobe and an oversized photo", () => {
    expect(captureErrorMessage(new WardrobeApiError("wardrobe_full", 409))).toMatch(/full \(300 garments\)/);
    expect(captureErrorMessage(new WardrobeApiError("payload_too_large", 413))).toMatch(/too large/);
  });

  it("shows owner-facing notices and uncertain outcomes as written", () => {
    expect(captureErrorMessage(new WardrobeNotice("Allow camera access in Settings."))).toBe("Allow camera access in Settings.");
    const uncertain = new UncertainWardrobeRequestError();
    expect(captureErrorMessage(uncertain)).toBe(uncertain.message);
  });

  it.each([
    new WardrobeApiError("unsupported_media_type", 415),
    new WardrobeApiError("photo_store_failed", 500),
    new WardrobeApiError("wardrobe_request_failed", 503),
    new TypeError("Network request failed"),
    "not an error",
  ])("never shows a raw code or internal message for %s", (caught) => {
    expect(captureErrorMessage(caught)).toBe("Could not add this photo. Please try again.");
  });
});

describe("garmentEditErrorMessage", () => {
  it("does not blame the connection when the server answered", () => {
    expect(garmentEditErrorMessage(new WardrobeApiError("tagging_failed", 502))).toBe(
      "Could not read the photo this time. Your saved details were kept.",
    );
    expect(garmentEditErrorMessage(new WardrobeApiError("garment_not_found", 404))).toMatch(/no longer exists/);
    expect(garmentEditErrorMessage(new WardrobeApiError("garment_changed", 409))).toMatch(/changed while the photo/);
    expect(garmentEditErrorMessage(new WardrobeApiError("invalid_garment", 400))).toBe(
      "Could not update this garment. Please try again.",
    );
  });

  it("mentions the connection only when no response arrived", () => {
    expect(garmentEditErrorMessage(new TypeError("Network request failed"))).toMatch(/Check your connection/);
    expect(garmentEditErrorMessage(new UncertainWardrobeRequestError())).toMatch(/did not arrive/);
  });
});

describe("purchaseErrorMessage", () => {
  it("explains a full wardrobe and a missing catalogue piece", () => {
    expect(purchaseErrorMessage(new WardrobeApiError("wardrobe_full", 409))).toBe(
      "Your wardrobe is full (300 garments). Remove one before adding another.",
    );
    expect(purchaseErrorMessage(new WardrobeApiError("item_not_found", 404))).toBe(
      "This piece is no longer in the catalogue.",
    );
    expect(purchaseErrorMessage(new WardrobeApiError("item_image_unavailable", 422))).toBe(
      "This piece's photo can't be used, so it can't be added automatically.",
    );
  });

  it("explains an uncertain purchase outcome before another paid attempt", () => {
    expect(purchaseErrorMessage(new UncertainWardrobeRequestError())).toBe(
      "The response did not arrive. This piece may already be in your wardrobe. Refresh your wardrobe and Coveted before adding it again.",
    );
  });

  it.each([
    new WardrobeApiError("invalid_item_request", 400), new WardrobeApiError("wardrobe_request_failed", 503),
    new TypeError("Network request failed"), new Error("private backend details"), "unknown error",
  ])("never displays raw purchase errors for %s", (caught) => {
    expect(purchaseErrorMessage(caught)).toBe("Could not add this piece. Please try again.");
  });
});


describe("purchase refresh copy", () => {
  it.each([new WardrobeApiError("unauthorized", 401), new Error("internal database details")])("never shows refresh internals: %s", (caught) => {
    expect(purchaseRefreshErrorMessage(caught)).toBe("Could not refresh your wardrobe and Coveted. Please try Refresh again before adding this piece.");
  });
});


it("describes product-image retagging failures without backend codes", () => {
  expect(garmentEditErrorMessage(new WardrobeApiError("tagging_failed", 502), true))
    .toBe("Could not read the product image this time. Your saved details were kept.");
  expect(garmentEditErrorMessage(new WardrobeApiError("garment_changed", 409), true))
    .toContain("while the product image was being read");
});

it("keeps watch errors owner-facing", () => {
  const error = new Error("unauthorized backend token details");
  expect(catalogueWatchErrorMessage(error)).toBe("Could not update Coveted. Please try again.");
  expect(catalogueWatchErrorMessage(error, true)).toBe("Could not update alert sizes. Please try again.");
});

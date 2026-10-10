import { describe, expect, it } from "vitest";

import { UncertainWardrobeRequestError, WardrobeApiError } from "./services/catalogueClient";
import { WardrobeNotice, captureErrorMessage, garmentEditErrorMessage } from "./wardrobeMessages";

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

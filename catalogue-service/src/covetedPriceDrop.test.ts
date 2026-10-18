import { describe, expect, it } from "vitest";

import { detectCovetedPriceDrop } from "./covetedPriceDrop.js";

const observation = {
  currency: "EUR",
  itemId: "bobbies-opera",
  observedAt: "2026-09-13T12:00:00.000Z",
};

describe("coveted price drop rule", () => {

  it("stays quiet at exactly the coveted price", () => {
    expect(
      detectCovetedPriceDrop({
        ...observation,
        covetedPrice: { currency: "EUR", price: 300 },
        currentPrice: 300,
        lowestAnnouncedPrice: null,
      }),
    ).toBeNull();
  });

  // A storefront that switched currency makes the two numbers incomparable, so
  // a smaller number is not evidence of a cheaper price.
  it("stays quiet when the currency changed under the watch", () => {
    expect(
      detectCovetedPriceDrop({
        ...observation,
        covetedPrice: { currency: "USD", price: 300 },
        currentPrice: 240,
        lowestAnnouncedPrice: null,
      }),
    ).toBeNull();
  });

  // No price can undercut zero, so the rule must decide this before it divides
  // by the coveted price.
  it("stays quiet on a free item rather than dividing by zero", () => {
    expect(
      detectCovetedPriceDrop({
        ...observation,
        covetedPrice: { currency: "EUR", price: 0 },
        currentPrice: 0,
        lowestAnnouncedPrice: null,
      }),
    ).toBeNull();
  });
});

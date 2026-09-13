import { describe, expect, it } from "vitest";

import { detectCovetedPriceDrop } from "./covetedPriceDrop.js";

const observation = {
  currency: "EUR",
  itemId: "bobbies-opera",
  observedAt: "2026-09-13T12:00:00.000Z",
};

describe("coveted price drop rule", () => {
  it("measures the drop against the price the owner coveted at", () => {
    expect(
      detectCovetedPriceDrop({
        ...observation,
        covetedPrice: { currency: "EUR", price: 300 },
        currentPrice: 240,
        lowestAnnouncedPrice: null,
      }),
    ).toEqual({
      currency: "EUR",
      itemId: "bobbies-opera",
      newPrice: 240,
      observedAt: "2026-09-13T12:00:00.000Z",
      oldPrice: 300,
      pctOff: 20,
    });
  });

  // The false signal this rule exists to kill. A price that climbed above the
  // coveted price and then eased back is a decrease, but it is not a bargain:
  // it is still more expensive than when the owner wanted the piece.
  it("stays quiet when the price eased back but is still above the coveted price", () => {
    expect(
      detectCovetedPriceDrop({
        ...observation,
        covetedPrice: { currency: "EUR", price: 300 },
        currentPrice: 350,
        lowestAnnouncedPrice: null,
      }),
    ).toBeNull();
  });

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

  // Without this the same sale price would be re-announced on every six-hour
  // check for as long as it lasted.
  it("stays quiet when this price was already announced", () => {
    expect(
      detectCovetedPriceDrop({
        ...observation,
        covetedPrice: { currency: "EUR", price: 300 },
        currentPrice: 250,
        lowestAnnouncedPrice: 250,
      }),
    ).toBeNull();
  });

  it("announces a new low under the cheapest already announced", () => {
    expect(
      detectCovetedPriceDrop({
        ...observation,
        covetedPrice: { currency: "EUR", price: 300 },
        currentPrice: 240,
        lowestAnnouncedPrice: 250,
      }),
    ).toMatchObject({ newPrice: 240, oldPrice: 300, pctOff: 20 });
  });

  // A price that rises off a sale and then falls back to it is old news, even
  // though the fall itself is a decrease.
  it("stays quiet when the price returns to an already announced low", () => {
    expect(
      detectCovetedPriceDrop({
        ...observation,
        covetedPrice: { currency: "EUR", price: 300 },
        currentPrice: 260,
        lowestAnnouncedPrice: 240,
      }),
    ).toBeNull();
  });

  // Nothing was coveted, so there is no price the owner cared about and no
  // signal to deliver. Only coveted pieces raise alerts.
  it("stays quiet when the item is not coveted", () => {
    expect(
      detectCovetedPriceDrop({
        ...observation,
        covetedPrice: null,
        currentPrice: 1,
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

  it("rounds the percentage off the coveted price", () => {
    expect(
      detectCovetedPriceDrop({
        ...observation,
        covetedPrice: { currency: "EUR", price: 225 },
        currentPrice: 180,
        lowestAnnouncedPrice: null,
      }),
    ).toMatchObject({ pctOff: 20 });
  });
});

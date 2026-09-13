import type { PriceDrop } from "./repository.js";

/** The price an item stood at when the owner coveted it. */
export type CovetedPrice = {
  currency: string;
  price: number;
};

type DetectCovetedPriceDropArgs = {
  covetedPrice: CovetedPrice | null;
  currency: string;
  currentPrice: number;
  itemId: string;
  /** The cheapest price already announced since this item was coveted. */
  lowestAnnouncedPrice: number | null;
  observedAt: string;
};

// Decides whether a fresh observation is a price drop worth announcing.
//
// The baseline is the price the owner coveted the piece at, not the previous
// observation. Comparing consecutive observations makes the reference point
// arbitrary: a piece coveted at 300 that climbs to 400 and eases to 350 shows a
// decrease, so the old rule announced "13% off" for a price worse than the one
// the owner actually wanted. Anchoring makes every alert mean one honest thing —
// it is cheaper than when you wanted it.
//
// Anchoring alone would re-announce the same sale on every check for as long as
// it lasted, so a drop must also be a new low: cheaper than anything already
// announced since the item was coveted. That keeps one alert per genuinely new
// price and ignores a price that merely returns to a low the owner already heard
// about.
//
// Un-coveting and coveting again deliberately starts a fresh baseline, which is
// why both inputs are scoped to the current watch rather than to all history.
export function detectCovetedPriceDrop({
  covetedPrice,
  currency,
  currentPrice,
  itemId,
  lowestAnnouncedPrice,
  observedAt,
}: DetectCovetedPriceDropArgs): PriceDrop | null {
  // Nothing coveted means no price the owner cared about, so there is no signal
  // to deliver — an observation of a piece nobody asked about is just history.
  if (!covetedPrice) return null;

  // A storefront that switched currency makes the numbers incomparable, so a
  // smaller number is not evidence of a cheaper price.
  if (covetedPrice.currency !== currency) return null;

  // Also the guard that keeps a coveted price of zero out of the division below,
  // since no price can be lower than zero.
  if (currentPrice >= covetedPrice.price) return null;

  if (lowestAnnouncedPrice !== null && currentPrice >= lowestAnnouncedPrice) {
    return null;
  }

  return {
    currency,
    itemId,
    newPrice: currentPrice,
    observedAt,
    oldPrice: covetedPrice.price,
    pctOff: Math.round(
      ((covetedPrice.price - currentPrice) / covetedPrice.price) * 100,
    ),
  };
}

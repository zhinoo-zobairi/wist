import { UncertainWardrobeRequestError, WardrobeApiError } from "./services/catalogueClient";

/** An error whose message is written for the owner and is safe to show as-is. */
export class WardrobeNotice extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WardrobeNotice";
  }
}

// Backend error codes are for logs and tests, never for the screen.
export function captureErrorMessage(caught: unknown): string {
  if (caught instanceof UncertainWardrobeRequestError || caught instanceof WardrobeNotice) return caught.message;
  if (caught instanceof WardrobeApiError && caught.code === "wardrobe_full") {
    return "Your wardrobe is full (300 garments). Remove one before adding another.";
  }
  if (caught instanceof WardrobeApiError && caught.code === "payload_too_large") {
    return "This photo is too large. Choose a smaller photo.";
  }
  return "Could not add this photo. Please try again.";
}

export function purchaseErrorMessage(caught: unknown): string {
  if (caught instanceof UncertainWardrobeRequestError) {
    return "The response did not arrive. This piece may already be in your wardrobe. Refresh your wardrobe and Coveted before adding it again.";
  }
  if (caught instanceof WardrobeApiError) {
    if (caught.code === "wardrobe_full") {
      return "Your wardrobe is full (300 garments). Remove one before adding another.";
    }
    if (caught.code === "item_not_found") return "This piece is no longer in the catalogue.";
  }
  return "Could not add this piece. Please try again.";
}

export const PURCHASE_UNWATCHED_NOTICE =
  "Wist could not stop price alerts for this piece. You can remove it from Coveted manually.";

export function purchaseRefreshErrorMessage(_caught: unknown): string {
  return "Could not refresh your wardrobe and Coveted. Please try Refresh again before adding this piece.";
}

export function catalogueWatchErrorMessage(_caught: unknown, sizes = false): string {
  return sizes ? "Could not update alert sizes. Please try again." : "Could not update Coveted. Please try again.";
}

export function garmentEditErrorMessage(caught: unknown, productImage = false): string {
  if (caught instanceof UncertainWardrobeRequestError) {
    return "The response did not arrive. Your garment may still be processing; refresh before trying again.";
  }
  if (!(caught instanceof WardrobeApiError)) {
    return "Could not update this garment. Check your connection and try again.";
  }
  // The server answered, so the connection is fine: say what it decided.
  const image = productImage ? "product image" : "photo";
  switch (caught.code) {
    case "garment_changed":
      return `This garment changed while the ${image} was being read. Your saved changes were kept.`;
    case "tagging_failed":
      return `Could not read the ${image} this time. Your saved details were kept.`;
    case "garment_not_found":
      return "This garment no longer exists. It may have been deleted already.";
    default:
      return "Could not update this garment. Please try again.";
  }
}

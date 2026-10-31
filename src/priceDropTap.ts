/** The piece a tapped price-drop notification points at. */
export type PriceDropTap = { alertId: string | null; itemId: string };

/**
 * Reads the `data` that sendPriceDropNotification attaches. The payload comes
 * back from the operating system untyped, so anything without an item id is
 * not a price drop WIST can open.
 */
export function priceDropTapFromData(data: unknown): PriceDropTap | null {
  if (typeof data !== "object" || data === null) return null;
  const { alertId, itemId } = data as Record<string, unknown>;
  if (typeof itemId !== "string" || itemId === "") return null;
  return { alertId: typeof alertId === "string" && alertId !== "" ? alertId : null, itemId };
}

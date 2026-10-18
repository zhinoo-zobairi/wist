import type { Currency } from "./types";

const SYMBOLS: Record<Currency, string> = { EUR: "€", GBP: "£" };

/** "€ 385" or "£ 120": whole units, the symbol the catalogue observed. */
export function formatPrice(amount: number, currency: Currency = "EUR"): string {
  return `${SYMBOLS[currency]} ${amount.toFixed(0)}`;
}

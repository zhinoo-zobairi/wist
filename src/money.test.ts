import { describe, expect, it } from "vitest";

import { formatPrice } from "./money";

describe("formatPrice", () => {
  it("prints whole euros by default", () => {
    expect(formatPrice(384.6)).toBe("€ 385");
  });

  it("prints pounds for a GBP catalogue price", () => {
    expect(formatPrice(120, "GBP")).toBe("£ 120");
  });
});

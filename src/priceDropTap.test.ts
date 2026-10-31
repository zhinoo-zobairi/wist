import { describe, expect, it } from "vitest";

import { priceDropTapFromData } from "./priceDropTap";

describe("priceDropTapFromData", () => {
  it("reads the alert and item a price-drop notification carries", () => {
    expect(priceDropTapFromData({ alertId: "a1", itemId: "item-1" })).toEqual({ alertId: "a1", itemId: "item-1" });
  });

  it("still opens the piece when the alert id is missing or malformed", () => {
    expect(priceDropTapFromData({ itemId: "item-1" })).toEqual({ alertId: null, itemId: "item-1" });
    expect(priceDropTapFromData({ alertId: 7, itemId: "item-1" })).toEqual({ alertId: null, itemId: "item-1" });
    expect(priceDropTapFromData({ alertId: "", itemId: "item-1" })).toEqual({ alertId: null, itemId: "item-1" });
  });

  it("ignores a payload without a usable item id", () => {
    expect(priceDropTapFromData({ alertId: "a1" })).toBeNull();
    expect(priceDropTapFromData({ alertId: "a1", itemId: "" })).toBeNull();
    expect(priceDropTapFromData({ itemId: 42 })).toBeNull();
    expect(priceDropTapFromData({})).toBeNull();
    expect(priceDropTapFromData(null)).toBeNull();
    expect(priceDropTapFromData(undefined)).toBeNull();
    expect(priceDropTapFromData("item-1")).toBeNull();
  });
});

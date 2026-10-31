import { describe, expect, it } from "vitest";

import { describableAlerts } from "./describableAlerts";
import type { Alert, Brand, Item } from "./types";

const brand = (id: string): Brand => ({ id, name: id.toUpperCase(), monogram: id[0]!.toUpperCase(), curated: true });
const item = (id: string, brandId: string): Item => ({
  id, brandId, name: `Piece ${id}`, imageUrl: `https://example.test/${id}.jpg`,
  currentPrice: 210, currency: "EUR", url: `https://example.test/${id}`,
});
const alert = (id: string, itemId: string, read = false): Alert => ({
  id, userId: "local", itemId, oldPrice: 300, newPrice: 210, pctOff: 30,
  createdAt: "2026-10-25T10:00:00.000Z", read,
});

describe("describableAlerts", () => {
  const brands = [brand("sandro")];
  const items = [item("i1", "sandro"), item("i2", "sandro"), item("orphan", "gone")];

  it("keeps the alerts whose item and house are loaded, in order, with both attached", () => {
    const result = describableAlerts([alert("a2", "i2"), alert("a1", "i1")], items, brands);
    expect(result.map((entry) => entry.alert.id)).toEqual(["a2", "a1"]);
    expect(result[0]).toMatchObject({ brand: { id: "sandro" }, item: { id: "i2" } });
  });

  it("drops an alert whose piece left the index, so an older one can lead", () => {
    const result = describableAlerts([alert("a2", "vanished"), alert("a1", "i1")], items, brands);
    expect(result.map((entry) => entry.alert.id)).toEqual(["a1"]);
  });

  it("drops an alert whose house is not loaded", () => {
    expect(describableAlerts([alert("a1", "orphan")], items, brands)).toEqual([]);
  });

  it("describes nothing before the catalogue has loaded", () => {
    expect(describableAlerts([alert("a1", "i1")], [], [])).toEqual([]);
  });
});

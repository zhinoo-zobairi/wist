import { describe, expect, it } from "vitest";

import { newestAlertChanged } from "./catalogueLifecycle";
import type { Alert } from "./types";

const alert = (id: string): Alert => ({
  id, userId: "local", itemId: `item-${id}`, oldPrice: 300, newPrice: 210, pctOff: 30,
  createdAt: "2026-10-25T10:00:00.000Z", read: false,
});

describe("newestAlertChanged", () => {
  it("treats the first poll as the baseline, whatever it returns", () => {
    expect(newestAlertChanged(undefined, [])).toBe(false);
    expect(newestAlertChanged(undefined, [alert("a1")])).toBe(false);
  });

  it("is quiet while the newest alert stays the same", () => {
    expect(newestAlertChanged("a1", [alert("a1")])).toBe(false);
    expect(newestAlertChanged("a1", [alert("a1"), alert("a0")])).toBe(false);
    expect(newestAlertChanged(null, [])).toBe(false);
  });

  it("fires when a newer alert arrives or the list changes shape", () => {
    expect(newestAlertChanged("a1", [alert("a2"), alert("a1")])).toBe(true);
    expect(newestAlertChanged(null, [alert("a1")])).toBe(true);
    expect(newestAlertChanged("a1", [])).toBe(true);
  });
});

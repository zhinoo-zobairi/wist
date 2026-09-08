import { describe, expect, it } from "vitest";

import { selectPriceDropAnnouncements } from "./priceDropAnnouncements";
import { LOCAL_USER_ID, type Alert } from "./types";

// Newest first, matching the order the catalogue reports alerts in.
const CAPTURED_AT: Record<string, string> = {
  a: "2026-09-01T10:00:00.000Z",
  b: "2026-09-02T10:00:00.000Z",
  c: "2026-09-03T10:00:00.000Z",
  d: "2026-09-04T10:00:00.000Z",
};

const alert = (id: string): Alert => ({
  id,
  userId: LOCAL_USER_ID,
  itemId: `item-${id}`,
  oldPrice: 200,
  newPrice: 150,
  pctOff: 25,
  createdAt: CAPTURED_AT[id] ?? "2026-09-01T10:00:00.000Z",
  read: false,
});

describe("price drop announcements", () => {
  it("stays silent on the first synchronization but remembers what it saw", () => {
    const plan = selectPriceDropAnnouncements({
      alerts: [alert("b"), alert("a")],
      baselineEstablished: false,
      notifiedAlertIds: [],
    });

    expect(plan.announce).toEqual([]);
    expect(plan.notifiedAlertIds).toEqual(["b", "a"]);
  });

  it("announces a drop that arrives after the baseline", () => {
    const plan = selectPriceDropAnnouncements({
      alerts: [alert("b"), alert("a")],
      baselineEstablished: true,
      notifiedAlertIds: ["a"],
    });

    expect(plan.announce.map((entry) => entry.id)).toEqual(["b"]);
    expect(plan.notifiedAlertIds).toEqual(["b", "a"]);
  });

  it("never announces the same drop twice", () => {
    const plan = selectPriceDropAnnouncements({
      alerts: [alert("a")],
      baselineEstablished: true,
      notifiedAlertIds: ["a"],
    });

    expect(plan.announce).toEqual([]);
    expect(plan.notifiedAlertIds).toEqual(["a"]);
  });

  it("announces every drop that landed while the app was closed", () => {
    const plan = selectPriceDropAnnouncements({
      alerts: [alert("d"), alert("c"), alert("b"), alert("a")],
      baselineEstablished: true,
      notifiedAlertIds: ["a"],
    });

    expect(plan.announce.map((entry) => entry.id)).toEqual(["d", "c", "b"]);
  });

  it("forgets identifiers the catalogue no longer reports", () => {
    const plan = selectPriceDropAnnouncements({
      alerts: [alert("b")],
      baselineEstablished: true,
      notifiedAlertIds: ["a", "b"],
    });

    expect(plan.notifiedAlertIds).toEqual(["b"]);
  });
});

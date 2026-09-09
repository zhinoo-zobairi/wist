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
      announceableAlertIds: ["b", "a"],
      baselineEstablished: false,
      notifiedAlertIds: [],
    });

    expect(plan.announce).toEqual([]);
    expect(plan.notifiedAlertIds).toEqual(["b", "a"]);
  });

  it("announces a drop that arrives after the baseline", () => {
    const plan = selectPriceDropAnnouncements({
      alerts: [alert("b"), alert("a")],
      announceableAlertIds: ["b", "a"],
      baselineEstablished: true,
      notifiedAlertIds: ["a"],
    });

    expect(plan.announce.map((entry) => entry.id)).toEqual(["b"]);
    expect(plan.notifiedAlertIds).toEqual(["b", "a"]);
  });

  it("never announces the same drop twice", () => {
    const plan = selectPriceDropAnnouncements({
      alerts: [alert("a")],
      announceableAlertIds: ["a"],
      baselineEstablished: true,
      notifiedAlertIds: ["a"],
    });

    expect(plan.announce).toEqual([]);
    expect(plan.notifiedAlertIds).toEqual(["a"]);
  });

  it("announces every drop that landed while the app was closed", () => {
    const plan = selectPriceDropAnnouncements({
      alerts: [alert("d"), alert("c"), alert("b"), alert("a")],
      announceableAlertIds: ["d", "c", "b", "a"],
      baselineEstablished: true,
      notifiedAlertIds: ["a"],
    });

    expect(plan.announce.map((entry) => entry.id)).toEqual(["d", "c", "b"]);
  });

  it("forgets identifiers the catalogue no longer reports", () => {
    const plan = selectPriceDropAnnouncements({
      alerts: [alert("b")],
      announceableAlertIds: ["b"],
      baselineEstablished: true,
      notifiedAlertIds: ["a", "b"],
    });

    expect(plan.notifiedAlertIds).toEqual(["b"]);
  });

  // A drop whose product the catalogue cannot describe yet must stay eligible.
  // Recording it would burn it: remembered as announced, never delivered.
  it("keeps a drop it cannot describe eligible for a later round", () => {
    const plan = selectPriceDropAnnouncements({
      alerts: [alert("b"), alert("a")],
      announceableAlertIds: ["a"],
      baselineEstablished: true,
      notifiedAlertIds: ["a"],
    });

    expect(plan.announce).toEqual([]);
    expect(plan.notifiedAlertIds).toEqual(["a"]);
  });

  // Otherwise a product that briefly vanishes from the catalogue and returns
  // would announce its already-delivered drop a second time.
  it("keeps remembering an announced drop it can no longer describe", () => {
    const plan = selectPriceDropAnnouncements({
      alerts: [alert("b"), alert("a")],
      announceableAlertIds: [],
      baselineEstablished: true,
      notifiedAlertIds: ["b", "a"],
    });

    expect(plan.announce).toEqual([]);
    expect(plan.notifiedAlertIds).toEqual(["b", "a"]);
  });

  // The baseline must silence the whole existing history, including drops the
  // catalogue cannot describe at that moment.
  it("silences undescribable history on the first synchronization", () => {
    const plan = selectPriceDropAnnouncements({
      alerts: [alert("b"), alert("a")],
      announceableAlertIds: [],
      baselineEstablished: false,
      notifiedAlertIds: [],
    });

    expect(plan.announce).toEqual([]);
    expect(plan.notifiedAlertIds).toEqual(["b", "a"]);
  });
});

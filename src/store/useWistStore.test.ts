import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(async () => null),
    setItem: vi.fn(async () => undefined),
    removeItem: vi.fn(async () => undefined),
  },
}));

import { useWistStore } from "./useWistStore";

describe("Wist style profile store", () => {
  beforeEach(() => {
    useWistStore.setState({
      occasions: [],
      styles: [],
      profileStatus: "unknown",
    });
  });

  it("records an explicit onboarding skip", () => {
    useWistStore.getState().markProfileSkipped();
    expect(useWistStore.getState().profileStatus).toBe("skipped");
  });

  it("replaces selections only after a successful synchronization", () => {
    useWistStore
      .getState()
      .replaceStyleProfile(["work", "travel"], ["minimal", "bold"]);

    expect(useWistStore.getState()).toMatchObject({
      occasions: ["work", "travel"],
      styles: ["minimal", "bold"],
      profileStatus: "answered",
    });
  });
});

describe("Wist announced drop store", () => {
  beforeEach(() => {
    useWistStore.setState({
      alertBaselineEstablished: false,
      notifiedAlertIds: [],
    });
  });

  it("establishes the baseline once drops have been recorded", () => {
    useWistStore.getState().markAlertsAnnounced(["b", "a"]);

    expect(useWistStore.getState()).toMatchObject({
      alertBaselineEstablished: true,
      notifiedAlertIds: ["b", "a"],
    });
  });

  it("establishes the baseline even when no drops exist yet", () => {
    useWistStore.getState().markAlertsAnnounced([]);

    expect(useWistStore.getState().alertBaselineEstablished).toBe(true);
  });

  it("replaces the remembered set instead of accumulating", () => {
    useWistStore.setState({ notifiedAlertIds: ["a", "b"] });

    useWistStore.getState().markAlertsAnnounced(["b"]);

    expect(useWistStore.getState().notifiedAlertIds).toEqual(["b"]);
  });

  // Both fields must survive a cold start. If the baseline reset on every
  // launch, the first synchronization would always be silent and a drop that
  // landed while Wist was closed would never announce itself.
  it("persists the baseline and the remembered set", () => {
    useWistStore.setState({
      alertBaselineEstablished: true,
      notifiedAlertIds: ["a"],
    });

    const persisted = useWistStore.persist
      .getOptions()
      .partialize?.(useWistStore.getState());

    expect(persisted).toMatchObject({
      alertBaselineEstablished: true,
      notifiedAlertIds: ["a"],
    });
  });
});

describe("Wist watched sizes store", () => {
  beforeEach(() => {
    useWistStore.setState({
      starredItemIds: [],
      snapshots: [],
      watchedSizesByItemId: {},
    });
  });

  it("replaces the whole map from a synchronization", () => {
    useWistStore.getState().replaceWatchedSizes({ "item-a": ["40", "40", "39"] });

    expect(useWistStore.getState().watchedSizesByItemId).toEqual({
      "item-a": ["40", "39"],
    });
  });

  it("sets the sizes for one item and clears them with an empty list", () => {
    useWistStore.getState().setWatchedSizes("item-a", ["40"]);
    expect(useWistStore.getState().watchedSizesByItemId).toEqual({
      "item-a": ["40"],
    });

    useWistStore.getState().setWatchedSizes("item-a", []);
    expect(useWistStore.getState().watchedSizesByItemId).toEqual({});
  });

  // Un-coveting an item clears its watch on the backend by cascade, so the
  // device must forget the sizes too or a re-covet would resurrect a stale
  // selection the backend no longer holds.
  it("forgets an item's sizes when it is no longer coveted", () => {
    useWistStore.setState({
      starredItemIds: ["item-a"],
      watchedSizesByItemId: { "item-a": ["40"] },
    });

    useWistStore.getState().setStarredItem("item-a", false, 200);

    expect(useWistStore.getState().watchedSizesByItemId).toEqual({});
  });

  it("persists the chosen sizes across a cold start", () => {
    useWistStore.setState({ watchedSizesByItemId: { "item-a": ["40"] } });

    const persisted = useWistStore.persist
      .getOptions()
      .partialize?.(useWistStore.getState());

    expect(persisted).toMatchObject({
      watchedSizesByItemId: { "item-a": ["40"] },
    });
  });
});

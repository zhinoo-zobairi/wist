import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(async () => null),
    setItem: vi.fn(async () => undefined),
    removeItem: vi.fn(async () => undefined),
  },
}));

import { useWistStore } from "./useWistStore";
import { deleteGarment, loadWardrobe, retagGarment, saveGarment, uploadGarmentPhoto } from "../services/catalogueClient";
import type { Garment } from "../types";

vi.mock("../services/catalogueClient", () => ({
  deleteGarment: vi.fn(), loadWardrobe: vi.fn(), retagGarment: vi.fn(),
  saveGarment: vi.fn(), uploadGarmentPhoto: vi.fn(),
}));

describe("Wist wardrobe store", () => {
  const garment: Garment = {
    id: "a", name: "Shirt", category: "top", colors: ["navy"], formality: "casual",
    warmth: "light", occasions: [], notes: null, source: "photo", catalogueItemId: null, tagStatus: "tagged",
    photoUrl: "/photo", createdAt: "2026-10-10T10:00:00Z", updatedAt: "2026-10-10T10:00:00Z",
  };
  beforeEach(() => {
    vi.clearAllMocks();
    useWistStore.setState({ wardrobe: [], wardrobeStatus: "idle" });
  });

  it("refreshes from the backend and preserves records on failure", async () => {
    vi.mocked(loadWardrobe).mockResolvedValueOnce([garment]);
    await useWistStore.getState().refreshWardrobe();
    expect(useWistStore.getState().wardrobe).toEqual([garment]);
    vi.mocked(loadWardrobe).mockRejectedValueOnce(new Error("offline"));
    await expect(useWistStore.getState().refreshWardrobe()).rejects.toThrow("offline");
    expect(useWistStore.getState()).toMatchObject({ wardrobe: [garment], wardrobeStatus: "error" });
  });

  it("adds and replaces only confirmed server records", async () => {
    let finish!: (value: Garment) => void;
    vi.mocked(uploadGarmentPhoto).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const pending = useWistStore.getState().addGarmentPhoto("file:///photo.jpg");
    expect(useWistStore.getState().wardrobe).toEqual([]);
    finish(garment);
    await pending;
    const edited = { ...garment, name: "Server normalized shirt" };
    vi.mocked(saveGarment).mockResolvedValueOnce(edited);
    await useWistStore.getState().updateGarment(garment.id, garment);
    expect(useWistStore.getState().wardrobe).toEqual([edited]);
    vi.mocked(retagGarment).mockResolvedValueOnce(garment);
    await useWistStore.getState().tagGarment(garment.id, true);
    expect(retagGarment).toHaveBeenCalledWith(garment.id, true);
    expect(useWistStore.getState().wardrobe).toEqual([garment]);
  });

  it("keeps records for every failed mutation and removes only after success", async () => {
    useWistStore.setState({ wardrobe: [garment] });
    for (const [mock, action] of [
      [vi.mocked(uploadGarmentPhoto), () => useWistStore.getState().addGarmentPhoto("file:///photo.jpg")],
      [vi.mocked(saveGarment), () => useWistStore.getState().updateGarment(garment.id, garment)],
      [vi.mocked(retagGarment), () => useWistStore.getState().tagGarment(garment.id)],
      [vi.mocked(deleteGarment), () => useWistStore.getState().removeGarment(garment.id)],
    ] as const) {
      mock.mockRejectedValueOnce(new Error("offline"));
      await expect(action()).rejects.toThrow("offline");
      expect(useWistStore.getState().wardrobe).toEqual([garment]);
    }
    vi.mocked(deleteGarment).mockResolvedValueOnce();
    await useWistStore.getState().removeGarment(garment.id);
    expect(useWistStore.getState().wardrobe).toEqual([]);
  });

  it("deduplicates in-flight refresh and prevents a stale list from undoing an upload", async () => {
    let finish!: (value: Garment[]) => void;
    vi.mocked(loadWardrobe).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const pending = useWistStore.getState().refreshWardrobe();
    expect(useWistStore.getState().refreshWardrobe()).toBe(pending);
    vi.mocked(uploadGarmentPhoto).mockResolvedValueOnce(garment);
    await useWistStore.getState().addGarmentPhoto("file:///photo.jpg");
    finish([]);
    await pending;
    expect(useWistStore.getState().wardrobe).toEqual([garment]);
  });

  it("does not persist wardrobe records, loading state or pending actions", () => {
    useWistStore.setState({ wardrobe: [garment], wardrobeStatus: "loading" });
    const persisted = useWistStore.persist.getOptions().partialize?.(useWistStore.getState());
    expect(persisted).not.toHaveProperty("wardrobe");
    expect(persisted).not.toHaveProperty("wardrobeStatus");
    expect(persisted).not.toHaveProperty("addGarmentPhoto");
  });
});

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

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(async () => null),
    setItem: vi.fn(async () => undefined),
    removeItem: vi.fn(async () => undefined),
  },
}));

import { useWistStore } from "./useWistStore";
import { addGarmentFromItem, deleteGarment, loadWardrobe, loadWatches, retagGarment, saveGarment, uploadGarmentPhoto,
  type AddGarmentFromItemResult } from "../services/catalogueClient";
import type { Garment } from "../types";

vi.mock("../services/catalogueClient", () => ({
  addGarmentFromItem: vi.fn(), deleteGarment: vi.fn(), loadWardrobe: vi.fn(), loadWatches: vi.fn(), retagGarment: vi.fn(),
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

  it.each([true, false])("adds only confirmed purchases and changes Coveted only when unwatched is %s", async (unwatched) => {
    const purchase: Garment = { ...garment, source: "purchase", catalogueItemId: "item-shirt", photoUrl: "https://cdn.example.com/shirt.jpg" };
    useWistStore.setState({ starredItemIds: ["item-shirt", "other-item"],
      watchedSizesByItemId: { "item-shirt": ["M"], "other-item": ["L"] } });
    let finish!: (result: AddGarmentFromItemResult) => void;
    vi.mocked(addGarmentFromItem).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const pending = useWistStore.getState().addGarmentFromItem("item-shirt");
    expect(useWistStore.getState()).toMatchObject({ wardrobe: [], starredItemIds: ["item-shirt", "other-item"] });
    const result = { garment: purchase, unwatched };
    finish(result);
    expect(await pending).toEqual(result);
    expect(addGarmentFromItem).toHaveBeenCalledWith("item-shirt");
    expect(useWistStore.getState()).toMatchObject({ wardrobe: [purchase],
      starredItemIds: unwatched ? ["other-item"] : ["item-shirt", "other-item"],
      watchedSizesByItemId: unwatched ? { "other-item": ["L"] } : { "item-shirt": ["M"], "other-item": ["L"] },
    });
  });

  it("preserves wardrobe and watch state when a purchase request fails", async () => {
    useWistStore.setState({ wardrobe: [garment], starredItemIds: ["item-shirt"], watchedSizesByItemId: { "item-shirt": ["M"] } });
    vi.mocked(addGarmentFromItem).mockRejectedValueOnce(new Error("uncertain"));
    await expect(useWistStore.getState().addGarmentFromItem("item-shirt")).rejects.toThrow("uncertain");
    expect(useWistStore.getState()).toMatchObject({ wardrobe: [garment], starredItemIds: ["item-shirt"],
      watchedSizesByItemId: { "item-shirt": ["M"] } });
  });

  it("keeps two purchases of the same item as distinct owned garments", async () => {
    const first = { ...garment, source: "purchase" as const, catalogueItemId: "item-shirt" };
    const second = { ...first, id: "b" };
    vi.mocked(addGarmentFromItem).mockResolvedValueOnce({ garment: first, unwatched: true })
      .mockResolvedValueOnce({ garment: second, unwatched: true });
    await useWistStore.getState().addGarmentFromItem("item-shirt");
    await useWistStore.getState().addGarmentFromItem("item-shirt");
    expect(useWistStore.getState().wardrobe).toEqual([second, first]);
    expect(addGarmentFromItem).toHaveBeenCalledTimes(2);
  });

  it("refreshes wardrobe and watches after an uncertain purchase without sending another purchase", async () => {
    useWistStore.setState({ starredItemIds: ["item-shirt", "other-item"],
      watchedSizesByItemId: { "item-shirt": ["M"] },
      snapshots: [{ id: "snapshot", itemId: "item-shirt", price: 100, capturedAt: "2026-10-10T10:00:00Z" }] });
    vi.mocked(loadWardrobe).mockResolvedValueOnce([garment]);
    vi.mocked(loadWatches).mockResolvedValueOnce({ itemIds: ["other-item", "other-item"], sizes: { "other-item": ["L", "L"] } });
    await useWistStore.getState().refreshPurchaseState();
    expect(loadWardrobe).toHaveBeenCalledTimes(1);
    expect(loadWatches).toHaveBeenCalledTimes(1);
    expect(addGarmentFromItem).not.toHaveBeenCalled();
    expect(useWistStore.getState()).toMatchObject({ wardrobe: [garment], wardrobeStatus: "idle",
      starredItemIds: ["other-item"], watchedSizesByItemId: { "other-item": ["L"] }, snapshots: [] });
  });

  it("keeps both current records when a purchase recovery read fails", async () => {
    useWistStore.setState({ wardrobe: [garment], starredItemIds: ["item-shirt"], watchedSizesByItemId: { "item-shirt": ["M"] } });
    vi.mocked(loadWardrobe).mockResolvedValueOnce([]);
    vi.mocked(loadWatches).mockRejectedValueOnce(new Error("offline"));
    await expect(useWistStore.getState().refreshPurchaseState()).rejects.toThrow("offline");
    expect(useWistStore.getState()).toMatchObject({ wardrobe: [garment], wardrobeStatus: "error", starredItemIds: ["item-shirt"],
      watchedSizesByItemId: { "item-shirt": ["M"] } });
  });

  it("does not let a stale recovery read restore a watch removed by a confirmed purchase", async () => {
    useWistStore.setState({ starredItemIds: ["item-shirt"], watchedSizesByItemId: { "item-shirt": ["M"] } });
    let finish!: (records: Garment[]) => void;
    vi.mocked(loadWardrobe).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    vi.mocked(loadWatches).mockResolvedValueOnce({ itemIds: ["item-shirt"], sizes: { "item-shirt": ["M"] } });
    const pending = useWistStore.getState().refreshPurchaseState();
    vi.mocked(addGarmentFromItem).mockResolvedValueOnce({ garment, unwatched: true });
    await useWistStore.getState().addGarmentFromItem("item-shirt");
    finish([]);
    await pending;
    expect(useWistStore.getState()).toMatchObject({ wardrobe: [garment], starredItemIds: [], watchedSizesByItemId: {} });
  });

  it("applies recovered watches while preserving an unrelated garment edit made during the read", async () => {
    useWistStore.setState({ wardrobe: [garment], starredItemIds: ["item-shirt"], watchedSizesByItemId: { "item-shirt": ["M"] } });
    let finish!: (records: Garment[]) => void;
    vi.mocked(loadWardrobe).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    vi.mocked(loadWatches).mockResolvedValueOnce({ itemIds: [], sizes: {} });
    const pending = useWistStore.getState().refreshPurchaseState();
    const edited = { ...garment, name: "Edited shirt" };
    vi.mocked(saveGarment).mockResolvedValueOnce(edited);
    await useWistStore.getState().updateGarment(garment.id, edited);
    finish([garment]);
    await pending;
    expect(useWistStore.getState()).toMatchObject({ wardrobe: [edited], wardrobeStatus: "idle",
      starredItemIds: [], watchedSizesByItemId: {} });
  });

  it("refreshes watch caches without requesting wardrobe records or another purchase", async () => {
    useWistStore.setState({ wardrobe: [garment], starredItemIds: ["item-shirt"], watchedSizesByItemId: { "item-shirt": ["M"] } });
    vi.mocked(loadWatches).mockResolvedValueOnce({ itemIds: ["other-item", "other-item"], sizes: { "other-item": ["L", "L"] } });
    await useWistStore.getState().refreshWatches();
    expect(useWistStore.getState()).toMatchObject({ wardrobe: [garment], starredItemIds: ["other-item"],
      watchedSizesByItemId: { "other-item": ["L"] } });
    expect(loadWatches).toHaveBeenCalledTimes(1);
    expect(loadWardrobe).not.toHaveBeenCalled();
    expect(addGarmentFromItem).not.toHaveBeenCalled();
  });

  it.each(["covet", "sizes"])("preserves a newer %s change when an earlier watch read completes", async (change) => {
    useWistStore.setState({ starredItemIds: ["item-shirt"], watchedSizesByItemId: { "item-shirt": ["M"] } });
    let finish!: (watches: Awaited<ReturnType<typeof loadWatches>>) => void;
    vi.mocked(loadWatches).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const pending = useWistStore.getState().refreshWatches();
    if (change === "covet") useWistStore.getState().setStarredItem("other-item", true, 100);
    else useWistStore.getState().setWatchedSizes("item-shirt", ["L"]);
    finish({ itemIds: ["item-shirt"], sizes: { "item-shirt": ["M"] } });
    await pending;
    expect(useWistStore.getState()).toMatchObject(change === "covet"
      ? { starredItemIds: ["item-shirt", "other-item"] }
      : { watchedSizesByItemId: { "item-shirt": ["L"] } });
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

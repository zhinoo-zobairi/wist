import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { seedBrands } from "../data/seed";
import { seedPriceSource } from "../services/SeedPriceSource";
import {
  captureStarredPrices,
  retainLatestSnapshots,
} from "../services/dropEngine";
import {
  addGarmentFromItem as purchaseCatalogueItem, deleteGarment, loadWardrobe, loadWatches,
  retagGarment, saveGarment, uploadGarmentPhoto, type AddGarmentFromItemResult, type Watches,
} from "../services/catalogueClient";
import type { Alert, Garment, GarmentInput, Occasion, PriceSnapshot, Style } from "../types";

export type ProfileStatus = "unknown" | "answered" | "skipped";

type WistState = {
  wardrobe: Garment[];
  wardrobeStatus: "idle" | "loading" | "error";
  refreshWardrobe: () => Promise<void>;
  refreshPurchaseState: () => Promise<void>;
  refreshWatches: () => Promise<void>;
  addGarmentFromItem: (itemId: string) => Promise<AddGarmentFromItemResult>;
  addGarmentPhoto: (uri: string) => Promise<Garment>;
  updateGarment: (id: string, input: GarmentInput) => Promise<Garment>;
  removeGarment: (id: string) => Promise<void>;
  tagGarment: (id: string, force?: boolean) => Promise<Garment>;
  followedBrandIds: string[];
  starredItemIds: string[];
  priceRevision: number;
  priceOverrides: Record<string, number>;
  snapshots: PriceSnapshot[];
  alerts: Alert[];
  notifiedAlertIds: string[];
  alertBaselineEstablished: boolean;
  watchedSizesByItemId: Record<string, string[]>;
  occasions: Occasion[];
  styles: Style[];
  profileStatus: ProfileStatus;
  /** The magazine intro has played once on this device. */
  introSeen: boolean;
  /** Stored preferences could not be read; the session runs on defaults. Not persisted. */
  hydrationFailed: boolean;
  /** WIST has followed the catalogue's houses once on this device; from then on the follows are the reader's own. */
  followsSeeded: boolean;
  toggleFollow: (brandId: string) => void;
  addFollowedBrands: (brandIds: string[]) => void;
  seedFollows: (brandIds: string[]) => void;
  replaceStarredItems: (itemIds: string[]) => void;
  mergePriceDropAlerts: (alerts: Alert[]) => void;
  setStarredItem: (itemId: string, watched: boolean, currentPrice: number) => void;
  toggleStar: (itemId: string, currentPrice?: number) => void;
  replaceWatchedSizes: (sizesByItemId: Record<string, string[]>) => void;
  setWatchedSizes: (itemId: string, labels: string[]) => void;
  triggerSeedDrop: () => Alert | null;
  markAlertRead: (alertId: string) => void;
  markAlertsAnnounced: (alertIds: string[]) => void;
  restoreSeedPrices: () => void;
  markProfileSkipped: () => void;
  setIntroSeen: (seen: boolean) => void;
  markHydrationFailed: () => void;
  replaceStyleProfile: (occasions: Occasion[], styles: Style[]) => void;
};

// A list read started before a write must not undo the newer server response.
let wardrobeRevision = 0;
let watchRevision = 0;
let wardrobeRefresh: Promise<void> | undefined;
const upsertGarment = (wardrobe: Garment[], garment: Garment) =>
  wardrobe.some((entry) => entry.id === garment.id)
    ? wardrobe.map((entry) => entry.id === garment.id ? garment : entry)
    : [garment, ...wardrobe];

const watchFields = (watches: Watches, snapshots: PriceSnapshot[]) => {
  const itemIds = [...new Set(watches.itemIds)];
  return {
    starredItemIds: itemIds,
    watchedSizesByItemId: Object.fromEntries(Object.entries(watches.sizes)
      .map(([itemId, sizes]) => [itemId, [...new Set(sizes)]])),
    snapshots: snapshots.filter((snapshot) => itemIds.includes(snapshot.itemId)),
  };
};

const toggleId = (ids: string[], id: string) =>
  ids.includes(id) ? ids.filter((candidate) => candidate !== id) : [...ids, id];

// Returns the map without the given item, leaving the original untouched when
// the item was not present so callers never trigger a needless re-render.
const dropSizes = (
  sizesByItemId: Record<string, string[]>,
  itemId: string,
): Record<string, string[]> => {
  if (!(itemId in sizesByItemId)) return sizesByItemId;
  const { [itemId]: _removed, ...rest } = sizesByItemId;
  return rest;
};

const MAX_LOCAL_ALERTS = 100;

// zustand persist writes on every change. After a failed read the session runs
// on defaults, so writing would replace the stored preferences with them: keep
// the stored blob as it was until a later read succeeds.
let preferencesUnreadable = false;
const preferencesStorage = {
  getItem: (name: string) => AsyncStorage.getItem(name),
  setItem: (name: string, value: string) =>
    preferencesUnreadable ? Promise.resolve() : AsyncStorage.setItem(name, value),
  removeItem: (name: string) => AsyncStorage.removeItem(name),
};

/** The follows a fresh install starts with; the catalogue seeds on top only while they are untouched. */
const seedFollowedBrandIds = seedBrands.map((brand) => brand.id);

export const useWistStore = create<WistState>()(
  persist(
    (set) => ({
      wardrobe: [],
      wardrobeStatus: "idle",
      refreshWardrobe: () => {
        if (wardrobeRefresh) return wardrobeRefresh;
        const revision = wardrobeRevision;
        set({ wardrobeStatus: "loading" });
        wardrobeRefresh = loadWardrobe().then((wardrobe) => {
          set({ ...(revision === wardrobeRevision ? { wardrobe } : {}), wardrobeStatus: "idle" });
        }).catch((error: unknown) => {
          set({ wardrobeStatus: "error" });
          throw error;
        }).finally(() => { wardrobeRefresh = undefined; });
        return wardrobeRefresh;
      },
      refreshPurchaseState: async () => {
        const wardrobeReadRevision = wardrobeRevision;
        const watchReadRevision = watchRevision;
        set({ wardrobeStatus: "loading" });
        try {
          const [wardrobe, watches] = await Promise.all([loadWardrobe(), loadWatches()]);
          // Keep newer writes in each domain without dropping the other read.
          const applyWardrobe = wardrobeReadRevision === wardrobeRevision;
          const applyWatches = watchReadRevision === watchRevision;
          if (applyWardrobe) wardrobeRevision += 1;
          if (applyWatches) watchRevision += 1;
          set((state) => ({
            ...(applyWardrobe ? { wardrobe } : {}),
            ...(applyWatches ? watchFields(watches, state.snapshots) : {}),
            wardrobeStatus: "idle",
          }));
        } catch (error) {
          set({ wardrobeStatus: "error" });
          throw error;
        }
      },
      refreshWatches: async () => {
        const revision = watchRevision;
        const watches = await loadWatches();
        if (revision !== watchRevision) return;
        watchRevision += 1;
        set((state) => watchFields(watches, state.snapshots));
      },
      addGarmentFromItem: async (itemId) => {
        const result = await purchaseCatalogueItem(itemId);
        wardrobeRevision += 1;
        if (result.unwatched) watchRevision += 1;
        set((state) => ({
          wardrobe: upsertGarment(state.wardrobe, result.garment),
          ...(result.unwatched ? {
            starredItemIds: state.starredItemIds.filter((id) => id !== itemId),
            watchedSizesByItemId: dropSizes(state.watchedSizesByItemId, itemId),
          } : {}),
        }));
        return result;
      },
      addGarmentPhoto: async (uri) => {
        const garment = await uploadGarmentPhoto(uri);
        wardrobeRevision += 1;
        set((state) => ({ wardrobe: upsertGarment(state.wardrobe, garment) }));
        return garment;
      },
      updateGarment: async (id, input) => {
        const garment = await saveGarment(id, input);
        wardrobeRevision += 1;
        set((state) => ({ wardrobe: upsertGarment(state.wardrobe, garment) }));
        return garment;
      },
      removeGarment: async (id) => {
        await deleteGarment(id);
        wardrobeRevision += 1;
        set((state) => ({ wardrobe: state.wardrobe.filter((garment) => garment.id !== id) }));
      },
      tagGarment: async (id, force) => {
        const garment = await retagGarment(id, force);
        wardrobeRevision += 1;
        set((state) => ({ wardrobe: upsertGarment(state.wardrobe, garment) }));
        return garment;
      },
      followedBrandIds: seedFollowedBrandIds,
      starredItemIds: [],
      priceRevision: 0,
      priceOverrides: {},
      snapshots: [],
      alerts: [],
      notifiedAlertIds: [],
      alertBaselineEstablished: false,
      watchedSizesByItemId: {},
      occasions: [],
      styles: [],
      profileStatus: "unknown",
      introSeen: false,
      hydrationFailed: false,
      followsSeeded: false,
      toggleFollow: (brandId) =>
        set((state) => ({
          followedBrandIds: toggleId(state.followedBrandIds, brandId),
        })),
      addFollowedBrands: (brandIds) =>
        set((state) => ({
          followedBrandIds: [...new Set([...state.followedBrandIds, ...brandIds])],
        })),
      seedFollows: (brandIds) =>
        set((state) => ({
          followedBrandIds: [...new Set([...state.followedBrandIds, ...brandIds])],
          followsSeeded: true,
        })),
      replaceStarredItems: (itemIds) =>
        set((state) => {
          watchRevision += 1;
          const uniqueItemIds = [...new Set(itemIds)];
          return {
            starredItemIds: uniqueItemIds,
            snapshots: state.snapshots.filter((snapshot) =>
              uniqueItemIds.includes(snapshot.itemId),
            ),
          };
        }),
      mergePriceDropAlerts: (alerts) =>
        set((state) => {
          const existingById = new Map(
            state.alerts.map((alert) => [alert.id, alert]),
          );
          const remoteIds = new Set(alerts.map((alert) => alert.id));
          return {
            alerts: [
              ...alerts.map((alert) => ({
                ...alert,
                read: existingById.get(alert.id)?.read ?? false,
              })),
              ...state.alerts.filter((alert) => !remoteIds.has(alert.id)),
            ].slice(0, MAX_LOCAL_ALERTS),
          };
        }),
      setStarredItem: (itemId, watched, currentPrice) =>
        set((state) => {
          const isStarred = state.starredItemIds.includes(itemId);
          if (watched === isStarred) return state;
          watchRevision += 1;
          if (!watched) {
            return {
              starredItemIds: state.starredItemIds.filter(
                (candidate) => candidate !== itemId,
              ),
              watchedSizesByItemId: dropSizes(
                state.watchedSizesByItemId,
                itemId,
              ),
            };
          }
          const capturedAt = new Date().toISOString();
          return {
            starredItemIds: [...state.starredItemIds, itemId],
            snapshots: retainLatestSnapshots([
              ...state.snapshots,
              {
                id: `snapshot-${itemId}-${capturedAt}`,
                itemId,
                price: currentPrice,
                capturedAt,
              },
            ]),
          };
        }),
      toggleStar: (itemId, currentPrice) =>
        set((state) => {
          watchRevision += 1;
          const isStarred = state.starredItemIds.includes(itemId);
          if (isStarred) {
            return {
              starredItemIds: state.starredItemIds.filter(
                (candidate) => candidate !== itemId,
              ),
              watchedSizesByItemId: dropSizes(
                state.watchedSizesByItemId,
                itemId,
              ),
            };
          }

          const capturedAt = new Date().toISOString();
          const baseline: PriceSnapshot = {
            id: `snapshot-${itemId}-${capturedAt}`,
            itemId,
            price: currentPrice ?? seedPriceSource.getPrice(itemId),
            capturedAt,
          };
          return {
            starredItemIds: [...state.starredItemIds, itemId],
            snapshots: retainLatestSnapshots([...state.snapshots, baseline]),
          };
        }),
      // Replaces the whole selection from a backend synchronization, which is
      // the authority on what is watched. Each list is de-duplicated so the
      // device mirrors what the catalogue stored.
      replaceWatchedSizes: (sizesByItemId) => {
        watchRevision += 1;
        set(() => ({
          watchedSizesByItemId: Object.fromEntries(
            Object.entries(sizesByItemId).map(([itemId, labels]) => [
              itemId,
              [...new Set(labels)],
            ]),
          ),
        }));
      },
      // Sets one item's sizes from the product screen. An empty list means "any
      // drop", represented as the absence of an entry to match the backend map.
      setWatchedSizes: (itemId, labels) =>
        set((state) => {
          watchRevision += 1;
          const unique = [...new Set(labels)];
          if (unique.length === 0) {
            return {
              watchedSizesByItemId: dropSizes(
                state.watchedSizesByItemId,
                itemId,
              ),
            };
          }
          return {
            watchedSizesByItemId: {
              ...state.watchedSizesByItemId,
              [itemId]: unique,
            },
          };
        }),
      triggerSeedDrop: () => {
        let createdAlert: Alert | null = null;
        set((state) => {
          const itemId = state.starredItemIds.find((id) =>
            seedPriceSource.hasItem(id),
          );
          if (!itemId) return state;
          const drop = seedPriceSource.triggerPriceDrop(itemId);
          const result = captureStarredPrices({
            source: seedPriceSource,
            starredItemIds: state.starredItemIds,
            previousSnapshots: state.snapshots,
          });
          createdAlert = result.alerts[0] ?? null;
          return {
            alerts: [...result.alerts, ...state.alerts].slice(0, MAX_LOCAL_ALERTS),
            priceOverrides: {
              ...state.priceOverrides,
              [drop.itemId]: drop.newPrice,
            },
            priceRevision: state.priceRevision + 1,
            snapshots: retainLatestSnapshots([
              ...state.snapshots,
              ...result.snapshots,
            ]),
          };
        });
        return createdAlert;
      },
      markAlertRead: (alertId) =>
        set((state) => ({
          alerts: state.alerts.map((alert) =>
            alert.id === alertId ? { ...alert, read: true } : alert,
          ),
        })),
      // Records the drops the device has already announced. The caller supplies
      // the complete remembered set from selectPriceDropAnnouncements, so this
      // replaces rather than appends and never grows past the catalogue's alert
      // window. Recording it also establishes the baseline, which is why an
      // empty batch still counts as a completed synchronization.
      markAlertsAnnounced: (alertIds) =>
        set({
          alertBaselineEstablished: true,
          notifiedAlertIds: [...alertIds],
        }),
      restoreSeedPrices: () =>
        set((state) => {
          seedPriceSource.restorePrices(state.priceOverrides);
          return { priceRevision: state.priceRevision + 1 };
        }),
      markProfileSkipped: () => set({ profileStatus: "skipped" }),
      setIntroSeen: (introSeen) => set({ introSeen }),
      markHydrationFailed: () => set({ hydrationFailed: true }),
      replaceStyleProfile: (occasions, styles) =>
        set({
          occasions: [...occasions],
          styles: [...styles],
          profileStatus: "answered",
        }),
    }),
    {
      name: "wist-preferences",
      storage: createJSONStorage(() => preferencesStorage),
      // Version 1 adds followsSeeded. Preferences stored before it come from a
      // phone that has already followed the houses, so they count as seeded and
      // their follows stay exactly as stored.
      version: 1,
      migrate: (persisted, version) =>
        version < 1 ? { ...(persisted as object), followsSeeded: true } : persisted,
      partialize: ({
        alertBaselineEstablished,
        alerts,
        followedBrandIds,
        followsSeeded,
        introSeen,
        notifiedAlertIds,
        occasions,
        priceOverrides,
        profileStatus,
        snapshots,
        starredItemIds,
        styles,
        watchedSizesByItemId,
      }) => ({
        alertBaselineEstablished,
        alerts,
        followedBrandIds,
        followsSeeded,
        introSeen,
        notifiedAlertIds,
        occasions,
        priceOverrides,
        profileStatus,
        snapshots,
        starredItemIds,
        styles,
        watchedSizesByItemId,
      }),
      // An unreadable blob must not leave the app on the spinner: flag it so the
      // session runs on defaults. The stored data is left untouched.
      onRehydrateStorage: (before) => (state, error) => {
        if (error) {
          console.warn(
            `Stored preferences could not be read: ${error instanceof Error ? error.message : "Unknown error"}`,
          );
          preferencesUnreadable = true;
          before.markHydrationFailed();
          return;
        }
        preferencesUnreadable = false;
        state?.restoreSeedPrices();
      },
    },
  ),
);

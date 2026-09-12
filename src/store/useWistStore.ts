import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { seedBrands } from "../data/seed";
import { seedPriceSource } from "../services/SeedPriceSource";
import {
  captureStarredPrices,
  retainLatestSnapshots,
} from "../services/dropEngine";
import type { Alert, Occasion, PriceSnapshot, Style } from "../types";

export type ProfileStatus = "unknown" | "answered" | "skipped";

type WistState = {
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
  toggleFollow: (brandId: string) => void;
  addFollowedBrands: (brandIds: string[]) => void;
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
  replaceStyleProfile: (occasions: Occasion[], styles: Style[]) => void;
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

export const useWistStore = create<WistState>()(
  persist(
    (set) => ({
      followedBrandIds: seedBrands.map((brand) => brand.id),
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
      toggleFollow: (brandId) =>
        set((state) => ({
          followedBrandIds: toggleId(state.followedBrandIds, brandId),
        })),
      addFollowedBrands: (brandIds) =>
        set((state) => ({
          followedBrandIds: [...new Set([...state.followedBrandIds, ...brandIds])],
        })),
      replaceStarredItems: (itemIds) =>
        set((state) => {
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
      replaceWatchedSizes: (sizesByItemId) =>
        set(() => ({
          watchedSizesByItemId: Object.fromEntries(
            Object.entries(sizesByItemId).map(([itemId, labels]) => [
              itemId,
              [...new Set(labels)],
            ]),
          ),
        })),
      // Sets one item's sizes from the product screen. An empty list means "any
      // drop", represented as the absence of an entry to match the backend map.
      setWatchedSizes: (itemId, labels) =>
        set((state) => {
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
      replaceStyleProfile: (occasions, styles) =>
        set({
          occasions: [...occasions],
          styles: [...styles],
          profileStatus: "answered",
        }),
    }),
    {
      name: "wist-preferences",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({
        alertBaselineEstablished,
        alerts,
        followedBrandIds,
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
        notifiedAlertIds,
        occasions,
        priceOverrides,
        profileStatus,
        snapshots,
        starredItemIds,
        styles,
        watchedSizesByItemId,
      }),
      onRehydrateStorage: () => (state) => state?.restoreSeedPrices(),
    },
  ),
);

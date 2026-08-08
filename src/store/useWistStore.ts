import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { seedBrands } from "../data/seed";
import { seedPriceSource } from "../services/SeedPriceSource";
import {
  captureStarredPrices,
  retainLatestSnapshots,
} from "../services/dropEngine";
import type { Alert, PriceSnapshot } from "../types";

type WistState = {
  followedBrandIds: string[];
  starredItemIds: string[];
  priceRevision: number;
  priceOverrides: Record<string, number>;
  snapshots: PriceSnapshot[];
  alerts: Alert[];
  toggleFollow: (brandId: string) => void;
  toggleStar: (itemId: string) => void;
  triggerSeedDrop: () => Alert | null;
  markAlertRead: (alertId: string) => void;
  restoreSeedPrices: () => void;
};

const toggleId = (ids: string[], id: string) =>
  ids.includes(id) ? ids.filter((candidate) => candidate !== id) : [...ids, id];

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
      toggleFollow: (brandId) =>
        set((state) => ({
          followedBrandIds: toggleId(state.followedBrandIds, brandId),
        })),
      toggleStar: (itemId) =>
        set((state) => {
          const isStarred = state.starredItemIds.includes(itemId);
          if (isStarred) {
            return {
              starredItemIds: state.starredItemIds.filter(
                (candidate) => candidate !== itemId,
              ),
            };
          }

          const capturedAt = new Date().toISOString();
          const baseline: PriceSnapshot = {
            id: `snapshot-${itemId}-${capturedAt}`,
            itemId,
            price: seedPriceSource.getPrice(itemId),
            capturedAt,
          };
          return {
            starredItemIds: [...state.starredItemIds, itemId],
            snapshots: retainLatestSnapshots([...state.snapshots, baseline]),
          };
        }),
      triggerSeedDrop: () => {
        let createdAlert: Alert | null = null;
        set((state) => {
          const itemId = state.starredItemIds[0];
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
      restoreSeedPrices: () =>
        set((state) => {
          seedPriceSource.restorePrices(state.priceOverrides);
          return { priceRevision: state.priceRevision + 1 };
        }),
    }),
    {
      name: "wist-preferences",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({
        alerts,
        followedBrandIds,
        priceOverrides,
        snapshots,
        starredItemIds,
      }) => ({
        alerts,
        followedBrandIds,
        priceOverrides,
        snapshots,
        starredItemIds,
      }),
      onRehydrateStorage: () => (state) => state?.restoreSeedPrices(),
    },
  ),
);

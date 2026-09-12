import {
  CormorantGaramond_600SemiBold,
} from "@expo-google-fonts/cormorant-garamond";
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from "@expo-google-fonts/inter";
import { useFonts } from "expo-font";
import { ActivityIndicator, Alert, StyleSheet, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";

import { BottomTabBar, type TabId } from "./src/components/BottomTabBar";
import {
  importCatalogueWatch,
  loadCatalogue,
  loadPriceDropAlerts,
  loadStyleProfile,
  loadWatches,
  saveStyleProfile,
  setCatalogueWatch,
  type Catalogue,
} from "./src/services/catalogueClient";
import { selectPriceDropAnnouncements } from "./src/priceDropAnnouncements";
import { sendPriceDropNotification } from "./src/services/notifications";
import { AlertsScreen } from "./src/screens/AlertsScreen";
import { BrowseScreen } from "./src/screens/BrowseScreen";
import { FeedScreen } from "./src/screens/FeedScreen";
import { ProductDetailScreen } from "./src/screens/ProductDetailScreen";
import { SavedScreen } from "./src/screens/SavedScreen";
import { ProfileScreen } from "./src/screens/ProfileScreen";
import { OnboardingScreen } from "./src/screens/OnboardingScreen";
import { resolveProfileGate } from "./src/profileGate";
import { synchronizeStyleProfile } from "./src/styleProfileCommit";
import { colors } from "./src/theme";
import { useWistStore } from "./src/store/useWistStore";
// Aliased: the bare name Alert is React Native's dialog API in this file.
import type { Alert as PriceDropAlert, Item } from "./src/types";

export default function App() {
  const [liveCatalogue, setLiveCatalogue] = useState<Catalogue>({
    brands: [],
    items: [],
  });
  const [activeTab, setActiveTab] = useState<TabId>("feed");
  const [selectedBrandId, setSelectedBrandId] = useState("");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [syncingWatchIds, setSyncingWatchIds] = useState<string[]>([]);
  const [storeHydrated, setStoreHydrated] = useState(
    useWistStore.persist.hasHydrated(),
  );
  const [profileLookupComplete, setProfileLookupComplete] = useState(false);
  // The alert poll needs the newest catalogue to name a dropped product, but it
  // must not restart every time a product is imported, so it reads a ref.
  const catalogueRef = useRef<Catalogue>(liveCatalogue);
  const alerts = useWistStore((state) => state.alerts);
  const covetedIds = useWistStore((state) => state.starredItemIds);
  const addFollowedBrands = useWistStore((state) => state.addFollowedBrands);
  const replaceStarredItems = useWistStore(
    (state) => state.replaceStarredItems,
  );
  const replaceWatchedSizes = useWistStore(
    (state) => state.replaceWatchedSizes,
  );
  const mergePriceDropAlerts = useWistStore(
    (state) => state.mergePriceDropAlerts,
  );
  const markAlertsAnnounced = useWistStore(
    (state) => state.markAlertsAnnounced,
  );
  const setStarredItem = useWistStore((state) => state.setStarredItem);
  const profileStatus = useWistStore((state) => state.profileStatus);
  const replaceStyleProfile = useWistStore(
    (state) => state.replaceStyleProfile,
  );
  const [fontsLoaded] = useFonts({
    CormorantGaramond_600SemiBold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });

  useEffect(() => {
    const unsubscribe = useWistStore.persist.onFinishHydration(() => {
      setStoreHydrated(true);
    });
    setStoreHydrated(useWistStore.persist.hasHydrated());
    return unsubscribe;
  }, []);

  useEffect(() => {
    let cancelled = false;
    void loadCatalogue()
      .then((catalogue) => {
        if (cancelled) return;
        setLiveCatalogue(catalogue);
        addFollowedBrands(catalogue.brands.map((brand) => brand.id));
        if (catalogue.brands[0]) setSelectedBrandId(catalogue.brands[0].id);
      })
      .catch((error: unknown) => {
        console.warn(
          `Catalogue unavailable: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      });
    return () => {
      cancelled = true;
    };
  }, [addFollowedBrands]);

  useEffect(() => {
    if (!storeHydrated) return;
    let cancelled = false;
    void loadWatches()
      .then(({ itemIds, sizes }) => {
        if (cancelled) return;
        replaceStarredItems(itemIds);
        replaceWatchedSizes(sizes);
      })
      .catch((error: unknown) => {
        console.warn(
          `Watch synchronization unavailable: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      });
    return () => {
      cancelled = true;
    };
  }, [replaceStarredItems, replaceWatchedSizes, storeHydrated]);

  useEffect(() => {
    if (!storeHydrated) return;
    let cancelled = false;
    void synchronizeStyleProfile({
      apply: (occasions, styles) => {
        if (!cancelled) replaceStyleProfile(occasions, styles);
      },
      getLocal: () => {
        const state = useWistStore.getState();
        return state.profileStatus === "answered"
          ? { occasions: state.occasions, styles: state.styles }
          : null;
      },
      load: loadStyleProfile,
      save: saveStyleProfile,
    })
      .catch((error: unknown) => {
        console.warn(
          `Profile synchronization unavailable: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      })
      .finally(() => {
        if (!cancelled) setProfileLookupComplete(true);
      });
    return () => {
      cancelled = true;
    };
  }, [replaceStyleProfile, storeHydrated]);

  useEffect(() => {
    catalogueRef.current = liveCatalogue;
  }, [liveCatalogue]);

  useEffect(() => {
    if (!storeHydrated) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const announcePriceDrops = async (remoteAlerts: PriceDropAlert[]) => {
      const { brands, items } = catalogueRef.current;
      const brandsById = new Map(brands.map((brand) => [brand.id, brand]));
      const itemsById = new Map(items.map((item) => [item.id, item]));

      // Which drops can this build of the catalogue actually describe? The poll
      // fires before loadCatalogue resolves, so on the first round that is often
      // none. The selector keeps those eligible instead of burning them, so the
      // full window is still what gets passed in for bookkeeping.
      const describable = remoteAlerts.flatMap((alert) => {
        const item = itemsById.get(alert.itemId);
        const brand = item ? brandsById.get(item.brandId) : undefined;
        return item && brand ? [{ alert, brand, item }] : [];
      });

      const { alertBaselineEstablished, notifiedAlertIds } =
        useWistStore.getState();
      const plan = selectPriceDropAnnouncements({
        alerts: remoteAlerts,
        announceableAlertIds: describable.map((entry) => entry.alert.id),
        baselineEstablished: alertBaselineEstablished,
        notifiedAlertIds,
      });
      const announcing = new Set(plan.announce.map((alert) => alert.id));

      // Record before delivering: recording afterwards would replay the batch as
      // duplicate notifications on the next poll, and a duplicate burst is worse
      // than a missed banner — every drop stays visible in Your drops either way.
      // So a batch counts as announced even if delivery then fails, including
      // when notification permission is denied. Drops from that batch will not
      // banner retroactively once permission is granted; later ones will.
      markAlertsAnnounced(plan.notifiedAlertIds);

      // Oldest first, so the newest drop is the banner sitting on top.
      for (const entry of [...describable].reverse()) {
        if (cancelled) return;
        if (!announcing.has(entry.alert.id)) continue;
        await sendPriceDropNotification(entry.alert, entry.item, entry.brand);
      }
    };

    const synchronizeAlerts = async () => {
      try {
        const remoteAlerts = await loadPriceDropAlerts();
        if (!cancelled) {
          mergePriceDropAlerts(remoteAlerts);
          await announcePriceDrops(remoteAlerts);
        }
      } catch (error) {
        console.warn(
          `Alert synchronization unavailable: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      }
      if (!cancelled) timer = setTimeout(synchronizeAlerts, 60_000);
    };

    void synchronizeAlerts();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [markAlertsAnnounced, mergePriceDropAlerts, storeHydrated]);

  const brands = liveCatalogue.brands;
  const items = liveCatalogue.items;
  const brandsById = Object.fromEntries(brands.map((brand) => [brand.id, brand]));
  const itemsById = Object.fromEntries(items.map((item) => [item.id, item]));

  const profileGate = resolveProfileGate({
    fontsLoaded,
    profileLookupComplete,
    profileStatus,
    storeHydrated,
  });

  if (profileGate === "loading") {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.wine} />
      </View>
    );
  }

  if (profileGate === "onboarding") {
    return (
      <SafeAreaProvider style={styles.root}>
        <SafeAreaView edges={["top", "bottom"]} style={styles.container}>
          <StatusBar style="dark" />
          <OnboardingScreen />
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  const browseBrand = (brandId: string) => {
    setSelectedItemId(null);
    setSelectedBrandId(brandId);
    setActiveTab("browse");
  };

  const viewAlertItem = (itemId: string) => {
    const item = itemsById[itemId];
    if (item) setSelectedItemId(item.id);
  };

  const toggleLiveCovet = async (item: Item) => {
    if (syncingWatchIds.includes(item.id)) return;
    const watched = !covetedIds.includes(item.id);
    setStarredItem(item.id, watched, item.currentPrice);
    setSyncingWatchIds((itemIds) => [...itemIds, item.id]);
    try {
      await setCatalogueWatch(item.id, watched);
    } catch (error) {
      setStarredItem(item.id, !watched, item.currentPrice);
      Alert.alert(
        "Could not update Coveted",
        error instanceof Error ? error.message : "Unknown catalogue error",
      );
    } finally {
      setSyncingWatchIds((itemIds) =>
        itemIds.filter((itemId) => itemId !== item.id),
      );
    }
  };

  const importLiveProduct = async (productUrl: string) => {
    await importCatalogueWatch(productUrl);
    const [catalogue, watches] = await Promise.all([
      loadCatalogue(),
      loadWatches(),
    ]);
    setLiveCatalogue(catalogue);
    addFollowedBrands(catalogue.brands.map((brand) => brand.id));
    replaceStarredItems(watches.itemIds);
    replaceWatchedSizes(watches.sizes);
    if (!selectedBrandId && catalogue.brands[0]) {
      setSelectedBrandId(catalogue.brands[0].id);
    }
  };

  const renderScreen = () => {
    const selectedItem = selectedItemId ? itemsById[selectedItemId] : undefined;
    const selectedItemBrand = selectedItem
      ? brandsById[selectedItem.brandId]
      : undefined;
    if (selectedItem && selectedItemBrand) {
      return (
        <ProductDetailScreen
          brand={selectedItemBrand}
          coveted={covetedIds.includes(selectedItem.id)}
          item={selectedItem}
          onBack={() => setSelectedItemId(null)}
          onToggleCovet={() => void toggleLiveCovet(selectedItem)}
        />
      );
    }

    switch (activeTab) {
      case "browse":
        return (
          <BrowseScreen
            brands={brands}
            items={items}
            onOpenItem={setSelectedItemId}
            onSelectBrand={setSelectedBrandId}
            onToggleCovet={(item) => void toggleLiveCovet(item)}
            selectedBrandId={selectedBrandId}
          />
        );
      case "alerts":
        return <AlertsScreen onViewItem={viewAlertItem} />;
      case "saved":
        return (
          <SavedScreen
            brands={brands}
            items={items}
            onImportProduct={importLiveProduct}
            onOpenItem={setSelectedItemId}
            onToggleCovet={(item) => void toggleLiveCovet(item)}
          />
        );
      case "profile":
        return <ProfileScreen />;
      case "feed":
      default:
        return (
          <FeedScreen
            brands={brands}
            items={items}
            onBrowseBrand={browseBrand}
            onOpenAlerts={() => setActiveTab("alerts")}
            onOpenBrowse={() => setActiveTab("browse")}
            onOpenItem={setSelectedItemId}
            onToggleCovet={(item) => void toggleLiveCovet(item)}
          />
        );
    }
  };

  return (
    <SafeAreaProvider style={styles.root}>
      <SafeAreaView edges={["top"]} style={styles.container}>
        <StatusBar style="dark" />
        <View style={styles.content}>{renderScreen()}</View>
        {!selectedItemId ? <SafeAreaView edges={["bottom"]} style={styles.navSafeArea}>
          <BottomTabBar
            activeTab={activeTab}
            hasUnreadAlerts={alerts.some((alert) => !alert.read)}
            onChange={setActiveTab}
          />
        </SafeAreaView> : null}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    alignItems: "center",
    backgroundColor: colors.paper,
    flex: 1,
    justifyContent: "center",
  },
  container: {
    alignSelf: "center",
    backgroundColor: colors.paper,
    flex: 1,
    maxWidth: 480,
    width: "100%",
  },
  content: {
    flex: 1,
  },
  navSafeArea: {
    backgroundColor: colors.card,
  },
  root: {
    backgroundColor: colors.line,
    flex: 1,
  },
});

import {
  CormorantGaramond_600SemiBold,
} from "@expo-google-fonts/cormorant-garamond";
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from "@expo-google-fonts/inter";
import { useFonts } from "expo-font";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";

import { BottomTabBar, type TabId } from "./src/components/BottomTabBar";
import { loadCatalogue, type Catalogue } from "./src/services/catalogueClient";
import { AlertsScreen } from "./src/screens/AlertsScreen";
import { BrowseScreen } from "./src/screens/BrowseScreen";
import { FeedScreen } from "./src/screens/FeedScreen";
import { ProductDetailScreen } from "./src/screens/ProductDetailScreen";
import { SavedScreen } from "./src/screens/SavedScreen";
import { ProfileScreen } from "./src/screens/ProfileScreen";
import { colors } from "./src/theme";
import { useWistStore } from "./src/store/useWistStore";

export default function App() {
  const [liveCatalogue, setLiveCatalogue] = useState<Catalogue>({
    brands: [],
    items: [],
  });
  const [activeTab, setActiveTab] = useState<TabId>("feed");
  const [selectedBrandId, setSelectedBrandId] = useState("");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [storeHydrated, setStoreHydrated] = useState(
    useWistStore.persist.hasHydrated(),
  );
  const alerts = useWistStore((state) => state.alerts);
  const covetedIds = useWistStore((state) => state.starredItemIds);
  const addFollowedBrands = useWistStore((state) => state.addFollowedBrands);
  const toggleCovet = useWistStore((state) => state.toggleStar);
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

  const brands = liveCatalogue.brands;
  const items = liveCatalogue.items;
  const brandsById = Object.fromEntries(brands.map((brand) => [brand.id, brand]));
  const itemsById = Object.fromEntries(items.map((item) => [item.id, item]));

  if (!fontsLoaded || !storeHydrated) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.wine} />
      </View>
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
          onToggleCovet={() =>
            toggleCovet(selectedItem.id, selectedItem.currentPrice)
          }
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
            onOpenItem={setSelectedItemId}
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

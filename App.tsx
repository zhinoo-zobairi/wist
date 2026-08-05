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
import { brandsById, itemsById, seedBrands } from "./src/data/seed";
import { sendPriceDropNotification } from "./src/services/notifications";
import { AlertsScreen } from "./src/screens/AlertsScreen";
import { BrowseScreen } from "./src/screens/BrowseScreen";
import { FeedScreen } from "./src/screens/FeedScreen";
import { SavedScreen } from "./src/screens/SavedScreen";
import { StubScreen } from "./src/screens/StubScreen";
import { colors } from "./src/theme";
import { useCovetStore } from "./src/store/useCovetStore";

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>("feed");
  const [selectedBrandId, setSelectedBrandId] = useState(seedBrands[0]?.id ?? "");
  const [storeHydrated, setStoreHydrated] = useState(
    useCovetStore.persist.hasHydrated(),
  );
  const alerts = useCovetStore((state) => state.alerts);
  const triggerSeedDrop = useCovetStore((state) => state.triggerSeedDrop);
  const [fontsLoaded] = useFonts({
    CormorantGaramond_600SemiBold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });

  useEffect(() => {
    const unsubscribe = useCovetStore.persist.onFinishHydration(() => {
      setStoreHydrated(true);
    });
    setStoreHydrated(useCovetStore.persist.hasHydrated());
    return unsubscribe;
  }, []);

  if (!fontsLoaded || !storeHydrated) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.wine} />
      </View>
    );
  }

  const browseBrand = (brandId: string) => {
    setSelectedBrandId(brandId);
    setActiveTab("browse");
  };

  const viewAlertItem = (itemId: string) => {
    const item = itemsById[itemId];
    if (item) browseBrand(item.brandId);
  };

  const handleSeedDrop = async () => {
    const alert = triggerSeedDrop();
    if (!alert) return;
    const item = itemsById[alert.itemId];
    const brand = item ? brandsById[item.brandId] : undefined;
    if (item && brand) {
      await sendPriceDropNotification(alert, item, brand);
    }
  };

  const renderScreen = () => {
    switch (activeTab) {
      case "browse":
        return (
          <BrowseScreen
            onSelectBrand={setSelectedBrandId}
            selectedBrandId={selectedBrandId}
          />
        );
      case "alerts":
        return <AlertsScreen onViewItem={viewAlertItem} />;
      case "saved":
        return <SavedScreen onTriggerDrop={() => void handleSeedDrop()} />;
      case "profile":
        return (
          <StubScreen
            body="Covet v1 is intentionally local and single-user."
            title="Profile"
          />
        );
      case "feed":
      default:
        return (
          <FeedScreen
            onBrowseBrand={browseBrand}
            onOpenAlerts={() => setActiveTab("alerts")}
            onOpenBrowse={() => setActiveTab("browse")}
          />
        );
    }
  };

  return (
    <SafeAreaProvider style={styles.root}>
      <SafeAreaView edges={["top"]} style={styles.container}>
        <StatusBar style="dark" />
        <View style={styles.content}>{renderScreen()}</View>
        <SafeAreaView edges={["bottom"]} style={styles.navSafeArea}>
          <BottomTabBar
            activeTab={activeTab}
            hasUnreadAlerts={alerts.some((alert) => !alert.read)}
            onChange={setActiveTab}
          />
        </SafeAreaView>
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

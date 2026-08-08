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
import { ProfileScreen } from "./src/screens/ProfileScreen";
import { colors } from "./src/theme";
import { useWistStore } from "./src/store/useWistStore";

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>("feed");
  const [selectedBrandId, setSelectedBrandId] = useState(seedBrands[0]?.id ?? "");
  const [storeHydrated, setStoreHydrated] = useState(
    useWistStore.persist.hasHydrated(),
  );
  const alerts = useWistStore((state) => state.alerts);
  const triggerSeedDrop = useWistStore((state) => state.triggerSeedDrop);
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
        return <ProfileScreen />;
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

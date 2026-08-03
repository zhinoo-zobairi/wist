import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import type { Alert, Brand, Item } from "../types";

if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

export async function sendPriceDropNotification(
  alert: Alert,
  item: Item,
  brand: Brand,
): Promise<boolean> {
  if (Platform.OS === "web") return false;

  try {
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("price-drops", {
        name: "Price drops",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 180, 100, 180],
      });
    }

    const existing = await Notifications.getPermissionsAsync();
    const permission =
      existing.status === "granted"
        ? existing
        : await Notifications.requestPermissionsAsync();

    if (permission.status !== "granted") return false;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: `${brand.name}: ${alert.pctOff}% price drop`,
        body: `${item.name} is now €${alert.newPrice.toFixed(0)} (was €${alert.oldPrice.toFixed(0)}).`,
        data: { alertId: alert.id, itemId: item.id },
        sound: true,
      },
      trigger: null,
    });

    return true;
  } catch {
    return false;
  }
}

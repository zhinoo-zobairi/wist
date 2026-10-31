import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import type { Alert, Brand, Item } from "../types";
import { formatPrice } from "../money";

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

// The library hook reads the native notification centre when it mounts and
// throws on web, which has none. Web never receives a tap, so there it is null.
export const useLastNotificationResponse: () => Notifications.MaybeNotificationResponse =
  Platform.OS === "web" ? () => null : Notifications.useLastNotificationResponse;

// Android shows no permission prompt until a channel exists, so the channel is
// created before asking as well as before sending.
async function ensurePriceDropChannel() {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("price-drops", {
    name: "Price drops",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 180, 100, 180],
  });
}

/** True on a device that has never been asked about notifications; always false on web. */
export async function isPriceDropPermissionUndetermined(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status === "undetermined";
  } catch {
    return false;
  }
}

/**
 * Shows the system notification prompt. Called only at the covet moment, after
 * the app has said why; the poll never asks. Resolves whether it was granted.
 */
export async function requestPriceDropPermission(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  try {
    await ensurePriceDropChannel();
    const { status } = await Notifications.requestPermissionsAsync();
    return status === "granted";
  } catch {
    return false;
  }
}

export async function sendPriceDropNotification(
  alert: Alert,
  item: Item,
  brand: Brand,
): Promise<boolean> {
  if (Platform.OS === "web") return false;

  try {
    await ensurePriceDropChannel();

    // Only check: asking from inside the poll would interrupt whatever the
    // reader is doing with no context. The covet moment asks instead.
    const permission = await Notifications.getPermissionsAsync();
    if (permission.status !== "granted") return false;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: `${brand.name}: ${alert.pctOff}% price drop`,
        body: `${item.name} is now ${formatPrice(alert.newPrice, item.currency)} (was ${formatPrice(alert.oldPrice, item.currency)}).`,
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

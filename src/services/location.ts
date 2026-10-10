import * as Location from "expo-location";
import type { Coordinates } from "../types";

export async function currentCoarseLocation(): Promise<Coordinates | null> {
  let expired = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => { expired = true; resolve(null); }, 10_000);
  });
  try {
    return await Promise.race([
      (async (): Promise<Coordinates | null> => {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (!permission.granted || expired) return null;
        const { coords } = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (expired || !Number.isFinite(coords.latitude) || Math.abs(coords.latitude) > 90 ||
          !Number.isFinite(coords.longitude) || Math.abs(coords.longitude) > 180) return null;
        return { latitude: Math.round(coords.latitude * 100) / 100, longitude: Math.round(coords.longitude * 100) / 100 };
      })().catch(() => null),
      timeout,
    ]);
  } finally {
    // Expo's native one-shot read has no cancellation API; a late result is ignored.
    clearTimeout(timer);
  }
}

import type { ProfileStatus } from "./store/useWistStore";

export type ProfileGate = "loading" | "onboarding" | "app";

export function resolveProfileGate({
  fontsLoaded,
  profileLookupComplete,
  profileStatus,
  storeHydrated,
}: {
  fontsLoaded: boolean;
  profileLookupComplete: boolean;
  profileStatus: ProfileStatus;
  storeHydrated: boolean;
}): ProfileGate {
  if (!fontsLoaded || !storeHydrated) return "loading";
  if (profileStatus === "unknown" && !profileLookupComplete) return "loading";
  return profileStatus === "unknown" ? "onboarding" : "app";
}

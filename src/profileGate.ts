import type { ProfileStatus } from "./store/useWistStore";

export type ProfileGate = "loading" | "intro" | "onboarding" | "app";

export function resolveProfileGate({
  fontsLoaded,
  introSeen,
  profileLookupComplete,
  profileStatus,
  storeHydrated,
}: {
  fontsLoaded: boolean;
  introSeen: boolean;
  profileLookupComplete: boolean;
  profileStatus: ProfileStatus;
  storeHydrated: boolean;
}): ProfileGate {
  if (!fontsLoaded || !storeHydrated) return "loading";
  if (profileStatus === "unknown" && !profileLookupComplete) return "loading";
  // The intro plays once per device, for new and returning readers alike.
  if (!introSeen) return "intro";
  return profileStatus === "unknown" ? "onboarding" : "app";
}

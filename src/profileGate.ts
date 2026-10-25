import type { ProfileStatus } from "./store/useWistStore";

export type ProfileGate = "loading" | "intro" | "onboarding" | "app";

export function resolveProfileGate({
  fontsLoaded,
  fontError,
  introSeen,
  profileLookupComplete,
  profileStatus,
  storeHydrated,
}: {
  fontsLoaded: boolean;
  /** A failed font load still lets the app render, on the system font. */
  fontError: Error | null;
  introSeen: boolean;
  profileLookupComplete: boolean;
  profileStatus: ProfileStatus;
  storeHydrated: boolean;
}): ProfileGate {
  if ((!fontsLoaded && fontError === null) || !storeHydrated) return "loading";
  if (profileStatus === "unknown" && !profileLookupComplete) return "loading";
  // The intro plays once per device, for new and returning readers alike.
  if (!introSeen) return "intro";
  return profileStatus === "unknown" ? "onboarding" : "app";
}

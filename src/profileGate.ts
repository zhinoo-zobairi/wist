import type { ProfileStatus } from "./store/useWistStore";

export type ProfileGate = "loading" | "intro" | "onboarding" | "app";

export function resolveProfileGate({
  fontsLoaded,
  fontError,
  introSeen,
  onboardingInProgress = false,
  profileLookupComplete,
  profileStatus,
  storeHydrated,
}: {
  fontsLoaded: boolean;
  /** A failed font load still lets the app render, on the system font. */
  fontError: Error | null;
  introSeen: boolean;
  /** A stored N° 02 draft: the reader has not reached the end of the flow. */
  onboardingInProgress?: boolean;
  profileLookupComplete: boolean;
  profileStatus: ProfileStatus;
  storeHydrated: boolean;
}): ProfileGate {
  if ((!fontsLoaded && fontError === null) || !storeHydrated) return "loading";
  if (profileStatus === "unknown" && !profileLookupComplete) return "loading";
  // The intro plays once per device, for new and returning readers alike.
  if (!introSeen) return "intro";
  if (onboardingInProgress) return "onboarding";
  return profileStatus === "unknown" ? "onboarding" : "app";
}

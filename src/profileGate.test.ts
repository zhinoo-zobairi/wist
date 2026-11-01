import { describe, expect, it } from "vitest";

import { resolveProfileGate } from "./profileGate";

describe("style profile startup gate", () => {
  it("waits for hydration and the first remote lookup", () => {
    expect(
      resolveProfileGate({
        fontsLoaded: true,
        fontError: null,
        introSeen: true,
        profileLookupComplete: false,
        profileStatus: "unknown",
        storeHydrated: true,
      }),
    ).toBe("loading");
  });

  it("shows onboarding only after an unanswered lookup completes", () => {
    expect(
      resolveProfileGate({
        fontsLoaded: true,
        fontError: null,
        introSeen: true,
        profileLookupComplete: true,
        profileStatus: "unknown",
        storeHydrated: true,
      }),
    ).toBe("onboarding");
  });

  it.each(["answered", "skipped"] as const)(
    "lets a cached %s decision bypass the lookup wait",
    (profileStatus) => {
      expect(
        resolveProfileGate({
          fontsLoaded: true,
          fontError: null,
          introSeen: true,
          profileLookupComplete: false,
          profileStatus,
          storeHydrated: true,
        }),
      ).toBe("app");
    },
  );

  it.each(["unknown", "answered", "skipped"] as const)(
    "plays the intro first on a device that has not seen it (%s)",
    (profileStatus) => {
      expect(
        resolveProfileGate({
          fontsLoaded: true,
          fontError: null,
          introSeen: false,
          profileLookupComplete: true,
          profileStatus,
          storeHydrated: true,
        }),
      ).toBe("intro");
    },
  );

  it("waits for the fonts while they are still loading", () => {
    expect(
      resolveProfileGate({
        fontsLoaded: false,
        fontError: null,
        introSeen: true,
        profileLookupComplete: true,
        profileStatus: "answered",
        storeHydrated: true,
      }),
    ).toBe("loading");
  });

  it("counts a font error as ready instead of spinning forever", () => {
    expect(
      resolveProfileGate({
        fontsLoaded: false,
        fontError: new Error("Metro link dropped"),
        introSeen: true,
        profileLookupComplete: true,
        profileStatus: "answered",
        storeHydrated: true,
      }),
    ).toBe("app");
  });

  it("keeps the intro behind the loading screen", () => {
    expect(
      resolveProfileGate({
        fontsLoaded: true,
        fontError: null,
        introSeen: false,
        profileLookupComplete: false,
        profileStatus: "unknown",
        storeHydrated: true,
      }),
    ).toBe("loading");
  });

  // Composing marks the profile answered before the brief and reveal show.
  it("keeps N° 02 open while a draft exists, even once the profile is answered", () => {
    expect(
      resolveProfileGate({
        fontsLoaded: true,
        fontError: null,
        introSeen: true,
        onboardingInProgress: true,
        profileLookupComplete: true,
        profileStatus: "answered",
        storeHydrated: true,
      }),
    ).toBe("onboarding");
  });

  it("plays the intro on a device that has not seen it, even with a cached answered profile", () => {
    expect(
      resolveProfileGate({
        fontsLoaded: true,
        fontError: null,
        introSeen: false,
        profileLookupComplete: false,
        profileStatus: "answered",
        storeHydrated: true,
      }),
    ).toBe("intro");
  });

  it("plays the intro before an open N° 02 draft", () => {
    expect(
      resolveProfileGate({
        fontsLoaded: true,
        fontError: null,
        introSeen: false,
        onboardingInProgress: true,
        profileLookupComplete: true,
        profileStatus: "answered",
        storeHydrated: true,
      }),
    ).toBe("intro");
  });
});

import { describe, expect, it } from "vitest";

import { resolveProfileGate } from "./profileGate";

describe("style profile startup gate", () => {
  it("waits for hydration and the first remote lookup", () => {
    expect(
      resolveProfileGate({
        fontsLoaded: true,
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
          profileLookupComplete: false,
          profileStatus,
          storeHydrated: true,
        }),
      ).toBe("app");
    },
  );
});

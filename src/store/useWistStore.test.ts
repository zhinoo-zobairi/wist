import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(async () => null),
    setItem: vi.fn(async () => undefined),
    removeItem: vi.fn(async () => undefined),
  },
}));

import { useWistStore } from "./useWistStore";

describe("Wist style profile store", () => {
  beforeEach(() => {
    useWistStore.setState({
      occasions: [],
      styles: [],
      profileStatus: "unknown",
    });
  });

  it("records an explicit onboarding skip", () => {
    useWistStore.getState().markProfileSkipped();
    expect(useWistStore.getState().profileStatus).toBe("skipped");
  });

  it("replaces selections only after a successful synchronization", () => {
    useWistStore
      .getState()
      .replaceStyleProfile(["work", "travel"], ["minimal", "bold"]);

    expect(useWistStore.getState()).toMatchObject({
      occasions: ["work", "travel"],
      styles: ["minimal", "bold"],
      profileStatus: "answered",
    });
  });
});

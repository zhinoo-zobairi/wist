import { describe, expect, it } from "vitest";

import type { CatalogueVariant } from "./model.js";
import { reachesWatchedSize } from "./watchedSizes.js";

const variant = (label: string, available: boolean): CatalogueVariant => ({
  id: `variant-${label}`,
  label,
  available,
});

describe("watched size rule", () => {
  it("alerts on any size when none was chosen", () => {
    expect(
      reachesWatchedSize({
        variants: [variant("38", false), variant("39", false)],
        watchedSizes: [],
      }),
    ).toBe(true);
  });

  it("alerts when a chosen size is available", () => {
    expect(
      reachesWatchedSize({
        variants: [variant("38", false), variant("39", true)],
        watchedSizes: ["39"],
      }),
    ).toBe(true);
  });

  it("stays quiet when every chosen size is sold out", () => {
    expect(
      reachesWatchedSize({
        variants: [variant("38", false), variant("39", true)],
        watchedSizes: ["38"],
      }),
    ).toBe(false);
  });

  it("stays quiet when a chosen size is no longer published", () => {
    expect(
      reachesWatchedSize({
        variants: [variant("39", true)],
        watchedSizes: ["38"],
      }),
    ).toBe(false);
  });

  it("alerts when any one of several chosen sizes is available", () => {
    expect(
      reachesWatchedSize({
        variants: [variant("38", false), variant("39", true)],
        watchedSizes: ["38", "39"],
      }),
    ).toBe(true);
  });

  // A label can repeat across variants, for instance the same size in two
  // colours. The question is whether the size is buyable at all, so one
  // available variant is enough.
  it("alerts when a repeated label is available in one variant", () => {
    expect(
      reachesWatchedSize({
        variants: [variant("38", false), { ...variant("38", true), id: "other" }],
        watchedSizes: ["38"],
      }),
    ).toBe(true);
  });

  // Fail open. If the product publishes no sizes at all we cannot evaluate the
  // rule, and staying quiet would be indistinguishable from "no drop happened" —
  // the worst outcome for a signal product. A parser regression must not silently
  // switch alerts off.
  it("alerts when the product publishes no sizes to judge", () => {
    expect(
      reachesWatchedSize({
        variants: [],
        watchedSizes: ["38"],
      }),
    ).toBe(true);
  });
});

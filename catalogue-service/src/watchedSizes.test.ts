import { describe, expect, it } from "vitest";

import type { CatalogueVariant } from "./model.js";
import {
  MAX_WATCH_SIZES,
  parseWatchSizes,
  reachesWatchedSize,
} from "./watchedSizes.js";

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

describe("watch size parsing", () => {
  it("accepts a list of labels, trimming and de-duplicating", () => {
    expect(parseWatchSizes(["40", " 39 ", "40"])).toEqual(["40", "39"]);
  });

  it("accepts an empty array as a request to clear the selection", () => {
    expect(parseWatchSizes([])).toEqual([]);
  });

  it("rejects anything that is not an array", () => {
    expect(parseWatchSizes("40")).toBeNull();
    expect(parseWatchSizes(undefined)).toBeNull();
    expect(parseWatchSizes({ "0": "40" })).toBeNull();
  });

  it("rejects non-string or empty entries", () => {
    expect(parseWatchSizes([40])).toBeNull();
    expect(parseWatchSizes(["40", ""])).toBeNull();
    expect(parseWatchSizes(["   "])).toBeNull();
  });

  it("rejects a label longer than the bound", () => {
    expect(parseWatchSizes(["x".repeat(33)])).toBeNull();
  });

  it("rejects more sizes than a single item could plausibly have", () => {
    const tooMany = Array.from({ length: MAX_WATCH_SIZES + 1 }, (_, i) => `s${i}`);
    expect(parseWatchSizes(tooMany)).toBeNull();
  });
});

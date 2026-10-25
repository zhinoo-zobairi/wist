import { describe, expect, it } from "vitest";

import { brandsToFollowAfterImport, newestAlertChanged, shouldSeedFollows } from "./catalogueLifecycle";
import type { Alert } from "./types";

const alert = (id: string): Alert => ({
  id, userId: "local", itemId: `item-${id}`, oldPrice: 300, newPrice: 210, pctOff: 30,
  createdAt: "2026-10-25T10:00:00.000Z", read: false,
});

describe("newestAlertChanged", () => {
  it("treats the first poll as the baseline, whatever it returns", () => {
    expect(newestAlertChanged(undefined, [])).toBe(false);
    expect(newestAlertChanged(undefined, [alert("a1")])).toBe(false);
  });

  it("is quiet while the newest alert stays the same", () => {
    expect(newestAlertChanged("a1", [alert("a1")])).toBe(false);
    expect(newestAlertChanged("a1", [alert("a1"), alert("a0")])).toBe(false);
    expect(newestAlertChanged(null, [])).toBe(false);
  });

  it("fires when a newer alert arrives or the list changes shape", () => {
    expect(newestAlertChanged("a1", [alert("a2"), alert("a1")])).toBe(true);
    expect(newestAlertChanged(null, [alert("a1")])).toBe(true);
    expect(newestAlertChanged("a1", [])).toBe(true);
  });
});

describe("shouldSeedFollows", () => {
  const seed = ["sezane", "claudie-pierlot", "other-stories"];

  it("seeds while the follows are the install default, in any order", () => {
    expect(shouldSeedFollows(seed, seed)).toBe(true);
    expect(shouldSeedFollows(["other-stories", "sezane", "claudie-pierlot"], seed)).toBe(true);
  });

  it("stops seeding once a house was followed or unfollowed by hand", () => {
    expect(shouldSeedFollows([...seed, "bobbies"], seed)).toBe(false);
    expect(shouldSeedFollows(["sezane", "other-stories"], seed)).toBe(false);
    expect(shouldSeedFollows([], seed)).toBe(false);
  });
});

describe("brandsToFollowAfterImport", () => {
  it("follows only the houses the import brought in", () => {
    expect(brandsToFollowAfterImport(["bobbies", "sandro"], ["bobbies", "sandro", "goelia"])).toEqual(["goelia"]);
    expect(brandsToFollowAfterImport(["bobbies", "sandro"], ["bobbies", "sandro"])).toEqual([]);
  });

  it("follows nothing when there was no catalogue to compare against", () => {
    expect(brandsToFollowAfterImport([], ["bobbies", "sandro"])).toEqual([]);
  });
});

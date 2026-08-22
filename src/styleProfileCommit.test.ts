import { describe, expect, it } from "vitest";

import { commitStyleProfile } from "./styleProfileCommit";
import type { Occasion, Style, StyleProfile } from "./types";

describe("commitStyleProfile", () => {
  it("applies the local selection before syncing, so a failed PUT still leaves onboarding", async () => {
    const applied: [Occasion[], Style[]][] = [];
    const apply = (occasions: Occasion[], styles: Style[]) => {
      applied.push([occasions, styles]);
    };
    const save = () => Promise.reject(new Error("offline"));

    await expect(
      commitStyleProfile({
        occasions: ["work"],
        styles: ["minimal"],
        apply,
        save,
      }),
    ).rejects.toThrow("offline");

    expect(applied).toEqual([[["work"], ["minimal"]]]);
  });

  it("reconciles with the canonical profile returned by the catalogue", async () => {
    const applied: [Occasion[], Style[]][] = [];
    const apply = (occasions: Occasion[], styles: Style[]) => {
      applied.push([occasions, styles]);
    };
    const canonical: StyleProfile = {
      occasions: ["work", "evening"],
      styles: ["bold"],
      updatedAt: "2026-08-23T00:00:00.000Z",
    };
    const save = () => Promise.resolve(canonical);

    await commitStyleProfile({
      occasions: ["evening", "work"],
      styles: ["bold"],
      apply,
      save,
    });

    expect(applied).toEqual([
      [["evening", "work"], ["bold"]],
      [["work", "evening"], ["bold"]],
    ]);
  });
});

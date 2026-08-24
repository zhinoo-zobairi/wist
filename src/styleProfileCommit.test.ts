import { describe, expect, it, vi } from "vitest";

import {
  commitStyleProfile,
  synchronizeStyleProfile,
} from "./styleProfileCommit";
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

  it("uploads a cached answer when the backend profile is missing", async () => {
    const apply = vi.fn();
    const save = vi.fn(async (): Promise<StyleProfile> => ({
      occasions: ["work", "travel"],
      styles: ["minimal", "bold"],
      updatedAt: "2026-08-23T00:00:00.000Z",
    }));

    await synchronizeStyleProfile({
      apply,
      getLocal: () => ({
        occasions: ["travel", "work"],
        styles: ["bold", "minimal"],
      }),
      load: async () => null,
      save,
    });

    expect(save).toHaveBeenCalledWith(
      ["travel", "work"],
      ["bold", "minimal"],
    );
    expect(apply).toHaveBeenCalledWith(
      ["work", "travel"],
      ["minimal", "bold"],
    );
  });

  it("does not create a profile when there is no local answer", async () => {
    const save = vi.fn();

    await synchronizeStyleProfile({
      apply: vi.fn(),
      getLocal: () => null,
      load: async () => null,
      save,
    });

    expect(save).not.toHaveBeenCalled();
  });
});

import { describe, expect, it, vi } from "vitest";

import {
  commitStyleProfile,
  synchronizeStyleProfile,
} from "./styleProfileCommit";
import { emptyStyleDetails, type Occasion, type Style, type StyleProfile } from "./types";

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
      details: emptyStyleDetails(),
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
      details: emptyStyleDetails(),
      updatedAt: "2026-08-23T00:00:00.000Z",
    }));

    await synchronizeStyleProfile({
      apply,
      getLocal: () => ({
        occasions: ["travel", "work"],
        styles: ["bold", "minimal"],
        details: emptyStyleDetails(),
        unsynced: false,
      }),
      load: async () => null,
      save,
    });

    expect(save).toHaveBeenCalledWith(
      ["travel", "work"],
      ["bold", "minimal"],
      emptyStyleDetails(),
    );
    expect(apply).toHaveBeenCalledWith(
      ["work", "travel"],
      ["minimal", "bold"],
      emptyStyleDetails(),
      false,
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

  it("marks a committed brief unsynced until the catalogue accepts it", async () => {
    const apply = vi.fn();
    const details = { ...emptyStyleDetails(), palettes: ["earth" as const] };

    await expect(
      commitStyleProfile({
        occasions: ["work"],
        styles: [],
        details,
        apply,
        save: () => Promise.reject(new Error("offline")),
      }),
    ).rejects.toThrow("offline");

    expect(apply).toHaveBeenCalledTimes(1);
    expect(apply).toHaveBeenCalledWith(["work"], [], details, true);
  });

  // Loading first would replace answers the catalogue never saw with its older copy.
  it("re-sends answers the catalogue never accepted instead of loading over them", async () => {
    const details = { ...emptyStyleDetails(), palettes: ["earth" as const] };
    const load = vi.fn();
    const apply = vi.fn();
    const save = vi.fn(async (): Promise<StyleProfile> => ({
      occasions: ["work"],
      styles: [],
      details,
      updatedAt: "2026-10-31T00:00:00.000Z",
    }));

    await synchronizeStyleProfile({
      apply,
      getLocal: () => ({ occasions: ["work"], styles: [], details, unsynced: true }),
      load,
      save,
    });

    expect(load).not.toHaveBeenCalled();
    expect(save).toHaveBeenCalledWith(["work"], [], details);
    expect(apply).toHaveBeenCalledWith(["work"], [], details, false);
  });
});

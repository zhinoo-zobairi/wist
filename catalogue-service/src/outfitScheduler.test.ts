import { afterEach, describe, expect, it, vi } from "vitest";
import type { GenerationDeps } from "./outfitGeneration.js";
import { runDueOutfitGeneration } from "./outfitScheduler.js";
import type { OutfitSuggester } from "./outfitSuggester.js";
import { capDay } from "./outfitSchedule.js";
import { SqliteOutfitRepository } from "./sqliteOutfitRepository.js";
import { SqliteStyleProfileRepository } from "./sqliteStyleProfileRepository.js";
import { SqliteWardrobeRepository } from "./sqliteWardrobeRepository.js";
import type { GarmentInput } from "./wardrobe.js";

const input: GarmentInput = { name: "Piece", category: "top", colors: ["navy"], formality: "casual", warmth: "light", occasions: [], notes: null };
const closers: { close: () => void }[] = [];
const at = (hour: number, minute = 0) => new Date(2026, 9, 10, hour, minute);

async function setup() {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(at(9));
  const wardrobe = new SqliteWardrobeRepository(":memory:");
  const outfits = new SqliteOutfitRepository(":memory:");
  const profiles = new SqliteStyleProfileRepository(":memory:");
  closers.push(wardrobe, outfits, profiles);
  const ids: string[] = [];
  for (let index = 0; index < 3; index += 1) ids.push((await wardrobe.createGarment({ ...input, name: `P${index}` }, "manual")).id);
  await outfits.setCatchUpCheckedDay(capDay(at(9)));
  const suggest = vi.fn<OutfitSuggester["suggest"]>().mockResolvedValue({
    ok: true, outfits: [{ occasion: "work", garmentIds: [ids[0]!, ids[1]!], reason: "Good." }],
  });
  const deps: GenerationDeps = { wardrobe, outfits, profiles, suggester: { suggest } };
  return { deps, suggest, outfits };
}

describe("runDueOutfitGeneration", () => {
  afterEach(() => { closers.splice(0).forEach((c) => c.close()); vi.useRealTimers(); vi.restoreAllMocks(); });

  it("runs once after 10 quiet minutes and not again for the same change", async () => {
    const { deps, suggest } = await setup();
    await expect(runDueOutfitGeneration(deps, at(9, 9))).resolves.toBeNull();
    vi.setSystemTime(at(9, 10));
    await expect(runDueOutfitGeneration(deps, at(9, 10))).resolves.toBe("debounced");
    await expect(runDueOutfitGeneration(deps, at(9, 30))).resolves.toBeNull();
    expect(suggest).toHaveBeenCalledTimes(1);
  });

  it("does not retry a failed run on the next tick", async () => {
    const { deps, suggest } = await setup();
    suggest.mockResolvedValue({ ok: false, reason: "api_error" });
    await runDueOutfitGeneration(deps, at(9, 10));
    await expect(runDueOutfitGeneration(deps, at(9, 11))).resolves.toBeNull();
    expect(suggest).toHaveBeenCalledTimes(1);
  });

  it("consumes a More ideas request exactly once", async () => {
    const { deps, outfits, suggest } = await setup();
    await runDueOutfitGeneration(deps, at(9, 10));
    await outfits.requestMoreIdeas();
    await expect(runDueOutfitGeneration(deps, at(9, 20))).resolves.toBe("more_ideas");
    await expect(outfits.moreIdeasRequested()).resolves.toBe(false);
    await expect(runDueOutfitGeneration(deps, at(9, 21))).resolves.toBeNull();
    expect(suggest).toHaveBeenCalledTimes(2);
  });

  it("records the catch-up check for the new cap day", async () => {
    const { deps, outfits } = await setup();
    await outfits.setCatchUpCheckedDay("2026-10-08");
    await runDueOutfitGeneration(deps, at(9, 5));
    await expect(outfits.catchUpCheckedDay()).resolves.toBe(capDay(at(9, 5)));
  });
});

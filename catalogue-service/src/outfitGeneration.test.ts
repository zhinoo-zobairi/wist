import { afterEach, describe, expect, it, vi } from "vitest";
import { runOutfitGeneration, type GenerationDeps } from "./outfitGeneration.js";
import type { OutfitSuggester } from "./outfitSuggester.js";
import { SqliteOutfitRepository } from "./sqliteOutfitRepository.js";
import { SqliteStyleProfileRepository } from "./sqliteStyleProfileRepository.js";
import { SqliteWardrobeRepository } from "./sqliteWardrobeRepository.js";
import type { GarmentInput } from "./wardrobe.js";

const input: GarmentInput = { name: "Piece", category: "top", colors: ["navy"], formality: "casual", warmth: "light", occasions: [], notes: null };
const closers: { close: () => void }[] = [];

function setup() {
  const wardrobe = new SqliteWardrobeRepository(":memory:");
  const outfits = new SqliteOutfitRepository(":memory:");
  const profiles = new SqliteStyleProfileRepository(":memory:");
  closers.push(wardrobe, outfits, profiles);
  const suggest = vi.fn<OutfitSuggester["suggest"]>();
  const deps: GenerationDeps = { wardrobe, outfits, profiles, suggester: { suggest } };
  const populate = async (count = 3) => {
    const ids: string[] = [];
    for (let index = 0; index < count; index += 1) ids.push((await wardrobe.createGarment({ ...input, name: `P${index}` }, "manual")).id);
    return ids;
  };
  return { wardrobe, outfits, profiles, suggest, deps, populate };
}

describe("runOutfitGeneration", () => {
  afterEach(() => { closers.splice(0).forEach((c) => c.close()); vi.restoreAllMocks(); });

  it("skips without calling Claude below 3 tagged garments, and the skip does not count (D2)", async () => {
    const { deps, suggest, outfits, populate } = setup();
    await populate(2);
    await expect(runOutfitGeneration(deps, "debounced")).resolves.toEqual({ status: "skipped", added: 0 });
    expect(suggest).not.toHaveBeenCalled();
    await expect(outfits.runSummary(new Date(0))).resolves.toMatchObject({ runsThisCapDay: 0 });
  });

  it("covers all five occasions without a profile (D1) and the profile's occasions with one", async () => {
    const { deps, suggest, profiles, populate } = setup();
    await populate();
    suggest.mockResolvedValue({ ok: true, outfits: [] });
    await runOutfitGeneration(deps, "debounced");
    expect(suggest.mock.calls[0]![0].occasions).toEqual(["work", "evening", "weekend", "celebration", "travel"]);
    await profiles.replaceProfile({ occasions: ["evening"], styles: [] });
    await runOutfitGeneration(deps, "debounced");
    expect(suggest.mock.calls[1]![0].occasions).toEqual(["evening"]);
  });

  it("stores valid outfits, records the input change time, and favours changes since the last success", async () => {
    const { deps, suggest, wardrobe, outfits, populate } = setup();
    const [a, b, c] = await populate();
    suggest.mockResolvedValue({ ok: true, outfits: [{ occasion: "work", garmentIds: [a!, b!], reason: "Good." }] });
    await expect(runOutfitGeneration(deps, "debounced")).resolves.toEqual({ status: "succeeded", added: 1 });
    expect(suggest.mock.calls[0]![0].focusGarmentIds).toEqual([]);
    const changedAt = await wardrobe.lastChangedAt();
    await expect(outfits.runSummary(new Date(0))).resolves.toMatchObject({ lastSucceededChangedAt: changedAt });

    await new Promise((resolve) => setTimeout(resolve, 5));
    await wardrobe.replaceGarment(c!, { ...input, name: "Edited" });
    suggest.mockResolvedValue({ ok: true, outfits: [{ occasion: "work", garmentIds: [a!, c!], reason: "New." }] });
    await runOutfitGeneration(deps, "debounced");
    expect(suggest.mock.calls[1]![0].focusGarmentIds).toEqual([c]);
    expect((await outfits.listSuggestions()).map((s) => s.reason)).toEqual(["New.", "Good."]);
  });

  it("favours changed pieces only in change-triggered runs", async () => {
    const { deps, suggest, wardrobe, populate } = setup();
    const [a, b, c] = await populate();
    suggest.mockResolvedValue({ ok: true, outfits: [{ occasion: "work", garmentIds: [a!, b!], reason: "Good." }] });
    await runOutfitGeneration(deps, "debounced");
    await new Promise((resolve) => setTimeout(resolve, 5));
    await wardrobe.replaceGarment(c!, { ...input, name: "Edited" });
    await runOutfitGeneration(deps, "more_ideas");
    expect(suggest.mock.calls[1]![0].focusGarmentIds).toEqual([]);
    await new Promise((resolve) => setTimeout(resolve, 5));
    await wardrobe.replaceGarment(c!, { ...input, name: "Edited again" });
    await runOutfitGeneration(deps, "catch_up");
    expect(suggest.mock.calls[2]![0].focusGarmentIds).toEqual([c]);
  });

  it("fails without storing anything when Claude fails or every outfit is invalid", async () => {
    const { deps, suggest, outfits, populate } = setup();
    const [a] = await populate();
    suggest.mockResolvedValueOnce({ ok: false, reason: "api_error" });
    await expect(runOutfitGeneration(deps, "debounced")).resolves.toEqual({ status: "failed", added: 0 });
    suggest.mockResolvedValueOnce({ ok: true, outfits: [{ occasion: "work", garmentIds: [a!, "invented"], reason: "x" }] });
    await expect(runOutfitGeneration(deps, "debounced")).resolves.toEqual({ status: "failed", added: 0 });
    await expect(outfits.listSuggestions()).resolves.toEqual([]);
    await expect(outfits.runSummary(new Date(0))).resolves.toMatchObject({ lastSucceededChangedAt: null, runsThisCapDay: 2 });
  });

  it("drops outfits using a garment deleted while Claude was thinking, and cleans the pool first", async () => {
    const { deps, suggest, wardrobe, outfits, populate } = setup();
    const [a, b, c] = await populate();
    await outfits.storeSuggestions([{ occasion: "work", garmentIds: [a!, "gone"], reason: "Old." }]);
    suggest.mockImplementation(async () => {
      await wardrobe.deleteGarment(c!);
      return { ok: true, outfits: [
        { occasion: "work", garmentIds: [a!, c!], reason: "Uses deleted." },
        { occasion: "work", garmentIds: [a!, b!], reason: "Fine." },
      ] };
    });
    await runOutfitGeneration(deps, "more_ideas");
    expect((await outfits.listSuggestions()).map((s) => s.reason)).toEqual(["Fine."]);
  });
});

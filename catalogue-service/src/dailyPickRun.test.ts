import { afterEach, describe, expect, it, vi } from "vitest";
import { runDueDailyPick, type DailyPickDeps } from "./dailyPickRun.js";
import type { OutfitPicker } from "./outfitPicker.js";
import { SqliteOutfitRepository } from "./sqliteOutfitRepository.js";
import { SqliteWardrobeRepository } from "./sqliteWardrobeRepository.js";
import type { GarmentInput } from "./wardrobe.js";
import type { WeatherSource, WeatherSummary } from "./weather.js";

const input: GarmentInput = { name: "Piece", category: "top", colors: ["navy"], formality: "casual", warmth: "light", occasions: [], notes: null };
const weather: WeatherSummary = { minC: 6, maxC: 11, precipitationChancePct: 70, maxWindKph: 20, condition: "rain" };
const closers: { close: () => void }[] = [];
// Local-time constructor, so tests hold in any time zone.
const at = (day: number, hour: number, minute = 0) => new Date(2026, 9, day, hour, minute);

async function setup({ location = true, outfits: withOutfits = true } = {}) {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(at(11, 5));
  const wardrobe = new SqliteWardrobeRepository(":memory:");
  const outfits = new SqliteOutfitRepository(":memory:");
  closers.push(wardrobe, outfits);
  const ids: string[] = [];
  for (let index = 0; index < 3; index += 1) ids.push((await wardrobe.createGarment({ ...input, name: `P${index}` }, "manual")).id);
  await wardrobe.createPhotoGarment("image/jpeg"); // untagged: never sent to Claude
  if (withOutfits) {
    await outfits.storeSuggestions([
      { occasion: "work", garmentIds: [ids[0]!, ids[1]!], reason: "Idea." },
      { occasion: "weekend", garmentIds: [ids[0]!, ids[2]!], reason: "Keep." },
    ]);
    const keep = (await outfits.listSuggestions()).find((s) => s.reason === "Keep.")!;
    await outfits.saveSuggestion(keep.id);
  }
  if (location) await outfits.saveLocation({ latitude: 52.52, longitude: 13.41 });
  const today = vi.fn<WeatherSource["today"]>().mockResolvedValue(weather);
  const pick = vi.fn<OutfitPicker["pick"]>();
  const deps: DailyPickDeps = { wardrobe, outfits, weatherSource: { today }, picker: { pick } };
  return { deps, outfits, today, pick, ids };
}

describe("runDueDailyPick", () => {
  afterEach(() => { closers.splice(0).forEach((c) => c.close()); vi.useRealTimers(); vi.restoreAllMocks(); });

  it("ranks every stored outfit once, recording the attempt before the call, and stores the valid ranking", async () => {
    const { deps, outfits, today, pick, ids } = await setup();
    const [idea] = await outfits.listSuggestions();
    const [saved] = await outfits.listSaved();
    pick.mockImplementation(async () => {
      expect(await outfits.dailyPickAttemptedDay()).toBe("2026-10-11");
      return { ok: true, order: ["invented", saved!.id, idea!.id, saved!.id], top: [
        { id: saved!.id, reason: ` ${"w".repeat(250)} ` }, { id: "invented", reason: "No." },
      ] };
    });
    await expect(runDueDailyPick(deps, at(11, 6))).resolves.toBe("succeeded");

    expect(today).toHaveBeenCalledExactlyOnceWith({ latitude: 52.52, longitude: 13.41 });
    const sent = pick.mock.calls[0]![0];
    expect(sent.weather).toEqual(weather);
    expect(sent.garments.map((g) => g.id).sort()).toEqual([...ids].sort());
    expect(sent.outfits).toEqual([
      { id: idea!.id, occasion: "work", garmentIds: [ids[0], ids[1]], saved: false },
      { id: saved!.id, occasion: "weekend", garmentIds: [ids[0], ids[2]], saved: true },
    ]);
    await expect(outfits.getDailyPick()).resolves.toEqual({
      day: "2026-10-11", weather, order: [saved!.id, idea!.id], reasons: { [saved!.id]: "w".repeat(200) },
    });
  });

  it("does not send an idea that uses a deleted garment to the picker", async () => {
    const { deps, outfits, pick, ids } = await setup();
    const [idea] = await outfits.listSuggestions();
    await deps.wardrobe.deleteGarment(ids[1]!); // used only by the stored idea
    pick.mockResolvedValue({ ok: true, order: [], top: [] });
    await runDueDailyPick(deps, at(11, 6));
    const sent = pick.mock.calls[0]![0];
    expect(sent.outfits.map((outfit) => outfit.id)).not.toContain(idea!.id);
    expect(sent.outfits).toHaveLength(1);
  });

  it("is due from 06:00, once per server-local date, and never retries a failure that day", async () => {
    const { deps, pick } = await setup();
    pick.mockResolvedValue({ ok: false, reason: "api_error" });
    await expect(runDueDailyPick(deps, at(11, 5, 59))).resolves.toBeNull();
    await expect(runDueDailyPick(deps, at(11, 6))).resolves.toBe("failed");
    await expect(runDueDailyPick(deps, at(11, 6, 1))).resolves.toBeNull();
    await expect(runDueDailyPick(deps, at(11, 23, 59))).resolves.toBeNull();
    await expect(runDueDailyPick(deps, at(12, 5, 59))).resolves.toBeNull();
    await expect(runDueDailyPick(deps, at(12, 6))).resolves.toBe("failed");
    expect(pick).toHaveBeenCalledTimes(2);
  });

  it.each([
    ["no stored location", { location: false }],
    ["no stored outfits", { outfits: false }],
  ])("skips with %s, records the attempt and makes no call", async (_, options) => {
    const { deps, outfits, today, pick } = await setup(options);
    await expect(runDueDailyPick(deps, at(11, 6))).resolves.toBe("skipped");
    await expect(outfits.dailyPickAttemptedDay()).resolves.toBe("2026-10-11");
    expect(today).not.toHaveBeenCalled();
    expect(pick).not.toHaveBeenCalled();
    await expect(runDueDailyPick(deps, at(11, 7))).resolves.toBeNull();
  });

  it("counts unavailable weather as the day's failed attempt without calling Claude", async () => {
    const { deps, outfits, today, pick } = await setup();
    today.mockResolvedValue(null);
    await expect(runDueDailyPick(deps, at(11, 6))).resolves.toBe("failed");
    expect(pick).not.toHaveBeenCalled();
    await expect(outfits.getDailyPick()).resolves.toBeNull();
    await expect(runDueDailyPick(deps, at(11, 7))).resolves.toBeNull();
  });

  it("fails without storing when no ranked id is valid", async () => {
    const { deps, outfits, pick } = await setup();
    pick.mockResolvedValue({ ok: true, order: ["invented"], top: [] });
    await expect(runDueDailyPick(deps, at(11, 6))).resolves.toBe("failed");
    await expect(outfits.getDailyPick()).resolves.toBeNull();
  });

  it("ends as failed when the picker throws", async () => {
    const { deps, pick } = await setup();
    vi.spyOn(console, "error").mockImplementation(() => {});
    pick.mockRejectedValue(new Error("boom"));
    await expect(runDueDailyPick(deps, at(11, 6))).resolves.toBe("failed");
  });
});

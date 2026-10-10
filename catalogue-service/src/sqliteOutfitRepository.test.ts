import { afterEach, describe, expect, it, vi } from "vitest";
import { MAX_SUGGESTIONS_PER_OCCASION } from "./outfitRepository.js";
import { SqliteOutfitRepository } from "./sqliteOutfitRepository.js";

const repositories: SqliteOutfitRepository[] = [];
function createRepository() {
  const repository = new SqliteOutfitRepository(":memory:");
  repositories.push(repository);
  return repository;
}
const work = (ids: string[], reason = "Polished.") => ({ occasion: "work" as const, garmentIds: ids, reason });

describe("SQLite outfit repository", () => {
  afterEach(() => { repositories.splice(0).forEach((r) => r.close()); vi.useRealTimers(); });

  it("stores suggestions newest first and drops duplicates of suggestions or saved outfits", async () => {
    const repository = createRepository();
    await expect(repository.storeSuggestions([work(["a", "b"]), work(["b", "a"])])).resolves.toBe(1);
    await expect(repository.storeSuggestions([work(["a", "c"])])).resolves.toBe(1);
    const listed = await repository.listSuggestions();
    expect(listed.map((s) => s.garmentIds)).toEqual([["a", "c"], ["a", "b"]]);

    await repository.saveSuggestion(listed[1]!.id);
    await expect(repository.storeSuggestions([work(["b", "a"])])).resolves.toBe(0);
  });

  it("keeps at most 10 unsaved suggestions per occasion, evicting the oldest", async () => {
    const repository = createRepository();
    for (let index = 0; index < MAX_SUGGESTIONS_PER_OCCASION + 2; index += 1) {
      await repository.storeSuggestions([work(["a", `g${index}`])]);
    }
    await repository.storeSuggestions([{ occasion: "travel", garmentIds: ["x", "y"], reason: "Packs well." }]);
    const listed = await repository.listSuggestions();
    const workIds = listed.filter((s) => s.occasion === "work").map((s) => s.garmentIds[1]);
    expect(workIds).toHaveLength(MAX_SUGGESTIONS_PER_OCCASION);
    expect(workIds).not.toContain("g0");
    expect(workIds).not.toContain("g1");
    expect(listed.some((s) => s.occasion === "travel")).toBe(true);
  });

  it("never evicts saved outfits when a pool overflows", async () => {
    const repository = createRepository();
    await repository.storeSuggestions([work(["s", "t"], "Saved one.")]);
    const [suggestion] = await repository.listSuggestions();
    await repository.saveSuggestion(suggestion!.id);
    const savedBefore = await repository.listSaved();
    for (let index = 0; index < MAX_SUGGESTIONS_PER_OCCASION + 2; index += 1) {
      await repository.storeSuggestions([work(["a", `g${index}`])]);
    }
    await expect(repository.listSaved()).resolves.toEqual(savedBefore);
    expect(savedBefore).toHaveLength(1);
  });

  it("moves a saved suggestion out of the pool and keeps it until removed (D6)", async () => {
    const repository = createRepository();
    await repository.storeSuggestions([work(["a", "b"], "Keep this.")]);
    const [suggestion] = await repository.listSuggestions();
    const saved = await repository.saveSuggestion(suggestion!.id);
    expect(saved).toMatchObject({ occasion: "work", garmentIds: ["a", "b"], reason: "Keep this.", savedAt: expect.any(String) });
    await expect(repository.listSuggestions()).resolves.toEqual([]);
    await expect(repository.listSaved()).resolves.toEqual([saved]);
    await expect(repository.saveSuggestion(suggestion!.id)).resolves.toBeNull();
    await expect(repository.deleteSaved(saved!.id)).resolves.toBe(true);
    await expect(repository.deleteSaved(saved!.id)).resolves.toBe(false);
  });

  it("deletes suggestions that use a garment no longer in the wardrobe, but never saved outfits", async () => {
    const repository = createRepository();
    await repository.storeSuggestions([work(["a", "b"]), work(["a", "gone"])]);
    const [toSave] = (await repository.listSuggestions()).filter((s) => s.garmentIds.includes("gone"));
    await repository.storeSuggestions([work(["c", "gone"])]);
    await repository.saveSuggestion(toSave!.id);
    await expect(repository.deleteSuggestionsWithout(new Set(["a", "b", "c"]))).resolves.toBe(1);
    expect((await repository.listSuggestions()).map((s) => s.garmentIds)).toEqual([["a", "b"]]);
    expect((await repository.listSaved()).map((s) => s.garmentIds)).toEqual([["a", "gone"]]);
  });

  it("summarises runs for the cap and the schedule", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const repository = createRepository();
    vi.setSystemTime(new Date("2026-10-10T08:00:00.000Z"));
    const first = await repository.startRun("debounced", "2026-10-10T07:00:00.000Z");
    await expect(repository.runSummary(new Date("2026-10-10T00:00:00.000Z")))
      .resolves.toMatchObject({ running: true, runsThisCapDay: 1 });
    await repository.finishRun(first, "succeeded", 2, null);
    const second = await repository.startRun("more_ideas", "2026-10-10T07:30:00.000Z");
    await repository.finishRun(second, "failed", 0, "api_error");
    const skipped = await repository.startRun("catch_up", "2026-10-10T07:30:00.000Z");
    await repository.finishRun(skipped, "skipped", 0, null);

    await expect(repository.runSummary(new Date("2026-10-10T00:00:00.000Z"))).resolves.toEqual({
      runsThisCapDay: 2, running: false,
      lastAttemptedChangedAt: "2026-10-10T07:30:00.000Z",
      lastSucceededChangedAt: "2026-10-10T07:00:00.000Z",
      lastRun: { at: "2026-10-10T08:00:00.000Z", status: "skipped" },
    });
    await expect(repository.runSummary(new Date("2026-10-11T00:00:00.000Z")))
      .resolves.toMatchObject({ runsThisCapDay: 0 });
  });

  it("fails runs interrupted by a restart and prunes old runs but keeps the latest success", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const repository = createRepository();
    vi.setSystemTime(new Date("2026-10-01T08:00:00.000Z"));
    const old = await repository.startRun("debounced", "2026-10-01T07:00:00.000Z");
    await repository.finishRun(old, "succeeded", 1, null);
    const oldFail = await repository.startRun("debounced", "2026-10-01T07:30:00.000Z");
    await repository.finishRun(oldFail, "failed", 0, "api_error");
    vi.setSystemTime(new Date("2026-10-10T08:00:00.000Z"));
    await repository.startRun("debounced", "2026-10-10T07:00:00.000Z");

    await repository.failInterruptedRuns();
    const since = new Date("2026-10-01T00:00:00.000Z");
    await expect(repository.runSummary(since)).resolves.toMatchObject({ runsThisCapDay: 3 });
    await repository.pruneRuns(new Date("2026-10-03T00:00:00.000Z"));
    await expect(repository.runSummary(since)).resolves.toMatchObject({ runsThisCapDay: 2 });
    const summary = await repository.runSummary(new Date("2026-10-10T00:00:00.000Z"));
    expect(summary.running).toBe(false);
    expect(summary.lastSucceededChangedAt).toBe("2026-10-01T07:00:00.000Z");
    expect(summary.lastRun).toEqual({ at: "2026-10-10T08:00:00.000Z", status: "failed" });
  });

  it("keeps one More ideas request and the catch-up day", async () => {
    const repository = createRepository();
    await expect(repository.moreIdeasRequested()).resolves.toBe(false);
    await repository.requestMoreIdeas();
    await repository.requestMoreIdeas();
    await expect(repository.moreIdeasRequested()).resolves.toBe(true);
    await repository.clearMoreIdeasRequest();
    await expect(repository.moreIdeasRequested()).resolves.toBe(false);
    await expect(repository.catchUpCheckedDay()).resolves.toBeNull();
    await repository.setCatchUpCheckedDay("2026-10-10");
    await expect(repository.catchUpCheckedDay()).resolves.toBe("2026-10-10");
  });
});

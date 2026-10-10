# Background Outfit Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate outfit suggestions in the background and serve them instantly, with saved outfits that are never lost.

**Architecture:** The wardrobe repository records the time of every relevant change. An in-process scheduler (60 s tick) asks a pure `decideRun` function whether a debounced, catch-up or "more ideas" run is due, then runs one Claude call that stores up to 2 new outfits per occasion. "Dress me" reads stored suggestions and saved outfits through `GET /v1/outfits` with no Claude call.

**Tech Stack:** TypeScript, `node:sqlite` (`DatabaseSync`), `@anthropic-ai/sdk` + `zod`, vitest, Expo / React Native, Zustand.

**Spec:** `docs/superpowers/specs/2026-10-10-background-outfit-generation-design.md` (owner-approved, incl. D1–D7).

---

## Conventions (read once)

- Run all commands from the repo root `/Users/zhinoo.zobairi/Code/WIST`.
- Single test file: `npx vitest run <path>`. Full checks: `npm run typecheck && npm test && npm run catalogue:build`.
- Commit subjects: `type(scope): description`, lowercase, imperative, no trailing period, **no AI attribution trailers**. Do not push.
- Backend imports use the `.js` suffix (`./outfits.js`); mobile imports have no suffix.
- ISO timestamps from `new Date().toISOString()` compare correctly as strings; the code relies on that.

## File map

| File | Responsibility |
|---|---|
| `catalogue-service/src/wardrobeRepository.ts` (modify) | add `lastChangedAt()` to the interface |
| `catalogue-service/src/sqliteWardrobeRepository.ts` (modify) | `wardrobe_change_log` table, written by every write that can change the tagged set |
| `catalogue-service/src/outfitSchedule.ts` (create) | pure timing rules: `capDay`, `capDayStart`, `decideRun` |
| `catalogue-service/src/outfits.ts` (rewrite) | `GeneratedOutfit`, `garmentKey`, `keepValidGeneratedOutfits` |
| `catalogue-service/src/outfitRepository.ts` (create) | storage interface + record types |
| `catalogue-service/src/sqliteOutfitRepository.ts` (create) | suggestions, saved outfits, run log, request flags |
| `catalogue-service/src/outfitSuggester.ts` (rewrite) | generator boundary (occasions + focus ids in, outfits with occasion out) |
| `catalogue-service/src/claudeOutfitSuggester.ts` (modify) | the Claude call for a background run |
| `catalogue-service/src/outfitGeneration.ts` (create) | one run: read wardrobe → Claude → validate → store → run log |
| `catalogue-service/src/outfitScheduler.ts` (create) | `runDueOutfitGeneration` + `startOutfitScheduler` loop |
| `catalogue-service/src/outfitRoutes.ts` (rewrite) | `GET /v1/outfits`, saved routes, `POST /v1/outfits/more` |
| `catalogue-service/src/app.ts`, `server.ts` (modify) | wiring; remove `/v1/outfits/suggestions` |
| `src/types.ts`, `src/services/catalogueClient.ts` (modify) | mobile types + client functions |
| `src/screens/OutfitSuggestionsScreen.tsx` (rewrite) | instant "Dress me" with ♡, Saved, More ideas |
| `README.md`, `docs/WARDROBE_DECISIONS.md` (modify) | docs |

---

### Task 1: Record wardrobe changes

Changes that can alter the set of **tagged** garments are recorded: manual create (always tagged), any successful attribute write (`replaceGarment`, `applyTags` — both set `tagged`), and delete. A photo upload (still `untagged`) and `markTagFailed` (never touches a tagged garment) are **not** recorded, because they cannot change what Claude sees; recording them would buy runs with identical input.

**Files:**
- Modify: `catalogue-service/src/wardrobeRepository.ts`
- Modify: `catalogue-service/src/sqliteWardrobeRepository.ts`
- Test: `catalogue-service/src/sqliteWardrobeRepository.test.ts`

- [ ] **Step 1: Write the failing tests**

Append inside the existing top-level `describe` in `catalogue-service/src/sqliteWardrobeRepository.test.ts` (it already imports `vi`, `DatabaseSync`, `mkdtempSync`, `tmpdir`, `join`, and defines `createRepository`, `input`, `directories`):

```ts
  it("records the time of every change that can alter the tagged wardrobe", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      const repository = createRepository();
      await expect(repository.lastChangedAt()).resolves.toBeNull();

      vi.setSystemTime(new Date("2026-10-10T09:00:00.000Z"));
      const photo = await repository.createPhotoGarment("image/jpeg");
      await repository.markTagFailed(photo.id);
      await expect(repository.lastChangedAt()).resolves.toBeNull();

      vi.setSystemTime(new Date("2026-10-10T09:01:00.000Z"));
      await repository.applyTags(photo.id, input);
      await expect(repository.lastChangedAt()).resolves.toBe("2026-10-10T09:01:00.000Z");

      vi.setSystemTime(new Date("2026-10-10T09:02:00.000Z"));
      const manual = await repository.createGarment(input, "manual");
      await expect(repository.lastChangedAt()).resolves.toBe("2026-10-10T09:02:00.000Z");

      vi.setSystemTime(new Date("2026-10-10T09:03:00.000Z"));
      await repository.replaceGarment(manual.id, { ...input, name: "Edited" });
      await expect(repository.lastChangedAt()).resolves.toBe("2026-10-10T09:03:00.000Z");

      vi.setSystemTime(new Date("2026-10-10T09:04:00.000Z"));
      await repository.applyTags(manual.id, input); // refused: already tagged
      await repository.deleteGarment("missing");
      await expect(repository.lastChangedAt()).resolves.toBe("2026-10-10T09:03:00.000Z");

      vi.setSystemTime(new Date("2026-10-10T09:05:00.000Z"));
      await repository.deleteGarment(manual.id);
      await expect(repository.lastChangedAt()).resolves.toBe("2026-10-10T09:05:00.000Z");
    } finally {
      vi.useRealTimers();
    }
  });

  it("marks an existing wardrobe as changed when the change log is first created", async () => {
    const directory = mkdtempSync(join(tmpdir(), "wist-change-log-"));
    directories.push(directory);
    const path = join(directory, "wardrobe.sqlite");
    const first = new SqliteWardrobeRepository(path);
    await first.createGarment(input, "manual");
    first.close();
    const database = new DatabaseSync(path);
    database.exec("DROP TABLE wardrobe_change_log");
    database.close();

    const reopened = new SqliteWardrobeRepository(path);
    await expect(reopened.lastChangedAt()).resolves.toEqual(expect.any(String));
    reopened.close();
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run catalogue-service/src/sqliteWardrobeRepository.test.ts`
Expected: FAIL — `repository.lastChangedAt is not a function`.

- [ ] **Step 3: Add the interface method**

In `catalogue-service/src/wardrobeRepository.ts`, add to `WardrobeRepository` after `countGarments(): Promise<number>;`:

```ts
  /** When the set of tagged garments last changed, or null if it never has. */
  lastChangedAt(): Promise<string | null>;
```

- [ ] **Step 4: Implement the change log**

In `catalogue-service/src/sqliteWardrobeRepository.ts`:

1. In the constructor's `this.database.exec(` block that creates `garments`, `garment_colors`, `garment_occasions`, append this table after the last `CREATE TABLE` (inside the same template string):

```sql
      CREATE TABLE IF NOT EXISTS wardrobe_change_log (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        last_changed_at TEXT NOT NULL
      );
```

2. At the end of the constructor (after all existing migration code), seed it for wardrobes that existed before this table:

```ts
    this.database.prepare(`
      INSERT OR IGNORE INTO wardrobe_change_log (id, last_changed_at)
      SELECT 1, ? WHERE EXISTS (SELECT 1 FROM garments)
    `).run(new Date().toISOString());
```

3. Add a private helper next to `writeChildSets`:

```ts
  // Called inside the caller's transaction so the change and its record commit together.
  private recordChange(changedAt: string): void {
    this.database.prepare(`
      INSERT INTO wardrobe_change_log (id, last_changed_at) VALUES (1, ?)
      ON CONFLICT (id) DO UPDATE SET last_changed_at = excluded.last_changed_at
    `).run(changedAt);
  }
```

4. In `insertGarment`, after `this.writeChildSets(id, input);` and before `this.database.exec("COMMIT");`, add:

```ts
      if (tagStatus === "tagged") this.recordChange(now);
```

5. Replace `writeAttributes` with:

```ts
  private async writeAttributes(id: string, input: GarmentInput, condition: WriteCondition): Promise<Garment | null> {
    const guard = writeGuard(condition);
    const now = new Date().toISOString();
    this.database.exec("BEGIN IMMEDIATE");
    try {
      const result = this.database.prepare(`
        UPDATE garments SET name = ?, category = ?, formality = ?, warmth = ?, notes = ?, updated_at = ?, tag_status = 'tagged'
        WHERE id = ? AND ${guard.sql}
      `).run(input.name, input.category, input.formality, input.warmth, input.notes, now, id, ...guard.params);
      if (result.changes > 0) {
        this.writeChildSets(id, input);
        this.recordChange(now);
      }
      this.database.exec("COMMIT");
      return result.changes > 0 ? this.getGarment(id) : null;
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }
```

6. Replace `deleteGarment` with:

```ts
  async deleteGarment(id: string): Promise<boolean> {
    this.database.exec("BEGIN IMMEDIATE");
    try {
      const deleted = this.database.prepare("DELETE FROM garments WHERE id = ?").run(id).changes > 0;
      if (deleted) this.recordChange(new Date().toISOString());
      this.database.exec("COMMIT");
      return deleted;
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }
```

7. Add after `countGarments`:

```ts
  async lastChangedAt(): Promise<string | null> {
    const row = this.database.prepare("SELECT last_changed_at FROM wardrobe_change_log WHERE id = 1")
      .get() as unknown as { last_changed_at: string } | undefined;
    return row?.last_changed_at ?? null;
  }
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run catalogue-service/src/sqliteWardrobeRepository.test.ts catalogue-service/src/wardrobeRoutes.test.ts`
Expected: PASS (all).

- [ ] **Step 6: Typecheck and commit**

Run: `npm run typecheck`
Expected: no errors. (If a test file defines an object literal typed `WardrobeRepository`, add `lastChangedAt: async () => null` to it.)

```bash
git add catalogue-service/src/wardrobeRepository.ts catalogue-service/src/sqliteWardrobeRepository.ts catalogue-service/src/sqliteWardrobeRepository.test.ts
git commit -m "feat(outfits): record when the tagged wardrobe last changed"
```

---

### Task 2: Pure scheduling rules

A "cap day" runs from **03:00 to 03:00 local time**, not midnight. That keeps decision 5 ("beyond the cap, wait for the nightly run"): if the cap day reset at midnight, leftover changes would fire at 00:00 instead of the 03:00 catch-up. The catch-up is checked once per cap day on its first tick (03:00 if the service is running then, otherwise the first moment after).

**Files:**
- Create: `catalogue-service/src/outfitSchedule.ts`
- Test: `catalogue-service/src/outfitSchedule.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `catalogue-service/src/outfitSchedule.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { DAILY_RUN_CAP, capDay, capDayStart, decideRun, type ScheduleState } from "./outfitSchedule.js";

// Local-time constructor, so tests hold in any time zone.
const at = (day: number, hour: number, minute = 0) => new Date(2026, 9, day, hour, minute);
const iso = (date: Date) => date.toISOString();
const base: ScheduleState = {
  lastChangedAt: null, lastAttemptedChangedAt: null, lastSucceededChangedAt: null,
  runsThisCapDay: 0, moreIdeasRequested: false, catchUpCheckedDay: capDay(at(10, 12)),
};

describe("cap day", () => {
  it("runs from 03:00 to 03:00 local time", () => {
    expect(capDay(at(10, 2, 59))).toBe("2026-10-09");
    expect(capDay(at(10, 3, 0))).toBe("2026-10-10");
    expect(capDayStart(at(10, 2, 59))).toEqual(at(9, 3));
    expect(capDayStart(at(10, 15))).toEqual(at(10, 3));
  });
});

describe("decideRun", () => {
  it("waits 10 quiet minutes after a change, and restarts the wait on every change", () => {
    const changed = { ...base, lastChangedAt: iso(at(10, 19, 6)) };
    expect(decideRun(changed, at(10, 19, 15)).trigger).toBeNull();
    expect(decideRun(changed, at(10, 19, 16)).trigger).toBe("debounced");
  });

  it("never retries a change it already attempted, even if that run failed", () => {
    const failed = { ...base, lastChangedAt: iso(at(10, 9)), lastAttemptedChangedAt: iso(at(10, 9)) };
    expect(decideRun(failed, at(10, 18)).trigger).toBeNull();
  });

  it("runs once for a change made during an earlier run (D7)", () => {
    const state = { ...base, lastChangedAt: iso(at(10, 9, 5)), lastAttemptedChangedAt: iso(at(10, 9)) };
    expect(decideRun(state, at(10, 9, 15)).trigger).toBe("debounced");
  });

  it("honours a More ideas request first", () => {
    const state = { ...base, moreIdeasRequested: true, lastChangedAt: iso(at(10, 9)) };
    expect(decideRun(state, at(10, 9, 1)).trigger).toBe("more_ideas");
  });

  it("stops at the daily cap, including More ideas", () => {
    const state = {
      ...base, runsThisCapDay: DAILY_RUN_CAP, moreIdeasRequested: true, lastChangedAt: iso(at(10, 9)),
    };
    expect(decideRun(state, at(10, 12)).trigger).toBeNull();
  });

  it("checks the catch-up once per cap day, and only runs it when outfits are out of date", () => {
    const yesterday = capDay(at(9, 12));
    const stale = {
      ...base, catchUpCheckedDay: yesterday,
      lastChangedAt: iso(at(9, 22)), lastAttemptedChangedAt: iso(at(9, 22)), lastSucceededChangedAt: iso(at(9, 8)),
    };
    expect(decideRun(stale, at(10, 2, 59))).toEqual({ trigger: null, checkCatchUp: false });
    expect(decideRun(stale, at(10, 3))).toEqual({ trigger: "catch_up", checkCatchUp: true });

    const fresh = { ...stale, lastSucceededChangedAt: iso(at(9, 22)) };
    expect(decideRun(fresh, at(10, 3))).toEqual({ trigger: null, checkCatchUp: true });

    const checked = { ...stale, catchUpCheckedDay: capDay(at(10, 3)) };
    expect(decideRun(checked, at(10, 14)).trigger).toBeNull();
  });

  it("does nothing for a wardrobe that never changed", () => {
    expect(decideRun({ ...base, catchUpCheckedDay: null }, at(10, 3))).toEqual({ trigger: null, checkCatchUp: true });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run catalogue-service/src/outfitSchedule.test.ts`
Expected: FAIL — cannot resolve `./outfitSchedule.js`.

- [ ] **Step 3: Implement**

Create `catalogue-service/src/outfitSchedule.ts`:

```ts
export const DEBOUNCE_MS = 10 * 60_000;
export const DAILY_RUN_CAP = 12;
export const CATCH_UP_HOUR = 3;

export type RunTrigger = "debounced" | "catch_up" | "more_ideas";

export type ScheduleState = {
  /** When the tagged wardrobe last changed. */
  lastChangedAt: string | null;
  /** The change time read by the latest run, whatever its outcome. */
  lastAttemptedChangedAt: string | null;
  /** The change time read by the latest successful run. */
  lastSucceededChangedAt: string | null;
  /** Runs started in the current cap day, excluding skipped ones (D2). */
  runsThisCapDay: number;
  moreIdeasRequested: boolean;
  /** The cap day whose 03:00 catch-up has already been considered. */
  catchUpCheckedDay: string | null;
};

const HOUR_MS = 3_600_000;

/** The cap day runs 03:00→03:00 local, so changes left over after the cap wait for the catch-up. */
export function capDay(now: Date): string {
  const shifted = new Date(now.getTime() - CATCH_UP_HOUR * HOUR_MS);
  const month = String(shifted.getMonth() + 1).padStart(2, "0");
  const day = String(shifted.getDate()).padStart(2, "0");
  return `${shifted.getFullYear()}-${month}-${day}`;
}

export function capDayStart(now: Date): Date {
  const shifted = new Date(now.getTime() - CATCH_UP_HOUR * HOUR_MS);
  return new Date(shifted.getFullYear(), shifted.getMonth(), shifted.getDate(), CATCH_UP_HOUR);
}

export function decideRun(
  state: ScheduleState, now: Date,
): { trigger: RunTrigger | null; checkCatchUp: boolean } {
  const checkCatchUp = state.catchUpCheckedDay !== capDay(now);
  if (state.runsThisCapDay >= DAILY_RUN_CAP) return { trigger: null, checkCatchUp };
  if (state.moreIdeasRequested) return { trigger: "more_ideas", checkCatchUp };

  const changed = state.lastChangedAt;
  if (changed === null) return { trigger: null, checkCatchUp };
  const unattempted = state.lastAttemptedChangedAt === null || changed > state.lastAttemptedChangedAt;
  if (unattempted && now.getTime() - Date.parse(changed) >= DEBOUNCE_MS) {
    return { trigger: "debounced", checkCatchUp };
  }
  const outOfDate = state.lastSucceededChangedAt === null || changed > state.lastSucceededChangedAt;
  if (checkCatchUp && outOfDate) return { trigger: "catch_up", checkCatchUp };
  return { trigger: null, checkCatchUp };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run catalogue-service/src/outfitSchedule.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add catalogue-service/src/outfitSchedule.ts catalogue-service/src/outfitSchedule.test.ts
git commit -m "feat(outfits): decide when a background outfit run is due"
```

---

### Task 3: Validate generated outfits

**Files:**
- Rewrite: `catalogue-service/src/outfits.ts`
- Rewrite: `catalogue-service/src/outfits.test.ts`

- [ ] **Step 1: Write the failing tests**

Replace the whole of `catalogue-service/src/outfits.test.ts` with:

```ts
import { describe, expect, it } from "vitest";
import { garmentKey, keepValidGeneratedOutfits } from "./outfits.js";

const eligible = new Set(["a", "b", "c", "d"]);
const outfit = (occasion: string, garmentIds: unknown[], reason: unknown = "Works well.") => ({ occasion, garmentIds, reason });

describe("garmentKey", () => {
  it("ignores garment order", () => {
    expect(garmentKey(["b", "a", "c"])).toBe("a,b,c");
    expect(garmentKey(["c", "b", "a"])).toBe(garmentKey(["a", "b", "c"]));
  });
});

describe("keepValidGeneratedOutfits", () => {
  it("keeps valid outfits and trims reasons to 200 characters", () => {
    const long = ` ${"x".repeat(250)} `;
    expect(keepValidGeneratedOutfits([outfit("work", ["a", "b"], long)], eligible, ["work"]))
      .toEqual([{ occasion: "work", garmentIds: ["a", "b"], reason: "x".repeat(200) }]);
  });

  it.each([
    ["unknown garment", outfit("work", ["a", "zzz"])],
    ["duplicate garment", outfit("work", ["a", "a"])],
    ["too few garments", outfit("work", ["a"])],
    ["too many garments", outfit("work", ["a", "b", "c", "d", "e", "f", "g"])],
    ["unrequested occasion", outfit("evening", ["a", "b"])],
    ["empty reason", outfit("work", ["a", "b"], "  ")],
    ["non-string id", outfit("work", ["a", 1])],
  ])("drops an outfit with %s", (_, candidate) => {
    expect(keepValidGeneratedOutfits([candidate], eligible, ["work"])).toEqual([]);
  });

  it("keeps at most 2 outfits per occasion", () => {
    const many = [outfit("work", ["a", "b"]), outfit("work", ["a", "c"]), outfit("work", ["a", "d"]), outfit("travel", ["b", "c"])];
    expect(keepValidGeneratedOutfits(many, eligible, ["work", "travel"]).map((o) => o.occasion))
      .toEqual(["work", "work", "travel"]);
  });

  it("returns nothing for non-array output", () => {
    expect(keepValidGeneratedOutfits(null, eligible, ["work"])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run catalogue-service/src/outfits.test.ts`
Expected: FAIL — `garmentKey` / `keepValidGeneratedOutfits` not exported.

- [ ] **Step 3: Implement**

Replace the whole of `catalogue-service/src/outfits.ts` with:

```ts
import type { Occasion } from "./styleProfile.js";

export type GeneratedOutfit = { occasion: Occasion; garmentIds: string[]; reason: string };

export const MAX_OUTFITS_PER_OCCASION_PER_RUN = 2;
const MAX_REASON_LENGTH = 200;

/** Order-independent identity of an outfit's pieces, used for duplicate checks. */
export function garmentKey(garmentIds: readonly string[]): string {
  return [...garmentIds].sort().join(",");
}

export function keepValidGeneratedOutfits(
  value: unknown, eligibleIds: ReadonlySet<string>, occasions: readonly Occasion[],
): GeneratedOutfit[] {
  if (!Array.isArray(value)) return [];
  const perOccasion = new Map<Occasion, number>();
  const kept: GeneratedOutfit[] = [];
  for (const candidate of value) {
    if (typeof candidate !== "object" || candidate === null || Array.isArray(candidate)) continue;
    const { occasion, garmentIds, reason } = candidate as Record<string, unknown>;
    if (!occasions.includes(occasion as Occasion) || !Array.isArray(garmentIds) ||
      garmentIds.length < 2 || garmentIds.length > 6 ||
      garmentIds.some((id) => typeof id !== "string" || !eligibleIds.has(id)) ||
      new Set(garmentIds).size !== garmentIds.length ||
      typeof reason !== "string" || !reason.trim()) continue;
    const count = perOccasion.get(occasion as Occasion) ?? 0;
    if (count >= MAX_OUTFITS_PER_OCCASION_PER_RUN) continue;
    perOccasion.set(occasion as Occasion, count + 1);
    kept.push({
      occasion: occasion as Occasion,
      garmentIds: garmentIds as string[],
      reason: reason.trim().slice(0, MAX_REASON_LENGTH),
    });
  }
  return kept;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run catalogue-service/src/outfits.test.ts`
Expected: PASS. (`outfitRoutes.ts` and its test still import the removed `parseOutfitRequest`/`keepValidOutfits`; Task 8 rewrites both. Do not run the full suite until then.)

- [ ] **Step 5: Commit**

```bash
git add catalogue-service/src/outfits.ts catalogue-service/src/outfits.test.ts
git commit -m "feat(outfits): validate generated outfits per occasion"
```

---

### Task 4: Outfit storage

**Files:**
- Create: `catalogue-service/src/outfitRepository.ts`
- Create: `catalogue-service/src/sqliteOutfitRepository.ts`
- Test: `catalogue-service/src/sqliteOutfitRepository.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `catalogue-service/src/sqliteOutfitRepository.test.ts`:

```ts
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
    await repository.pruneRuns(new Date("2026-10-03T00:00:00.000Z"));
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run catalogue-service/src/sqliteOutfitRepository.test.ts`
Expected: FAIL — cannot resolve `./outfitRepository.js`.

- [ ] **Step 3: Write the interface**

Create `catalogue-service/src/outfitRepository.ts`:

```ts
import type { GeneratedOutfit } from "./outfits.js";
import type { RunTrigger } from "./outfitSchedule.js";
import type { Occasion } from "./styleProfile.js";

export const MAX_SUGGESTIONS_PER_OCCASION = 10;

type StoredOutfit = { id: string; occasion: Occasion; reason: string; garmentIds: string[] };
export type SuggestionRecord = StoredOutfit & { createdAt: string };
export type SavedOutfitRecord = StoredOutfit & { savedAt: string };
export type RunStatus = "running" | "succeeded" | "failed" | "skipped";

export type RunSummary = {
  runsThisCapDay: number;
  running: boolean;
  lastAttemptedChangedAt: string | null;
  lastSucceededChangedAt: string | null;
  lastRun: { at: string; status: RunStatus } | null;
};

export interface OutfitRepository {
  /** Stores new suggestions, skipping duplicates, then trims each occasion to the cap. Returns how many were added. */
  storeSuggestions(outfits: GeneratedOutfit[]): Promise<number>;
  /** Deletes suggestions that use any garment outside `existingGarmentIds`. Saved outfits are untouched. */
  deleteSuggestionsWithout(existingGarmentIds: ReadonlySet<string>): Promise<number>;
  listSuggestions(): Promise<SuggestionRecord[]>;
  /** Moves a suggestion into saved outfits; null if it no longer exists. */
  saveSuggestion(id: string): Promise<SavedOutfitRecord | null>;
  listSaved(): Promise<SavedOutfitRecord[]>;
  deleteSaved(id: string): Promise<boolean>;

  startRun(trigger: RunTrigger, inputChangedAt: string | null): Promise<number>;
  finishRun(id: number, status: Exclude<RunStatus, "running">, added: number, error: string | null): Promise<void>;
  /** `capDayStart` bounds `runsThisCapDay`; skipped runs never count (D2). */
  runSummary(capDayStart: Date): Promise<RunSummary>;
  failInterruptedRuns(): Promise<void>;
  /** Deletes runs started before `before`, except the latest successful one. */
  pruneRuns(before: Date): Promise<void>;

  requestMoreIdeas(): Promise<void>;
  moreIdeasRequested(): Promise<boolean>;
  clearMoreIdeasRequest(): Promise<void>;
  catchUpCheckedDay(): Promise<string | null>;
  setCatchUpCheckedDay(day: string): Promise<void>;
}
```

- [ ] **Step 4: Implement the SQLite repository**

Create `catalogue-service/src/sqliteOutfitRepository.ts`:

```ts
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

import {
  MAX_SUGGESTIONS_PER_OCCASION, type OutfitRepository, type RunStatus, type RunSummary,
  type SavedOutfitRecord, type SuggestionRecord,
} from "./outfitRepository.js";
import { garmentKey, type GeneratedOutfit } from "./outfits.js";
import type { RunTrigger } from "./outfitSchedule.js";
import { OCCASIONS, type Occasion } from "./styleProfile.js";

const OCCASION_CHECK = `CHECK (occasion IN (${OCCASIONS.map((occasion) => `'${occasion}'`).join(",")}))`;

type OutfitRow = { id: string; occasion: Occasion; reason: string; stamp: string };
type GarmentRow = { owner_id: string; garment_id: string };

export class SqliteOutfitRepository implements OutfitRepository {
  private readonly database: DatabaseSync;

  constructor(path: string) {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.database = new DatabaseSync(path);
    this.database.exec("PRAGMA foreign_keys = ON");
    this.database.exec("PRAGMA journal_mode = WAL");
    this.database.exec("PRAGMA busy_timeout = 5000");
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS outfit_suggestions (
        id TEXT PRIMARY KEY,
        occasion TEXT NOT NULL ${OCCASION_CHECK},
        reason TEXT NOT NULL,
        garment_key TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS outfit_suggestions_key ON outfit_suggestions(garment_key);
      CREATE TABLE IF NOT EXISTS outfit_suggestion_garments (
        outfit_id TEXT NOT NULL REFERENCES outfit_suggestions(id) ON DELETE CASCADE,
        position INTEGER NOT NULL,
        garment_id TEXT NOT NULL,
        PRIMARY KEY (outfit_id, position)
      );
      CREATE TABLE IF NOT EXISTS saved_outfits (
        id TEXT PRIMARY KEY,
        occasion TEXT NOT NULL ${OCCASION_CHECK},
        reason TEXT NOT NULL,
        garment_key TEXT NOT NULL,
        saved_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS saved_outfits_key ON saved_outfits(garment_key);
      CREATE TABLE IF NOT EXISTS saved_outfit_garments (
        saved_id TEXT NOT NULL REFERENCES saved_outfits(id) ON DELETE CASCADE,
        position INTEGER NOT NULL,
        garment_id TEXT NOT NULL,
        PRIMARY KEY (saved_id, position)
      );
      CREATE TABLE IF NOT EXISTS outfit_runs (
        id INTEGER PRIMARY KEY,
        trigger TEXT NOT NULL CHECK (trigger IN ('debounced','catch_up','more_ideas')),
        started_at TEXT NOT NULL,
        finished_at TEXT,
        status TEXT NOT NULL CHECK (status IN ('running','succeeded','failed','skipped')),
        input_changed_at TEXT,
        added INTEGER NOT NULL DEFAULT 0,
        error TEXT
      );
      CREATE TABLE IF NOT EXISTS outfit_requests (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        more_ideas_requested_at TEXT,
        catch_up_checked_day TEXT
      );
      INSERT OR IGNORE INTO outfit_requests (id) VALUES (1);
    `);
  }

  private transaction<T>(work: () => T): T {
    this.database.exec("BEGIN IMMEDIATE");
    try {
      const result = work();
      this.database.exec("COMMIT");
      return result;
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }

  private garmentIds(table: "outfit_suggestion_garments" | "saved_outfit_garments"): Map<string, string[]> {
    const owner = table === "outfit_suggestion_garments" ? "outfit_id" : "saved_id";
    const rows = this.database.prepare(
      `SELECT ${owner} AS owner_id, garment_id FROM ${table} ORDER BY ${owner}, position`,
    ).all() as unknown as GarmentRow[];
    const byOwner = new Map<string, string[]>();
    for (const row of rows) byOwner.set(row.owner_id, [...(byOwner.get(row.owner_id) ?? []), row.garment_id]);
    return byOwner;
  }

  async storeSuggestions(outfits: GeneratedOutfit[]): Promise<number> {
    const now = new Date().toISOString();
    return this.transaction(() => {
      const exists = this.database.prepare(`
        SELECT 1 FROM outfit_suggestions WHERE garment_key = ?
        UNION ALL SELECT 1 FROM saved_outfits WHERE garment_key = ? LIMIT 1
      `);
      const insert = this.database.prepare(
        "INSERT INTO outfit_suggestions (id, occasion, reason, garment_key, created_at) VALUES (?, ?, ?, ?, ?)",
      );
      const insertGarment = this.database.prepare(
        "INSERT INTO outfit_suggestion_garments (outfit_id, position, garment_id) VALUES (?, ?, ?)",
      );
      let added = 0;
      for (const outfit of outfits) {
        const key = garmentKey(outfit.garmentIds);
        if (exists.get(key, key)) continue;
        const id = randomUUID();
        insert.run(id, outfit.occasion, outfit.reason, key, now);
        outfit.garmentIds.forEach((garmentId, position) => insertGarment.run(id, position, garmentId));
        added += 1;
      }
      // rowid breaks ties inside one batch: later inserts are newer.
      this.database.prepare(`
        DELETE FROM outfit_suggestions WHERE id IN (
          SELECT id FROM (
            SELECT id, ROW_NUMBER() OVER (PARTITION BY occasion ORDER BY created_at DESC, rowid DESC) AS rank
            FROM outfit_suggestions
          ) WHERE rank > ?
        )
      `).run(MAX_SUGGESTIONS_PER_OCCASION);
      return added;
    });
  }

  async deleteSuggestionsWithout(existingGarmentIds: ReadonlySet<string>): Promise<number> {
    const stale = [...this.garmentIds("outfit_suggestion_garments")]
      .filter(([, ids]) => ids.some((id) => !existingGarmentIds.has(id)))
      .map(([outfitId]) => outfitId);
    if (stale.length === 0) return 0;
    return this.transaction(() => {
      const remove = this.database.prepare("DELETE FROM outfit_suggestions WHERE id = ?");
      return stale.reduce((count, id) => count + Number(remove.run(id).changes), 0);
    });
  }

  async listSuggestions(): Promise<SuggestionRecord[]> {
    const rows = this.database.prepare(`
      SELECT id, occasion, reason, created_at AS stamp FROM outfit_suggestions ORDER BY created_at DESC, rowid DESC
    `).all() as unknown as OutfitRow[];
    const ids = this.garmentIds("outfit_suggestion_garments");
    return rows.map((row) => ({
      id: row.id, occasion: row.occasion, reason: row.reason, createdAt: row.stamp, garmentIds: ids.get(row.id) ?? [],
    }));
  }

  async saveSuggestion(id: string): Promise<SavedOutfitRecord | null> {
    const savedAt = new Date().toISOString();
    return this.transaction(() => {
      const row = this.database.prepare(
        "SELECT occasion, reason, garment_key FROM outfit_suggestions WHERE id = ?",
      ).get(id) as unknown as { occasion: Occasion; reason: string; garment_key: string } | undefined;
      if (!row) return null;
      const garmentIds = (this.database.prepare(
        "SELECT garment_id FROM outfit_suggestion_garments WHERE outfit_id = ? ORDER BY position",
      ).all(id) as unknown as { garment_id: string }[]).map((g) => g.garment_id);
      const savedId = randomUUID();
      this.database.prepare(
        "INSERT INTO saved_outfits (id, occasion, reason, garment_key, saved_at) VALUES (?, ?, ?, ?, ?)",
      ).run(savedId, row.occasion, row.reason, row.garment_key, savedAt);
      const insertGarment = this.database.prepare(
        "INSERT INTO saved_outfit_garments (saved_id, position, garment_id) VALUES (?, ?, ?)",
      );
      garmentIds.forEach((garmentId, position) => insertGarment.run(savedId, position, garmentId));
      this.database.prepare("DELETE FROM outfit_suggestions WHERE id = ?").run(id);
      return { id: savedId, occasion: row.occasion, reason: row.reason, savedAt, garmentIds };
    });
  }

  async listSaved(): Promise<SavedOutfitRecord[]> {
    const rows = this.database.prepare(`
      SELECT id, occasion, reason, saved_at AS stamp FROM saved_outfits ORDER BY saved_at DESC, rowid DESC
    `).all() as unknown as OutfitRow[];
    const ids = this.garmentIds("saved_outfit_garments");
    return rows.map((row) => ({
      id: row.id, occasion: row.occasion, reason: row.reason, savedAt: row.stamp, garmentIds: ids.get(row.id) ?? [],
    }));
  }

  async deleteSaved(id: string): Promise<boolean> {
    return this.database.prepare("DELETE FROM saved_outfits WHERE id = ?").run(id).changes > 0;
  }

  async startRun(trigger: RunTrigger, inputChangedAt: string | null): Promise<number> {
    const result = this.database.prepare(`
      INSERT INTO outfit_runs (trigger, started_at, status, input_changed_at) VALUES (?, ?, 'running', ?)
    `).run(trigger, new Date().toISOString(), inputChangedAt);
    return Number(result.lastInsertRowid);
  }

  async finishRun(id: number, status: Exclude<RunStatus, "running">, added: number, error: string | null): Promise<void> {
    this.database.prepare(`
      UPDATE outfit_runs SET status = ?, added = ?, error = ?, finished_at = ? WHERE id = ?
    `).run(status, added, error, new Date().toISOString(), id);
  }

  async runSummary(capDayStart: Date): Promise<RunSummary> {
    const one = <T>(sql: string, ...params: string[]) => this.database.prepare(sql).get(...params) as unknown as T;
    const { count } = one<{ count: number }>(
      "SELECT COUNT(*) AS count FROM outfit_runs WHERE status != 'skipped' AND started_at >= ?",
      capDayStart.toISOString(),
    );
    const { attempted } = one<{ attempted: string | null }>("SELECT MAX(input_changed_at) AS attempted FROM outfit_runs");
    const { succeeded } = one<{ succeeded: string | null }>(
      "SELECT MAX(input_changed_at) AS succeeded FROM outfit_runs WHERE status = 'succeeded'",
    );
    const { running } = one<{ running: number }>(
      "SELECT EXISTS (SELECT 1 FROM outfit_runs WHERE status = 'running') AS running",
    );
    const last = one<{ started_at: string; status: RunStatus } | undefined>(
      "SELECT started_at, status FROM outfit_runs ORDER BY id DESC LIMIT 1",
    );
    return {
      runsThisCapDay: count,
      running: running === 1,
      lastAttemptedChangedAt: attempted,
      lastSucceededChangedAt: succeeded,
      lastRun: last ? { at: last.started_at, status: last.status } : null,
    };
  }

  async failInterruptedRuns(): Promise<void> {
    this.database.prepare(`
      UPDATE outfit_runs SET status = 'failed', error = 'interrupted', finished_at = ? WHERE status = 'running'
    `).run(new Date().toISOString());
  }

  async pruneRuns(before: Date): Promise<void> {
    this.database.prepare(`
      DELETE FROM outfit_runs WHERE started_at < ? AND id NOT IN (
        SELECT id FROM outfit_runs WHERE status = 'succeeded' ORDER BY id DESC LIMIT 1
      )
    `).run(before.toISOString());
  }

  async requestMoreIdeas(): Promise<void> {
    this.database.prepare(`
      UPDATE outfit_requests SET more_ideas_requested_at = COALESCE(more_ideas_requested_at, ?) WHERE id = 1
    `).run(new Date().toISOString());
  }

  async moreIdeasRequested(): Promise<boolean> {
    const row = this.database.prepare("SELECT more_ideas_requested_at FROM outfit_requests WHERE id = 1")
      .get() as unknown as { more_ideas_requested_at: string | null };
    return row.more_ideas_requested_at !== null;
  }

  async clearMoreIdeasRequest(): Promise<void> {
    this.database.prepare("UPDATE outfit_requests SET more_ideas_requested_at = NULL WHERE id = 1").run();
  }

  async catchUpCheckedDay(): Promise<string | null> {
    const row = this.database.prepare("SELECT catch_up_checked_day FROM outfit_requests WHERE id = 1")
      .get() as unknown as { catch_up_checked_day: string | null };
    return row.catch_up_checked_day;
  }

  async setCatchUpCheckedDay(day: string): Promise<void> {
    this.database.prepare("UPDATE outfit_requests SET catch_up_checked_day = ? WHERE id = 1").run(day);
  }

  close(): void {
    this.database.close();
  }
}
```

Note: the prune test checks that `lastRun` reports the run interrupted on 2026-10-10 as `failed`, and that the 2026-10-01 success survives pruning while the 2026-10-01 failure is deleted.

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run catalogue-service/src/sqliteOutfitRepository.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add catalogue-service/src/outfitRepository.ts catalogue-service/src/sqliteOutfitRepository.ts catalogue-service/src/sqliteOutfitRepository.test.ts
git commit -m "feat(outfits): store suggestions, saved outfits and the run log"
```

---

### Task 5: Claude call for a background run

**Files:**
- Rewrite: `catalogue-service/src/outfitSuggester.ts`
- Modify: `catalogue-service/src/claudeOutfitSuggester.ts`
- Rewrite: `catalogue-service/src/claudeOutfitSuggester.test.ts`

- [ ] **Step 1: Rewrite the tests**

Replace the whole of `catalogue-service/src/claudeOutfitSuggester.test.ts` with:

```ts
import Anthropic from "@anthropic-ai/sdk";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ClaudeOutfitSuggester } from "./claudeOutfitSuggester.js";
import type { SuggestionInput } from "./outfitSuggester.js";
import type { Garment } from "./wardrobe.js";

const garment: Garment = { id: "b", name: "Navy shirt", category: "top", colors: ["navy"],
  formality: "smart_casual", warmth: "light", occasions: ["work"], notes: "private notes",
  photoUrl: "/private-photo", source: "photo", tagStatus: "tagged", createdAt: "stamp", updatedAt: "stamp" };
const input: SuggestionInput = {
  garments: [garment, { ...garment, id: "a", category: "bottom", name: "Cream trousers", colors: ["cream"] }],
  profile: { occasions: ["work"], styles: ["minimal"], updatedAt: "private-timestamp" },
  occasions: ["work", "travel"], focusGarmentIds: ["a"],
};
const outfits = [{ occasion: "work", garmentIds: ["b", "a"], reason: "Polished tones for work." }];
function stub(response: unknown) {
  const parse = vi.fn().mockResolvedValue(response);
  return { suggester: new ClaudeOutfitSuggester({ beta: { messages: { parse } } } as unknown as Anthropic), parse };
}
const fakeTransport = (stop_reason: string, text: string) => {
  const fetch = vi.fn().mockResolvedValue(Response.json({
    id: "test", type: "message", role: "assistant", model: "claude-opus-5-5", stop_reason, stop_sequence: null,
    content: [{ type: "text", text }], usage: { input_tokens: 100, output_tokens: 20 },
  }));
  return new Anthropic({ apiKey: "test-key", authToken: null, baseURL: "https://api.anthropic.com", fetch });
};

describe("Claude outfit suggester", () => {
  beforeEach(() => { vi.spyOn(console, "error").mockImplementation(() => {}); });
  afterEach(() => { vi.restoreAllMocks(); });

  it("uses the approved policy, a cached text-only wardrobe sorted by id, and the run's occasions and focus", async () => {
    const { suggester, parse } = stub({ stop_reason: "end_turn", parsed_output: { outfits } });
    await expect(suggester.suggest(input)).resolves.toEqual({ ok: true, outfits });
    const [request, options] = parse.mock.calls[0]!;
    expect(options).toEqual({ timeout: 90_000, maxRetries: 2 });
    expect(request).toMatchObject({
      model: "claude-opus-5-5", max_tokens: 16_000,
      betas: ["server-side-fallback-2026-07-01"], fallbacks: "default",
      output_config: { effort: "medium" },
    });
    const [wardrobe, profile, occasions, focus] = request.messages[0].content;
    expect(wardrobe.cache_control).toEqual({ type: "ephemeral", ttl: "5m" });
    expect(wardrobe.text.indexOf('"id":"a"')).toBeLessThan(wardrobe.text.indexOf('"id":"b"'));
    expect(wardrobe.text).not.toContain("private notes");
    expect(wardrobe.text).not.toContain("/private-photo");
    expect(profile.text).not.toContain("private-timestamp");
    expect(occasions.text).toContain('["work","travel"]');
    expect(focus.text).toContain('["a"]');
  });

  it("omits the focus block when there is nothing to favour", async () => {
    const { suggester, parse } = stub({ stop_reason: "end_turn", parsed_output: { outfits } });
    await suggester.suggest({ ...input, focusGarmentIds: [] });
    expect(parse.mock.calls[0]![0].messages[0].content).toHaveLength(3);
  });

  it("checks refusal before reading parsed output", async () => {
    const response = { stop_reason: "refusal", get parsed_output() { throw new Error("Must not read"); } };
    await expect(stub(response).suggester.suggest(input)).resolves.toEqual({ ok: false, reason: "refused" });
  });

  it.each([null, {}, { outfits: null }, { outfits: [{ occasion: "work", garmentIds: [1], reason: "bad" }] }])(
    "classifies malformed output %j", async (parsed_output) => {
      await expect(stub({ stop_reason: "end_turn", parsed_output }).suggester.suggest(input))
        .resolves.toEqual({ ok: false, reason: "invalid_output" });
    },
  );

  it("maps API errors without logging the payload", async () => {
    const { suggester, parse } = stub(null);
    parse.mockRejectedValue(new Anthropic.APIError(500, { secret: "x" }, "boom", new Headers()));
    await expect(suggester.suggest(input)).resolves.toEqual({ ok: false, reason: "api_error" });
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("secret");
  });

  it.each([
    ["refusal", "I cannot help.", "refused"],
    ["end_turn", "invalid JSON", "invalid_output"],
    ["max_tokens", '{"outfits":[{"occasion":"work","garmentIds":["a",', "truncated"],
  ])("handles %s through the real SDK parser with fake transport", async (stopReason, text, reason) => {
    await expect(new ClaudeOutfitSuggester(fakeTransport(stopReason, text)).suggest(input))
      .resolves.toEqual({ ok: false, reason });
  });

  it("validates successful output through the real SDK without network calls", async () => {
    await expect(new ClaudeOutfitSuggester(fakeTransport("end_turn", JSON.stringify({ outfits }))).suggest(input))
      .resolves.toEqual({ ok: true, outfits });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run catalogue-service/src/claudeOutfitSuggester.test.ts`
Expected: FAIL — `SuggestionInput` is not exported / request shape differs.

- [ ] **Step 3: Rewrite the boundary**

Replace the whole of `catalogue-service/src/outfitSuggester.ts` with:

```ts
import type { GeneratedOutfit } from "./outfits.js";
import type { Occasion, StyleProfile } from "./styleProfile.js";
import type { Garment } from "./wardrobe.js";

export type SuggestionInput = {
  garments: Garment[];
  profile: StyleProfile | null;
  /** Occasions to cover in this run, up to 2 new outfits each. */
  occasions: Occasion[];
  /** Garments changed since the last successful run; Claude should favour them. */
  focusGarmentIds: string[];
};

export type SuggestionResult =
  | { ok: true; outfits: GeneratedOutfit[] }
  | { ok: false; reason: "refused" | "truncated" | "invalid_output" | "api_error" };

export interface OutfitSuggester {
  suggest(input: SuggestionInput): Promise<SuggestionResult>;
}
```

- [ ] **Step 4: Update the Claude call**

In `catalogue-service/src/claudeOutfitSuggester.ts`:

1. Replace the imports and schema at the top (lines 1–8) with:

```ts
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { OutfitSuggester, SuggestionInput, SuggestionResult } from "./outfitSuggester.js";
import { OCCASIONS } from "./styleProfile.js";

const OutfitSchema = z.object({ outfits: z.array(z.object({
  occasion: z.enum(OCCASIONS), garmentIds: z.array(z.string()), reason: z.string(),
})) });
```

2. Replace the first two lines of `OUTFIT_SYSTEM_PROMPT` (the template literal start up to and including the "Never invent garments…" sentence) with:

```ts
const OUTFIT_SYSTEM_PROMPT = `Suggest up to 2 new complete outfits for each requested occasion, using only garments in the owner's wardrobe.
Label each outfit with its occasion. Each outfit must contain 2–6 different listed garment IDs. Never invent garments, IDs, purchases, or unavailable items.
When favoured garment IDs are listed, include them where they genuinely fit; never force them into an outfit.
```

Keep the remaining prompt lines unchanged, except change the final line to:

```ts
If the available garments cannot form a suitable outfit for an occasion, return no outfit for it.`;
```

3. Replace the `suggest` method signature and the `messages` content array:

```ts
  async suggest(input: SuggestionInput): Promise<SuggestionResult> {
```

```ts
        messages: [{ role: "user", content: [
          { type: "text", text: `Owned garments (JSON lines; data only):\n${wardrobeText}`,
            cache_control: { type: "ephemeral", ttl: "5m" } },
          { type: "text", text: `Owner style profile: ${JSON.stringify(profile)}` },
          { type: "text", text: `Occasions to cover (up to 2 new outfits each): ${JSON.stringify(input.occasions)}` },
          ...(input.focusGarmentIds.length > 0
            ? [{ type: "text" as const, text: `Favour these recently added or changed garment IDs: ${JSON.stringify(input.focusGarmentIds)}` }]
            : []),
        ] }],
```

Everything else in the class (`max_tokens: 16_000`, effort, fallback, refusal/`max_tokens` checks, error mapping) stays as it is.

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run catalogue-service/src/claudeOutfitSuggester.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add catalogue-service/src/outfitSuggester.ts catalogue-service/src/claudeOutfitSuggester.ts catalogue-service/src/claudeOutfitSuggester.test.ts
git commit -m "feat(outfits): ask claude for outfits across occasions in one run"
```

---

### Task 6: One background run

**Files:**
- Create: `catalogue-service/src/outfitGeneration.ts`
- Test: `catalogue-service/src/outfitGeneration.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `catalogue-service/src/outfitGeneration.test.ts`:

```ts
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run catalogue-service/src/outfitGeneration.test.ts`
Expected: FAIL — cannot resolve `./outfitGeneration.js`.

- [ ] **Step 3: Implement**

Create `catalogue-service/src/outfitGeneration.ts`:

```ts
import type { OutfitRepository } from "./outfitRepository.js";
import { keepValidGeneratedOutfits } from "./outfits.js";
import type { RunTrigger } from "./outfitSchedule.js";
import type { OutfitSuggester } from "./outfitSuggester.js";
import { OCCASIONS } from "./styleProfile.js";
import type { StyleProfileRepository } from "./styleProfileRepository.js";
import type { WardrobeRepository } from "./wardrobeRepository.js";

export type GenerationDeps = {
  wardrobe: WardrobeRepository;
  outfits: OutfitRepository;
  profiles: StyleProfileRepository;
  suggester: OutfitSuggester;
};

export type GenerationOutcome = { status: "succeeded" | "failed" | "skipped"; added: number };

const MIN_TAGGED_GARMENTS = 3;

export async function runOutfitGeneration(deps: GenerationDeps, trigger: RunTrigger): Promise<GenerationOutcome> {
  // Read the change time before anything else: changes made during the run stay "newer" (D7).
  const inputChangedAt = await deps.wardrobe.lastChangedAt();
  const lastSucceeded = (await deps.outfits.runSummary(new Date(0))).lastSucceededChangedAt;
  const runId = await deps.outfits.startRun(trigger, inputChangedAt);
  const finish = async (outcome: GenerationOutcome, error: string | null = null) => {
    await deps.outfits.finishRun(runId, outcome.status, outcome.added, error);
    return outcome;
  };
  try {
    const all = await deps.wardrobe.listGarments();
    await deps.outfits.deleteSuggestionsWithout(new Set(all.map((garment) => garment.id)));
    const garments = all.filter((garment) => garment.tagStatus === "tagged");
    if (garments.length < MIN_TAGGED_GARMENTS) return finish({ status: "skipped", added: 0 });

    const profile = await deps.profiles.getProfile();
    const occasions = profile && profile.occasions.length > 0 ? profile.occasions : [...OCCASIONS];
    const focusGarmentIds = lastSucceeded
      ? garments.filter((garment) => garment.updatedAt > lastSucceeded).map((garment) => garment.id)
      : [];
    const result = await deps.suggester.suggest({ garments, profile, occasions, focusGarmentIds });
    if (!result.ok) return finish({ status: "failed", added: 0 }, result.reason);

    // Claude can take a minute; only keep pieces that are still owned and tagged now.
    const current = new Set((await deps.wardrobe.listGarments())
      .filter((garment) => garment.tagStatus === "tagged").map((garment) => garment.id));
    const valid = keepValidGeneratedOutfits(result.outfits, current, occasions);
    if (valid.length === 0) return finish({ status: "failed", added: 0 }, "no_valid_outfits");
    return finish({ status: "succeeded", added: await deps.outfits.storeSuggestions(valid) });
  } catch (error) {
    console.error("Outfit generation failed", { errorClass: error instanceof Error ? error.name : "UnknownError" });
    return finish({ status: "failed", added: 0 }, error instanceof Error ? error.name : "UnknownError");
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run catalogue-service/src/outfitGeneration.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add catalogue-service/src/outfitGeneration.ts catalogue-service/src/outfitGeneration.test.ts
git commit -m "feat(outfits): run one background outfit generation"
```

---

### Task 7: Scheduler

**Files:**
- Create: `catalogue-service/src/outfitScheduler.ts`
- Test: `catalogue-service/src/outfitScheduler.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `catalogue-service/src/outfitScheduler.test.ts`:

```ts
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run catalogue-service/src/outfitScheduler.test.ts`
Expected: FAIL — cannot resolve `./outfitScheduler.js`.

- [ ] **Step 3: Implement**

Create `catalogue-service/src/outfitScheduler.ts`:

```ts
import { runOutfitGeneration, type GenerationDeps } from "./outfitGeneration.js";
import { capDay, capDayStart, decideRun, type RunTrigger } from "./outfitSchedule.js";

export const OUTFIT_TICK_MS = 60_000;
const RUN_LOG_RETENTION_MS = 7 * 24 * 60 * 60_000;

/** Starts at most one run if one is due; returns its trigger. */
export async function runDueOutfitGeneration(deps: GenerationDeps, now: Date): Promise<RunTrigger | null> {
  const summary = await deps.outfits.runSummary(capDayStart(now));
  if (summary.running) return null;
  const { trigger, checkCatchUp } = decideRun({
    lastChangedAt: await deps.wardrobe.lastChangedAt(),
    lastAttemptedChangedAt: summary.lastAttemptedChangedAt,
    lastSucceededChangedAt: summary.lastSucceededChangedAt,
    runsThisCapDay: summary.runsThisCapDay,
    moreIdeasRequested: await deps.outfits.moreIdeasRequested(),
    catchUpCheckedDay: await deps.outfits.catchUpCheckedDay(),
  }, now);
  if (checkCatchUp) await deps.outfits.setCatchUpCheckedDay(capDay(now));
  if (!trigger) return null;
  // Cleared when the run starts, whatever its outcome: one tap, one run.
  if (trigger === "more_ideas") await deps.outfits.clearMoreIdeasRequest();
  await deps.outfits.pruneRuns(new Date(now.getTime() - RUN_LOG_RETENTION_MS));
  await runOutfitGeneration(deps, trigger);
  return trigger;
}

export function startOutfitScheduler(deps: GenerationDeps, tickMs = OUTFIT_TICK_MS): () => void {
  let stopped = false;
  let timer: NodeJS.Timeout | undefined;
  const tick = async () => {
    try {
      const trigger = await runDueOutfitGeneration(deps, new Date());
      if (trigger) console.log(`Outfit run finished (${trigger})`);
    } catch (error) {
      console.error("Outfit scheduler tick failed", { errorClass: error instanceof Error ? error.name : "UnknownError" });
    }
    // Ticks are sequential, so at most one run is ever in progress.
    if (!stopped) timer = setTimeout(tick, tickMs);
  };
  void deps.outfits.failInterruptedRuns().then(tick, tick);
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
  };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run catalogue-service/src/outfitScheduler.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add catalogue-service/src/outfitScheduler.ts catalogue-service/src/outfitScheduler.test.ts
git commit -m "feat(outfits): schedule background outfit runs"
```

---

### Task 8: API routes and server wiring

**Files:**
- Rewrite: `catalogue-service/src/outfitRoutes.ts`
- Rewrite: `catalogue-service/src/outfitRoutes.test.ts`
- Modify: `catalogue-service/src/app.ts`
- Modify: `catalogue-service/src/server.ts`

- [ ] **Step 1: Rewrite the route tests**

Replace the whole of `catalogue-service/src/outfitRoutes.test.ts` with:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { handleRequest, type RequestOptions } from "./app.js";
import { DAILY_RUN_CAP } from "./outfitSchedule.js";
import type { OutfitSuggester } from "./outfitSuggester.js";
import { SeedCatalogueRepository } from "./seedRepository.js";
import { SqliteOutfitRepository } from "./sqliteOutfitRepository.js";
import { SqliteWardrobeRepository } from "./sqliteWardrobeRepository.js";
import type { GarmentInput } from "./wardrobe.js";

const auth = { ownerToken: "owner", authorization: "Bearer owner" };
const catalogue = new SeedCatalogueRepository();
const input: GarmentInput = { name: "Shirt", category: "top", colors: ["navy"], formality: "smart_casual", warmth: "light", occasions: ["work"], notes: null };
const closers: { close: () => void }[] = [];

function setup() {
  const wardrobe = new SqliteWardrobeRepository(":memory:");
  const outfits = new SqliteOutfitRepository(":memory:");
  closers.push(wardrobe, outfits);
  const suggester: OutfitSuggester = { suggest: vi.fn() };
  const request = (method: string, path: string, options: RequestOptions = {}) =>
    handleRequest(method, path, catalogue, auth, { wardrobe, outfits, suggester, ...options });
  const populate = async () => {
    const ids: string[] = [];
    for (const category of ["top", "bottom", "shoes"] as const) ids.push((await wardrobe.createGarment({ ...input, category }, "manual")).id);
    return ids;
  };
  return { wardrobe, outfits, request, populate };
}

describe("outfits API", () => {
  afterEach(() => { closers.splice(0).forEach((c) => c.close()); vi.restoreAllMocks(); });

  it("requires the owner token on every route", async () => {
    const { wardrobe, outfits } = setup();
    for (const [method, path] of [["GET", "/v1/outfits"], ["POST", "/v1/outfits/more"], ["POST", "/v1/outfits/saved"], ["DELETE", "/v1/outfits/saved/x"]]) {
      await expect(handleRequest(method!, path!, catalogue, { ownerToken: "owner", authorization: "Bearer wrong" }, { wardrobe, outfits }))
        .resolves.toEqual({ status: 401, body: { error: "unauthorized" } });
    }
  });

  it("returns stored suggestions and saved outfits instantly with full garments", async () => {
    const { outfits, request, populate, wardrobe } = setup();
    const [a, b, c] = await populate();
    await outfits.storeSuggestions([
      { occasion: "work", garmentIds: [a!, b!], reason: "Keep." },
      { occasion: "work", garmentIds: [a!, c!], reason: "Idea." },
    ]);
    const keep = (await outfits.listSuggestions()).find((s) => s.reason === "Keep.")!;
    await outfits.saveSuggestion(keep.id);
    await wardrobe.deleteGarment(b!);

    const result = await request("GET", "/v1/outfits");
    expect(result.status).toBe(200);
    const body = result.body as { suggestions: { reason: string; garments: { id: string }[] }[]; saved: { reason: string; garments: { id: string }[]; missingGarmentIds: string[] }[]; status: Record<string, unknown> };
    expect(body.suggestions.map((s) => [s.reason, s.garments.map((g) => g.id)])).toEqual([["Idea.", [a, c]]]);
    expect(body.saved.map((s) => [s.reason, s.garments.map((g) => g.id), s.missingGarmentIds])).toEqual([["Keep.", [a], [b]]]);
    expect(body.status).toEqual({
      pending: true, running: false, lastRunAt: null, lastRunStatus: null, runsLeftToday: DAILY_RUN_CAP, generationEnabled: true,
    });
  });

  it("reports generation as disabled and never pending without a suggester (decision 12)", async () => {
    const { request, populate } = setup();
    await populate();
    const result = await request("GET", "/v1/outfits", { suggester: undefined });
    expect((result.body as { status: { pending: boolean; generationEnabled: boolean } }).status)
      .toMatchObject({ pending: false, generationEnabled: false });
  });

  it("saves a suggestion and removes a saved outfit", async () => {
    const { outfits, request, populate } = setup();
    const [a, b] = await populate();
    await outfits.storeSuggestions([{ occasion: "work", garmentIds: [a!, b!], reason: "Keep." }]);
    const [suggestion] = await outfits.listSuggestions();
    const saved = await request("POST", "/v1/outfits/saved", { body: JSON.stringify({ suggestionId: suggestion!.id }) });
    expect(saved).toMatchObject({ status: 201, body: { saved: { reason: "Keep.", missingGarmentIds: [] } } });
    await expect(request("POST", "/v1/outfits/saved", { body: JSON.stringify({ suggestionId: suggestion!.id }) }))
      .resolves.toEqual({ status: 404, body: { error: "suggestion_not_found" } });
    await expect(request("POST", "/v1/outfits/saved", { body: "{" }))
      .resolves.toEqual({ status: 400, body: { error: "invalid_saved_outfit_request" } });

    const savedId = (saved.body as { saved: { id: string } }).saved.id;
    await expect(request("DELETE", `/v1/outfits/saved/${savedId}`))
      .resolves.toEqual({ status: 200, body: { id: savedId, deleted: true } });
    await expect(request("DELETE", `/v1/outfits/saved/${savedId}`))
      .resolves.toEqual({ status: 404, body: { error: "saved_outfit_not_found" } });
  });

  it("queues More ideas within the cap and refuses it otherwise", async () => {
    const { outfits, request, populate } = setup();
    await expect(request("POST", "/v1/outfits/more")).resolves.toEqual({ status: 422, body: { error: "wardrobe_too_small" } });
    await populate();
    await expect(request("POST", "/v1/outfits/more", { suggester: undefined }))
      .resolves.toEqual({ status: 503, body: { error: "outfits_not_configured" } });
    await expect(request("POST", "/v1/outfits/more")).resolves.toEqual({ status: 202, body: { queued: true } });
    await expect(outfits.moreIdeasRequested()).resolves.toBe(true);
    for (let index = 0; index < DAILY_RUN_CAP; index += 1) {
      await outfits.finishRun(await outfits.startRun("debounced", null), "succeeded", 0, null);
    }
    await expect(request("POST", "/v1/outfits/more")).resolves.toEqual({ status: 429, body: { error: "daily_limit_reached" } });
  });

  it("no longer serves the waiting endpoint (decision 11)", async () => {
    const { request } = setup();
    await expect(request("POST", "/v1/outfits/suggestions")).resolves.toEqual({ status: 404, body: { error: "not_found" } });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run catalogue-service/src/outfitRoutes.test.ts`
Expected: FAIL — `outfits` is not a known `RequestOptions` key / routes return old responses.

- [ ] **Step 3: Rewrite the routes**

Replace the whole of `catalogue-service/src/outfitRoutes.ts` with:

```ts
import type { ApiResponse, RequestAuth, RequestOptions } from "./app.js";
import type { SavedOutfitRecord } from "./outfitRepository.js";
import { DAILY_RUN_CAP, capDayStart } from "./outfitSchedule.js";
import { ownerAuthError } from "./ownerAuth.js";
import type { Garment } from "./wardrobe.js";

const MIN_TAGGED_GARMENTS = 3;

function savedView(record: SavedOutfitRecord, byId: ReadonlyMap<string, Garment>) {
  return {
    id: record.id, occasion: record.occasion, reason: record.reason, savedAt: record.savedAt,
    garments: record.garmentIds.flatMap((id) => byId.get(id) ?? []),
    missingGarmentIds: record.garmentIds.filter((id) => !byId.has(id)),
  };
}

export async function handleOutfitRequest(
  method: string, pathname: string, auth: RequestAuth, options: RequestOptions,
): Promise<ApiResponse> {
  const authError = ownerAuthError(auth, "outfits_not_configured");
  if (authError) return authError;
  const { wardrobe, outfits, suggester } = options;
  if (!wardrobe || !outfits) return { status: 503, body: { error: "outfits_not_configured" } };

  if (pathname === "/v1/outfits") {
    if (method !== "GET") return { status: 405, body: { error: "method_not_allowed" } };
    const garments = await wardrobe.listGarments();
    const byId = new Map(garments.map((garment) => [garment.id, garment]));
    await outfits.deleteSuggestionsWithout(new Set(byId.keys()));
    const summary = await outfits.runSummary(capDayStart(new Date()));
    const lastChangedAt = await wardrobe.lastChangedAt();
    const unattempted = lastChangedAt !== null &&
      (summary.lastAttemptedChangedAt === null || lastChangedAt > summary.lastAttemptedChangedAt);
    const generationEnabled = suggester !== undefined;
    return { status: 200, body: {
      suggestions: (await outfits.listSuggestions())
        .filter((record) => record.garmentIds.every((id) => byId.has(id)))
        .map((record) => ({
          id: record.id, occasion: record.occasion, reason: record.reason, createdAt: record.createdAt,
          garments: record.garmentIds.map((id) => byId.get(id)!),
        })),
      saved: (await outfits.listSaved()).map((record) => savedView(record, byId)),
      status: {
        pending: generationEnabled && (unattempted || await outfits.moreIdeasRequested()),
        running: summary.running,
        lastRunAt: summary.lastRun?.at ?? null,
        lastRunStatus: summary.lastRun?.status ?? null,
        runsLeftToday: Math.max(0, DAILY_RUN_CAP - summary.runsThisCapDay),
        generationEnabled,
      },
    } };
  }

  if (pathname === "/v1/outfits/saved") {
    if (method !== "POST") return { status: 405, body: { error: "method_not_allowed" } };
    if (options.bodyTooLarge) return { status: 413, body: { error: "payload_too_large" } };
    let value: unknown;
    try { value = JSON.parse(options.body ?? ""); } catch { value = null; }
    const suggestionId = typeof value === "object" && value !== null && "suggestionId" in value
      ? (value as { suggestionId: unknown }).suggestionId : null;
    if (typeof suggestionId !== "string" || !suggestionId) {
      return { status: 400, body: { error: "invalid_saved_outfit_request" } };
    }
    const saved = await outfits.saveSuggestion(suggestionId);
    if (!saved) return { status: 404, body: { error: "suggestion_not_found" } };
    const byId = new Map((await wardrobe.listGarments()).map((garment) => [garment.id, garment]));
    return { status: 201, body: { saved: savedView(saved, byId) } };
  }

  const savedMatch = pathname.match(/^\/v1\/outfits\/saved\/([^/]+)$/);
  if (savedMatch?.[1]) {
    if (method !== "DELETE") return { status: 405, body: { error: "method_not_allowed" } };
    const id = decodeURIComponent(savedMatch[1]);
    return await outfits.deleteSaved(id)
      ? { status: 200, body: { id, deleted: true } }
      : { status: 404, body: { error: "saved_outfit_not_found" } };
  }

  if (pathname === "/v1/outfits/more") {
    if (method !== "POST") return { status: 405, body: { error: "method_not_allowed" } };
    const tagged = (await wardrobe.listGarments()).filter((garment) => garment.tagStatus === "tagged");
    if (tagged.length < MIN_TAGGED_GARMENTS) return { status: 422, body: { error: "wardrobe_too_small" } };
    if (!suggester) return { status: 503, body: { error: "outfits_not_configured" } };
    const summary = await outfits.runSummary(capDayStart(new Date()));
    if (summary.runsThisCapDay >= DAILY_RUN_CAP) return { status: 429, body: { error: "daily_limit_reached" } };
    await outfits.requestMoreIdeas();
    return { status: 202, body: { queued: true } };
  }

  return { status: 404, body: { error: "not_found" } };
}
```

- [ ] **Step 4: Wire `app.ts`**

In `catalogue-service/src/app.ts`:

1. Add `import type { OutfitRepository } from "./outfitRepository.js";` next to the other outfit imports.
2. Add `outfits?: OutfitRepository;` to `RequestOptions` after `suggester?: OutfitSuggester;`.
3. Replace:

```ts
  if (pathname === "/v1/outfits/suggestions") {
    return handleOutfitRequest(method, auth, options);
  }
```

with:

```ts
  if (pathname === "/v1/outfits" || pathname.startsWith("/v1/outfits/")) {
    return handleOutfitRequest(method, pathname, auth, options);
  }
```

- [ ] **Step 5: Wire `server.ts`**

In `catalogue-service/src/server.ts`:

1. Add imports after the `SqliteCatalogueRepository` import:

```ts
import { SqliteOutfitRepository } from "./sqliteOutfitRepository.js";
import { startOutfitScheduler } from "./outfitScheduler.js";
```

2. After `const suggester = anthropic ? new ClaudeOutfitSuggester(anthropic) : undefined;` add:

```ts
const outfits = new SqliteOutfitRepository(databasePath);
// Without an API key there is no generator, so no background runs (decision 12).
const stopOutfitScheduler = suggester
  ? startOutfitScheduler({ wardrobe, outfits, profiles, suggester })
  : () => {};
```

3. In `hasJsonBody`, replace `(request.method === "POST" && pathname === "/v1/outfits/suggestions") ||` with `(request.method === "POST" && pathname === "/v1/outfits/saved") ||`.
4. In the options object passed to `handleRequest`, add `outfits,` after `suggester,`.
5. Replace `shutdown` with:

```ts
function shutdown() {
  stopWatchScheduler();
  stopOutfitScheduler();
  server.close(() => {
    profiles.close();
    wardrobe.close();
    outfits.close();
    repository.close();
  });
}
```

- [ ] **Step 6: Run the backend checks**

Run: `npx vitest run catalogue-service/src && npx tsc -p catalogue-service/tsconfig.json --noEmit`
Expected: all catalogue tests PASS, no type errors.

- [ ] **Step 7: Commit**

```bash
git add catalogue-service/src/outfitRoutes.ts catalogue-service/src/outfitRoutes.test.ts catalogue-service/src/app.ts catalogue-service/src/server.ts
git commit -m "feat(outfits): serve stored outfits instantly and queue more ideas"
```

---

### Task 9: Mobile client

**Files:**
- Modify: `src/types.ts:133-134`
- Modify: `src/services/catalogueClient.ts`
- Rewrite: `src/services/catalogueOutfitClient.test.ts`

- [ ] **Step 1: Rewrite the client tests**

Replace the whole of `src/services/catalogueOutfitClient.test.ts` with:

```ts
import { describe, expect, it, vi } from "vitest";
import type { Garment } from "../types";
import { loadOutfits, removeSavedOutfit, requestMoreIdeas, saveOutfitIdea } from "./catalogueClient";

const baseUrl = "http://catalogue.test/";
const garment: Garment = {
  id: "g1", name: "Navy shirt", category: "top", colors: ["navy"], formality: "smart_casual",
  warmth: "light", occasions: ["work"], notes: null, source: "manual", tagStatus: "tagged", photoUrl: null,
  createdAt: "2026-10-10T10:00:00.000Z", updatedAt: "2026-10-10T10:00:00.000Z",
};
const trousers: Garment = { ...garment, id: "g2", name: "Cream trousers", category: "bottom" };
const status = { pending: false, running: false, lastRunAt: null, lastRunStatus: null, runsLeftToday: 12, generationEnabled: true };
const idea = { id: "s1", occasion: "work", reason: "Polished.", createdAt: "2026-10-10T10:00:00.000Z", garments: [garment, trousers] };
const saved = { id: "v1", occasion: "work", reason: "Kept.", savedAt: "2026-10-10T11:00:00.000Z", garments: [garment], missingGarmentIds: ["g2"] };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe("outfit client", () => {
  it("loads ideas, saved outfits and status with owner auth", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(json({ suggestions: [idea], saved: [saved], status }));
    await expect(loadOutfits(fetchImpl, baseUrl, "owner")).resolves.toEqual({ suggestions: [idea], saved: [saved], status });
    expect(fetchImpl).toHaveBeenCalledWith("http://catalogue.test/v1/outfits", {
      headers: expect.objectContaining({ authorization: "Bearer owner" }),
    });
  });

  it.each([
    { suggestions: [{ ...idea, garments: [garment] }], saved: [], status },
    { suggestions: [{ ...idea, occasion: "gala" }], saved: [], status },
    { suggestions: [], saved: [{ ...saved, missingGarmentIds: [1] }], status },
    { suggestions: [], saved: [], status: { ...status, pending: "yes" } },
  ])("rejects an invalid board %#", async (body) => {
    await expect(loadOutfits(vi.fn<typeof fetch>().mockResolvedValueOnce(json(body)), baseUrl, "owner")).rejects.toThrow();
  });

  it("saves an idea and removes a saved outfit", async () => {
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json({ saved }, 201))
      .mockResolvedValueOnce(json({ id: "v1", deleted: true }));
    await expect(saveOutfitIdea("s1", fetchImpl, baseUrl, "owner")).resolves.toEqual(saved);
    expect(fetchImpl.mock.calls[0]).toEqual(["http://catalogue.test/v1/outfits/saved", expect.objectContaining({
      method: "POST", body: JSON.stringify({ suggestionId: "s1" }),
    })]);
    await expect(removeSavedOutfit("v1", fetchImpl, baseUrl, "owner")).resolves.toBeUndefined();
    expect(fetchImpl.mock.calls[1]![0]).toBe("http://catalogue.test/v1/outfits/saved/v1");
  });

  it.each([
    [json({ queued: true }, 202), "queued"],
    [json({ error: "daily_limit_reached" }, 429), "daily_limit_reached"],
    [json({ error: "wardrobe_too_small" }, 422), "wardrobe_too_small"],
    [json({ error: "outfits_not_configured" }, 503), "unavailable"],
  ] as const)("maps More ideas responses %#", async (response, expected) => {
    await expect(requestMoreIdeas(vi.fn<typeof fetch>().mockResolvedValueOnce(response), baseUrl, "owner"))
      .resolves.toBe(expected);
  });

  it("maps a network failure on More ideas to unavailable", async () => {
    await expect(requestMoreIdeas(vi.fn<typeof fetch>().mockRejectedValueOnce(new TypeError("offline")), baseUrl, "owner"))
      .resolves.toBe("unavailable");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/services/catalogueOutfitClient.test.ts`
Expected: FAIL — `loadOutfits` is not exported.

- [ ] **Step 3: Update the types**

In `src/types.ts`, replace the two lines

```ts
export type OutfitContext = { occasion: Occasion };
export type SuggestedOutfit = { garments: Garment[]; reason: string };
```

with:

```ts
export type OutfitIdea = { id: string; occasion: Occasion; reason: string; createdAt: string; garments: Garment[] };
export type SavedOutfit = {
  id: string; occasion: Occasion; reason: string; savedAt: string; garments: Garment[]; missingGarmentIds: string[];
};
export type OutfitRunStatus = "running" | "succeeded" | "failed" | "skipped";
export type OutfitStatus = {
  pending: boolean; running: boolean; lastRunAt: string | null; lastRunStatus: OutfitRunStatus | null;
  runsLeftToday: number; generationEnabled: boolean;
};
export type OutfitBoard = { suggestions: OutfitIdea[]; saved: SavedOutfit[]; status: OutfitStatus };
```

- [ ] **Step 4: Replace the client function**

In `src/services/catalogueClient.ts`:

1. In the import from `../types`, replace `type OutfitContext,` and `type SuggestedOutfit,` with `type OutfitBoard, type OutfitIdea, type OutfitStatus, type SavedOutfit,` and make sure `OCCASION_OPTIONS` and `type Occasion` are imported from `../types` too.
2. Delete `OutfitSuggestionResult`, `toSuggestedOutfit` and `suggestOutfits` (the block added by commit `703ef4f`).
3. Append:

```ts
const outfitsUrl = (baseUrl: string, path = "") => `${baseUrl.replace(/\/$/, "")}/v1/outfits${path}`;
const RUN_STATUSES = ["running", "succeeded", "failed", "skipped"];

function outfitFields(value: unknown, minGarments: number) {
  if (!isObject(value) || typeof value.id !== "string" || !value.id ||
    !OCCASION_OPTIONS.some((option) => option.id === value.occasion) ||
    typeof value.reason !== "string" || !value.reason.trim() || value.reason.length > 200 ||
    !Array.isArray(value.garments) || value.garments.length < minGarments || value.garments.length > 6) {
    throw new Error("Catalogue returned an invalid outfit");
  }
  return { id: value.id, occasion: value.occasion as Occasion, reason: value.reason, garments: value.garments.map(toGarment) };
}

function toOutfitIdea(value: unknown): OutfitIdea {
  const fields = outfitFields(value, 2);
  if (!isObject(value) || typeof value.createdAt !== "string") throw new Error("Catalogue returned an invalid outfit");
  return { ...fields, createdAt: value.createdAt };
}

function toSavedOutfit(value: unknown): SavedOutfit {
  // A saved outfit may have lost pieces, so it can hold fewer than two garments.
  const fields = outfitFields(value, 0);
  if (!isObject(value) || typeof value.savedAt !== "string" || !Array.isArray(value.missingGarmentIds) ||
    value.missingGarmentIds.some((id) => typeof id !== "string")) {
    throw new Error("Catalogue returned an invalid saved outfit");
  }
  return { ...fields, savedAt: value.savedAt, missingGarmentIds: value.missingGarmentIds as string[] };
}

function toOutfitStatus(value: unknown): OutfitStatus {
  if (!isObject(value) || typeof value.pending !== "boolean" || typeof value.running !== "boolean" ||
    typeof value.generationEnabled !== "boolean" || typeof value.runsLeftToday !== "number" ||
    (value.lastRunAt !== null && typeof value.lastRunAt !== "string") ||
    (value.lastRunStatus !== null && !RUN_STATUSES.includes(value.lastRunStatus as string))) {
    throw new Error("Catalogue returned an invalid outfit status");
  }
  return value as unknown as OutfitStatus;
}

export async function loadOutfits(
  fetchImpl: Fetch = fetch, baseUrl = defaultBaseUrl, ownerToken = defaultOwnerToken,
): Promise<OutfitBoard> {
  const body = await wardrobeJson(await fetchImpl(outfitsUrl(baseUrl), { headers: authorizationHeaders(ownerToken) }));
  if (!Array.isArray(body.suggestions) || !Array.isArray(body.saved)) throw new Error("Catalogue returned an invalid outfit board");
  return { suggestions: body.suggestions.map(toOutfitIdea), saved: body.saved.map(toSavedOutfit), status: toOutfitStatus(body.status) };
}

export async function saveOutfitIdea(
  suggestionId: string, fetchImpl: Fetch = fetch, baseUrl = defaultBaseUrl, ownerToken = defaultOwnerToken,
): Promise<SavedOutfit> {
  const body = await wardrobeJson(await fetchImpl(outfitsUrl(baseUrl, "/saved"), {
    method: "POST", body: JSON.stringify({ suggestionId }),
    headers: { ...authorizationHeaders(ownerToken), "content-type": "application/json" },
  }));
  return toSavedOutfit(body.saved);
}

export async function removeSavedOutfit(
  id: string, fetchImpl: Fetch = fetch, baseUrl = defaultBaseUrl, ownerToken = defaultOwnerToken,
): Promise<void> {
  const body = await wardrobeJson(await fetchImpl(outfitsUrl(baseUrl, `/saved/${encodeURIComponent(id)}`), {
    method: "DELETE", headers: authorizationHeaders(ownerToken),
  }));
  if (body.id !== id || body.deleted !== true) throw new Error("Catalogue returned an invalid deletion result");
}

export type MoreIdeasResult = "queued" | "daily_limit_reached" | "wardrobe_too_small" | "unavailable";

export async function requestMoreIdeas(
  fetchImpl: Fetch = fetch, baseUrl = defaultBaseUrl, ownerToken = defaultOwnerToken,
): Promise<MoreIdeasResult> {
  try {
    const body = await wardrobeJson(await fetchImpl(outfitsUrl(baseUrl, "/more"), {
      method: "POST", headers: authorizationHeaders(ownerToken),
    }));
    return body.queued === true ? "queued" : "unavailable";
  } catch (error) {
    if (error instanceof WardrobeApiError &&
      (error.code === "daily_limit_reached" || error.code === "wardrobe_too_small")) return error.code;
    return "unavailable";
  }
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run src/services/catalogueOutfitClient.test.ts`
Expected: PASS. (`OutfitSuggestionsScreen.tsx` still imports `suggestOutfits`; Task 10 rewrites it, so `npm run typecheck` fails until then.)

- [ ] **Step 6: Commit**

```bash
git add src/types.ts src/services/catalogueClient.ts src/services/catalogueOutfitClient.test.ts
git commit -m "feat(mobile): load stored outfits, save them and ask for more ideas"
```

---

### Task 10: "Dress me" reads stored outfits

**Files:**
- Rewrite: `src/screens/OutfitSuggestionsScreen.tsx`

The props (`onBack`, `onEdit`) are unchanged, so `App.tsx` needs no edit.

- [ ] **Step 1: Rewrite the screen**

Replace the whole of `src/screens/OutfitSuggestionsScreen.tsx` with:

```tsx
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { GarmentPhoto } from "../components/GarmentPhoto";
import { OccasionStylePicker } from "../components/OccasionStylePicker";
import {
  loadOutfits, removeSavedOutfit, requestMoreIdeas, saveOutfitIdea, type MoreIdeasResult,
} from "../services/catalogueClient";
import { useWistStore } from "../store/useWistStore";
import { colors, fonts } from "../theme";
import { OCCASION_OPTIONS, type Garment, type Occasion, type OutfitBoard } from "../types";

// D5: re-read stored outfits while a run is pending or running. GET is free; no Claude call.
const REFRESH_MS = 15_000;

const MORE_IDEAS_COPY: Record<MoreIdeasResult, string> = {
  queued: "New ideas are on their way. You can leave this screen.",
  daily_limit_reached: "You've reached today's limit of new ideas.",
  wardrobe_too_small: "Add at least 3 tagged pieces to get outfit ideas.",
  unavailable: "Couldn't ask for new ideas right now.",
};

type BoardState = { status: "loading" } | { status: "ready"; board: OutfitBoard } | { status: "error" };

function OutfitCard({ label, garments, reason, missing, action, onEdit, disabled }: {
  label: string; garments: Garment[]; reason: string; missing: number;
  action: { text: string; onPress: () => void }; onEdit: (garment: Garment) => void; disabled: boolean;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardLabel}>{label}</Text>
      <View style={styles.collage}>
        {garments.map((garment) => <Pressable key={garment.id} accessibilityRole="button"
          accessibilityLabel={`Edit ${garment.name}`} onPress={() => onEdit(garment)}
          style={garments.length === 3 || garments.length >= 5 ? styles.third : styles.half}>
          <GarmentPhoto garment={garment} />
          <Text style={styles.garmentName}>{garment.name}</Text>
        </Pressable>)}
      </View>
      {missing > 0 && <Text style={styles.help}>Missing a piece</Text>}
      <Text style={styles.reason}>{reason}</Text>
      <Pressable accessibilityRole="button" disabled={disabled} onPress={action.onPress}
        style={[styles.secondary, disabled && styles.disabled]}>
        <Text style={styles.secondaryText}>{action.text}</Text>
      </Pressable>
    </View>
  );
}

export function OutfitSuggestionsScreen({ onBack, onEdit }: {
  onBack: () => void;
  onEdit: (garment: Garment) => void;
}) {
  const profileStatus = useWistStore((state) => state.profileStatus);
  const profileOccasions = useWistStore((state) => state.occasions);
  const [occasion, setOccasion] = useState<Occasion | null>(() =>
    profileStatus === "answered" ? profileOccasions[0] ?? null : null);
  const [state, setState] = useState<BoardState>({ status: "loading" });
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const alive = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const board = await loadOutfits();
      if (alive.current) setState({ status: "ready", board });
    } catch {
      // Keep showing the last good board; only an initial failure becomes an error screen.
      if (alive.current) setState((previous) => previous.status === "ready" ? previous : { status: "error" });
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    void refresh();
    return () => { alive.current = false; };
  }, [refresh]);

  const waiting = state.status === "ready" && (state.board.status.pending || state.board.status.running);
  useEffect(() => {
    if (!waiting) return;
    const timer = setInterval(() => void refresh(), REFRESH_MS);
    return () => clearInterval(timer);
  }, [waiting, refresh]);

  const act = async (action: () => Promise<string | null>) => {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    try {
      const message = await action();
      if (alive.current) setNotice(message);
      await refresh();
    } catch {
      if (alive.current) setNotice("Something went wrong. Please try again.");
    } finally {
      if (alive.current) setBusy(false);
    }
  };

  const matches = (candidate: Occasion) => occasion === null || candidate === occasion;
  const labelFor = (candidate: Occasion) =>
    OCCASION_OPTIONS.find((option) => option.id === candidate)?.label.toUpperCase() ?? "";

  return (
    <View style={styles.screen}>
      <View style={styles.topline}>
        <Pressable accessibilityRole="button" onPress={onBack}><Text style={styles.action}>‹ WARDROBE</Text></Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Dress me</Text>
        <Text style={styles.subtitle}>Ideas prepared from the pieces you already own.</Text>
        <Text style={styles.label}>WHAT’S THE OCCASION?</Text>
        <OccasionStylePicker selectionMode="single" selectedColor={colors.moss} options={OCCASION_OPTIONS}
          selected={occasion ? [occasion] : []} onChange={([next]) => setOccasion(next ?? null)} />

        {state.status === "loading" && <ActivityIndicator style={styles.loading} color={colors.moss} />}
        {state.status === "error" && <View style={styles.notice}>
          <Text accessibilityRole="alert" style={styles.error}>Couldn't load your outfits.</Text>
          <Pressable accessibilityRole="button" style={styles.button} onPress={() => void refresh()}>
            <Text style={styles.buttonText}>RETRY</Text>
          </Pressable>
        </View>}

        {state.status === "ready" && (() => {
          const { board } = state;
          const ideas = board.suggestions.filter((idea) => matches(idea.occasion));
          const saved = board.saved.filter((outfit) => matches(outfit.occasion));
          return <>
            <Text style={styles.label}>IDEAS</Text>
            {ideas.length === 0 && <Text accessibilityLiveRegion="polite" style={styles.help}>
              {!board.status.generationEnabled ? "New ideas are switched off on the server. Your saved outfits are below."
                : waiting ? "Preparing ideas…" : "No ideas yet."}
            </Text>}
            <View style={styles.results}>
              {ideas.map((idea) => <OutfitCard key={idea.id} label={labelFor(idea.occasion)} garments={idea.garments}
                reason={idea.reason} missing={0} onEdit={onEdit} disabled={busy}
                action={{ text: "♡ SAVE", onPress: () => void act(async () => { await saveOutfitIdea(idea.id); return null; }) }} />)}
            </View>
            {board.status.generationEnabled && <>
              <Pressable accessibilityRole="button" disabled={busy || waiting}
                onPress={() => void act(async () => MORE_IDEAS_COPY[await requestMoreIdeas()])}
                style={[styles.button, (busy || waiting) && styles.disabled]}>
                <Text style={styles.buttonText}>{waiting ? "PREPARING IDEAS…" : "MORE IDEAS"}</Text>
              </Pressable>
              <Text style={styles.footnote}>Each new batch of ideas may incur a processing charge.</Text>
            </>}
            {notice && <Text accessibilityRole="alert" style={styles.help}>{notice}</Text>}
            {saved.length > 0 && <>
              <Text style={styles.label}>SAVED</Text>
              <View style={styles.results}>
                {saved.map((outfit) => <OutfitCard key={outfit.id} label={labelFor(outfit.occasion)} garments={outfit.garments}
                  reason={outfit.reason} missing={outfit.missingGarmentIds.length} onEdit={onEdit} disabled={busy}
                  action={{ text: "REMOVE", onPress: () => void act(async () => { await removeSavedOutfit(outfit.id); return null; }) }} />)}
              </View>
            </>}
          </>;
        })()}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  topline: { padding: 22 },
  action: { color: colors.moss, fontFamily: fonts.textSemibold, fontSize: 11, letterSpacing: 1 },
  content: { paddingHorizontal: 22, paddingBottom: 32 },
  title: { color: colors.ink, fontFamily: fonts.display, fontSize: 40 },
  subtitle: { color: colors.muted, fontFamily: fonts.text, fontSize: 12, lineHeight: 19, marginTop: 4 },
  label: { color: colors.muted, fontFamily: fonts.textSemibold, fontSize: 10, letterSpacing: 1, marginTop: 28, marginBottom: 14 },
  loading: { marginTop: 32 },
  help: { color: colors.muted, fontFamily: fonts.text, fontSize: 12, lineHeight: 19, marginTop: 16, textAlign: "center" },
  button: { backgroundColor: colors.moss, borderRadius: 999, padding: 18, alignItems: "center", marginTop: 24, minHeight: 50 },
  buttonText: { color: colors.card, fontFamily: fonts.textSemibold, fontSize: 11, letterSpacing: 1 },
  secondary: { borderColor: colors.moss, borderWidth: 1, borderRadius: 999, padding: 14, alignItems: "center", marginTop: 20 },
  secondaryText: { color: colors.moss, fontFamily: fonts.textSemibold, fontSize: 11, letterSpacing: 1 },
  disabled: { opacity: 0.45 },
  notice: { marginTop: 24 },
  error: { color: colors.ink, fontFamily: fonts.text, fontSize: 14, lineHeight: 21 },
  results: { gap: 20 },
  card: { backgroundColor: colors.card, borderRadius: 20, borderWidth: 1, borderColor: colors.line, padding: 16 },
  cardLabel: { color: colors.muted, fontFamily: fonts.textSemibold, fontSize: 9, letterSpacing: 1, marginBottom: 16 },
  collage: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 14 },
  half: { width: "48%" },
  third: { width: "31%" },
  garmentName: { color: colors.ink, fontFamily: fonts.text, fontSize: 11, lineHeight: 16, marginTop: 7 },
  reason: { color: colors.ink, fontFamily: fonts.displayItalic, fontSize: 25, lineHeight: 29, marginTop: 20 },
  footnote: { color: colors.muted, fontFamily: fonts.text, fontSize: 10, lineHeight: 16, marginTop: 16, textAlign: "center" },
});
```

- [ ] **Step 2: Run the full checks**

Run: `npm run typecheck && npm test && npm run catalogue:build`
Expected: no type errors, all tests PASS, build succeeds. If `OccasionStylePicker`'s `onChange` cannot emit an empty selection in single mode, the `next ?? null` branch is simply never hit; leave it.

- [ ] **Step 3: Commit**

```bash
git add src/screens/OutfitSuggestionsScreen.tsx
git commit -m "feat(mobile): show prepared outfits instantly and save favourites"
```

---

### Task 11: Docs and issues

**Files:**
- Modify: `README.md`
- Modify: `docs/WARDROBE_DECISIONS.md`

- [ ] **Step 1: Update the README**

1. Find the endpoint bullet for the removed route: `grep -n "/v1/outfits/suggestions" README.md`. Replace that bullet with:

```markdown
- `GET /v1/outfits` (owner token) — stored outfit ideas, saved outfits and background status; never calls Claude
- `POST /v1/outfits/saved` with `{ "suggestionId": "…" }` (owner token) — saves an idea; `DELETE /v1/outfits/saved/:id` removes it
- `POST /v1/outfits/more` (owner token) — queues one background run (`202`), or `429 daily_limit_reached` / `422 wardrobe_too_small` / `503`
```

2. Find the "Get outfit ideas" section: `grep -n "Get outfit ideas" README.md`. Replace that section's body (up to the next heading) with:

```markdown
Outfit ideas are prepared in the background, so **Dress me** opens instantly
and never waits for Claude. The catalogue service runs one Claude call:

- **10 minutes after the last wardrobe change** (adding, editing, deleting or
  tagging a piece); every further change restarts the 10 minutes;
- at **03:00** only if outfits are still out of date (a failed run, or changes
  left after the daily limit);
- when you tap **More ideas**.

Each run asks for up to 2 new outfits per occasion in your profile (all five
without a profile) and favours the pieces changed since the last successful
run. At most **12 runs per day** (a day runs 03:00–03:00); runs skipped for a
wardrobe under 3 tagged pieces do not count. Each occasion keeps the **10
newest unsaved ideas**. Tap **♡ Save** to keep an idea: saved outfits are never
removed automatically, and they show "Missing a piece" if you delete one of
their garments. Ideas that use a deleted garment disappear. Without
`ANTHROPIC_API_KEY` no runs happen and only saved outfits show. The job runs
only while the catalogue service runs.
```

- [ ] **Step 2: Update the decisions record**

1. In `docs/WARDROBE_DECISIONS.md`, find the outfit table row `| Output cap |` under the outfits section and leave it; add this section at the end of the file:

```markdown
## Background outfit generation (C1.3)

Approved by the owner on 2026-10-10; full design in
`docs/superpowers/specs/2026-10-10-background-outfit-generation-design.md`.
This replaces the stateless suggestion endpoint: `POST /v1/outfits/suggestions`
is removed and Dress me never waits for Claude.

| Rule | Approved value |
|---|---|
| Change trigger | One run 10 minutes after the last change to the tagged wardrobe; each change restarts the wait |
| Catch-up | At 03:00 only if outfits are out of date; checked once per day |
| More ideas | One tap queues one run; counts toward the cap |
| One run | One Claude call, up to 2 new outfits per profile occasion (all five without a profile), favouring pieces changed since the last success |
| Model | `claude-opus-5-5`, `medium`, `max_tokens` 16000, 90 s, 2 SDK retries, refusal fallback |
| Cap | 12 runs per day, 03:00–03:00 local; skipped runs (under 3 tagged pieces) do not count |
| Failures | No retry loop; the next trigger retries |
| Pool | 10 newest unsaved ideas per occasion; exact duplicates (same pieces) dropped |
| Saved | Kept until removed; deleted pieces reported as missing |
| Run log | 7 days, always keeping the latest successful run |
| Refresh | Dress me re-reads stored outfits every 15 s while a run is pending or running |
```

2. In the same file, remove `outfit generation` from the "later work" bullet if it is still listed there.

- [ ] **Step 3: Commit**

```bash
git add README.md docs/WARDROBE_DECISIONS.md
git commit -m "docs: describe background outfit generation"
```

- [ ] **Step 4: Issues**

```bash
gh issue create -R zhinoo-zobairi/wist --label enhancement --label wardrobe-outfits \
  --title "[C1.3] Outfits: generate suggestions in the background and save favourites" \
  --body "Part of #1. Spec: docs/superpowers/specs/2026-10-10-background-outfit-generation-design.md. Plan: docs/superpowers/plans/2026-10-10-background-outfit-generation.md. Replaces the stateless waiting endpoint from #8/#9."
gh issue comment 10 -R zhinoo-zobairi/wist --body "Re-scoped by C1.3: weather now ranks stored outfits on request (using garment warmth) instead of adding a Claude call. The issue body predates this; treat the ranking approach as authoritative and update the body before implementation."
gh issue comment 11 -R zhinoo-zobairi/wist --body "Re-scoped by C1.3: today's plans rank or filter stored outfits on request instead of adding a Claude call. The issue body predates this; treat the ranking approach as authoritative and update the body before implementation."
```

---

## Self-review notes (done)

- **Spec coverage:** decisions 1, 2, 2b, 3, 5, 6 → Tasks 1, 2, 6, 7; 4 → Task 5; 7, 8, 9, 10 → Task 4 and Task 8 (`GET` cleanup); 11 → Tasks 8 and 10; 12 → Task 8 (`generationEnabled`, scheduler not started) and Task 10; 13 → Task 8 wiring. D1 and D2 → Task 6; D3 → Task 7; D4 → Tasks 4 and 7; D5 → Task 10; D6 → Task 4; D7 → Tasks 2 and 6.
- **Interpretation to confirm in review:** the cap day runs 03:00–03:00 so leftovers wait for the catch-up (decision 5). Photo uploads and failed tagging are not recorded as changes, because they cannot change the tagged wardrobe Claude sees.
- **Types used across tasks:** `GeneratedOutfit`, `garmentKey`, `RunTrigger`, `ScheduleState`, `RunSummary`, `SuggestionInput`, `GenerationDeps`, `OutfitBoard`, `MoreIdeasResult` are each defined once (Tasks 2–9) and used with the same names afterwards.

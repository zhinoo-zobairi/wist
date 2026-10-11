import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

import {
  MAX_SUGGESTIONS_PER_OCCASION, type DailyPickRecord, type OutfitRepository, type RunStatus, type RunSummary,
  type SavedOutfitRecord, type SuggestionRecord,
} from "./outfitRepository.js";
import { garmentKey, type GeneratedOutfit } from "./outfits.js";
import type { RunTrigger } from "./outfitSchedule.js";
import { OCCASIONS, type Occasion } from "./styleProfile.js";
import type { Coordinates } from "./weather.js";

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
      CREATE TABLE IF NOT EXISTS outfit_location (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        latitude REAL NOT NULL,
        longitude REAL NOT NULL
      );
      CREATE TABLE IF NOT EXISTS daily_pick (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        attempted_day TEXT,
        pick TEXT
      );
      INSERT OR IGNORE INTO daily_pick (id) VALUES (1);
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
      // Owner answer 2: the saved copy keeps the idea's place and reason in today's pick, in this same transaction.
      const stored = this.database.prepare("SELECT pick FROM daily_pick WHERE id = 1")
        .get() as unknown as { pick: string | null };
      if (stored.pick !== null) {
        const pick = JSON.parse(stored.pick) as DailyPickRecord;
        const position = pick.order.indexOf(id);
        if (position !== -1) {
          pick.order[position] = savedId;
          const pickReason = pick.reasons[id];
          delete pick.reasons[id];
          if (pickReason !== undefined) pick.reasons[savedId] = pickReason;
          this.database.prepare("UPDATE daily_pick SET pick = ? WHERE id = 1").run(JSON.stringify(pick));
        }
      }
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

  async saveLocation(at: Coordinates): Promise<void> {
    this.database.prepare(`
      INSERT INTO outfit_location (id, latitude, longitude) VALUES (1, ?, ?)
      ON CONFLICT(id) DO UPDATE SET latitude = excluded.latitude, longitude = excluded.longitude
    `).run(at.latitude, at.longitude);
  }

  async getLocation(): Promise<Coordinates | null> {
    const row = this.database.prepare("SELECT latitude, longitude FROM outfit_location WHERE id = 1")
      .get() as unknown as Coordinates | undefined;
    return row ? { latitude: row.latitude, longitude: row.longitude } : null;
  }

  async dailyPickAttemptedDay(): Promise<string | null> {
    const row = this.database.prepare("SELECT attempted_day FROM daily_pick WHERE id = 1")
      .get() as unknown as { attempted_day: string | null };
    return row.attempted_day;
  }

  async setDailyPickAttemptedDay(day: string): Promise<void> {
    this.database.prepare("UPDATE daily_pick SET attempted_day = ? WHERE id = 1").run(day);
  }

  async storeDailyPick({ day, weather, order, reasons }: DailyPickRecord): Promise<void> {
    this.database.prepare("UPDATE daily_pick SET pick = ? WHERE id = 1")
      .run(JSON.stringify({ day, weather, order, reasons }));
  }

  async getDailyPick(): Promise<DailyPickRecord | null> {
    const row = this.database.prepare("SELECT pick FROM daily_pick WHERE id = 1")
      .get() as unknown as { pick: string | null };
    return row.pick === null ? null : JSON.parse(row.pick) as DailyPickRecord;
  }

  close(): void {
    this.database.close();
  }
}

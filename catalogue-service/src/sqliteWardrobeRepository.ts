import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { OCCASIONS, type Occasion } from "./styleProfile.js";
import { MAX_GARMENTS, type Garment, type GarmentInput, type TagStatus } from "./wardrobe.js";
import { WardrobeFullError, type WardrobeRepository } from "./wardrobeRepository.js";

type GarmentRow = Omit<Garment, "colors" | "occasions" | "createdAt" | "updatedAt" | "photoUrl" | "tagStatus"> & {
  created_at: string;
  updated_at: string;
  photo_media_type: string | null;
  tag_status: TagStatus;
};

const GARMENT_COLUMNS = `
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL CHECK (source IN ('manual','photo','purchase')),
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('top','bottom','dress','outerwear','shoes','bag','accessory')),
  formality TEXT NOT NULL CHECK (formality IN ('casual','smart_casual','formal')),
  warmth TEXT NOT NULL CHECK (warmth IN ('light','medium','heavy')),
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  photo_media_type TEXT,
  tag_status TEXT NOT NULL DEFAULT 'tagged' CHECK (tag_status IN ('untagged','tagged','failed'))
`;

/** "any": human edit; "untagged": ordinary tagging; a timestamp: forced retag of an unchanged garment. */
type WriteCondition = "any" | "untagged" | string;

function writeGuard(condition: WriteCondition): { sql: string; params: string[] } {
  if (condition === "any") return { sql: "1 = 1", params: [] };
  if (condition === "untagged") return { sql: "tag_status IN ('untagged','failed')", params: [] };
  return { sql: "updated_at = ?", params: [condition] };
}

export class SqliteWardrobeRepository implements WardrobeRepository {
  private readonly database: DatabaseSync;

  constructor(path: string) {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.database = new DatabaseSync(path);
    this.database.exec("PRAGMA foreign_keys = ON");
    this.database.exec("PRAGMA journal_mode = WAL");
    this.database.exec("PRAGMA busy_timeout = 5000");
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS garments (${GARMENT_COLUMNS});
      CREATE TABLE IF NOT EXISTS garment_colors (
        garment_id TEXT NOT NULL REFERENCES garments(id) ON DELETE CASCADE,
        position INTEGER NOT NULL,
        color TEXT NOT NULL,
        PRIMARY KEY (garment_id, position)
      );
      CREATE TABLE IF NOT EXISTS garment_occasions (
        garment_id TEXT NOT NULL REFERENCES garments(id) ON DELETE CASCADE,
        occasion TEXT NOT NULL CHECK (occasion IN ('work','evening','weekend','celebration','travel')),
        PRIMARY KEY (garment_id, occasion)
      );
    `);
    try {
      this.migratePhotoColumns();
    } catch (error) {
      this.database.close();
      throw error;
    }
  }

  private migratePhotoColumns(): void {
    const columns = this.database.prepare("PRAGMA table_info(garments)")
      .all() as unknown as Array<{ name: string }>;
    const names = new Set(columns.map((column) => column.name));
    const { sql } = this.database.prepare("SELECT sql FROM sqlite_master WHERE name = 'garments'")
      .get() as unknown as { sql: string };
    const rebuild = !sql.includes("'photo'") || !sql.includes("'purchase'");
    if (names.has("photo_media_type") && names.has("tag_status") && !rebuild) return;

    // Disable cascades before opening the transaction: rebuilding the parent
    // must preserve its existing color and occasion rows.
    this.database.exec("PRAGMA foreign_keys = OFF");
    this.database.exec("BEGIN IMMEDIATE");
    try {
      if (!names.has("photo_media_type")) {
        this.database.exec("ALTER TABLE garments ADD COLUMN photo_media_type TEXT");
      }
      if (!names.has("tag_status")) {
        this.database.exec(`ALTER TABLE garments ADD COLUMN tag_status TEXT NOT NULL
          DEFAULT 'tagged' CHECK (tag_status IN ('untagged','tagged','failed'))`);
      }
      if (rebuild) {
        this.database.exec(`
          CREATE TABLE garments_new (${GARMENT_COLUMNS});
          INSERT INTO garments_new
            (id, source, name, category, formality, warmth, notes, created_at, updated_at, photo_media_type, tag_status)
          SELECT id, source, name, category, formality, warmth, notes, created_at, updated_at, photo_media_type, tag_status
          FROM garments;
          DROP TABLE garments;
          ALTER TABLE garments_new RENAME TO garments;
        `);
      }
      if (this.database.prepare("PRAGMA foreign_key_check").all().length > 0) {
        throw new Error("Wardrobe migration found invalid foreign keys");
      }
      this.database.exec("COMMIT");
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    } finally {
      this.database.exec("PRAGMA foreign_keys = ON");
    }
  }

  async listGarments(): Promise<Garment[]> {
    const rows = this.database.prepare(
      "SELECT * FROM garments ORDER BY created_at DESC, rowid DESC",
    ).all() as unknown as GarmentRow[];
    return rows.map((row) => this.readGarment(row));
  }

  async getGarment(id: string): Promise<Garment | null> {
    const row = this.database.prepare("SELECT * FROM garments WHERE id = ?")
      .get(id) as unknown as GarmentRow | undefined;
    return row ? this.readGarment(row) : null;
  }

  private readGarment(row: GarmentRow): Garment {
    const colorRows = this.database.prepare(
      "SELECT color FROM garment_colors WHERE garment_id = ? ORDER BY position",
    ).all(row.id) as unknown as Array<{ color: string }>;
    const occasionRows = this.database.prepare(
      "SELECT occasion FROM garment_occasions WHERE garment_id = ?",
    ).all(row.id) as unknown as Array<{ occasion: Occasion }>;
    const occasions = new Set(occasionRows.map((entry) => entry.occasion));
    return {
      id: row.id, source: row.source, name: row.name, category: row.category,
      formality: row.formality, warmth: row.warmth, notes: row.notes,
      colors: colorRows.map((entry) => entry.color),
      occasions: OCCASIONS.filter((occasion) => occasions.has(occasion)),
      createdAt: row.created_at, updatedAt: row.updated_at,
      photoUrl: row.photo_media_type ? `/v1/wardrobe/${row.id}/photo` : null,
      tagStatus: row.tag_status,
    };
  }

  async createGarment(input: GarmentInput, source: Garment["source"]): Promise<Garment> {
    return this.insertGarment(input, source, null, "tagged");
  }

  async createPhotoGarment(mediaType: string): Promise<Garment> {
    return this.insertGarment({
      name: "Untitled garment", category: "top", colors: ["unknown"],
      formality: "casual", warmth: "medium", occasions: [], notes: null,
    }, "photo", mediaType, "untagged");
  }

  private insertGarment(
    input: GarmentInput, source: Garment["source"], photoMediaType: string | null, tagStatus: TagStatus,
  ): Garment {
    const id = randomUUID();
    const now = new Date().toISOString();
    this.database.exec("BEGIN IMMEDIATE");
    try {
      const { count } = this.database.prepare("SELECT COUNT(*) AS count FROM garments")
        .get() as unknown as { count: number };
      if (count >= MAX_GARMENTS) throw new WardrobeFullError();
      this.database.prepare(`
        INSERT INTO garments (id, source, name, category, formality, warmth, notes, created_at, updated_at, photo_media_type, tag_status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, source, input.name, input.category, input.formality, input.warmth, input.notes, now, now, photoMediaType, tagStatus);
      this.writeChildSets(id, input);
      this.database.exec("COMMIT");
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
    return {
      ...input, id, source, createdAt: now, updatedAt: now, tagStatus,
      photoUrl: photoMediaType ? `/v1/wardrobe/${id}/photo` : null,
    };
  }

  async getPhotoMediaType(id: string): Promise<string | null> {
    const row = this.database.prepare("SELECT photo_media_type FROM garments WHERE id = ?")
      .get(id) as unknown as { photo_media_type: string | null } | undefined;
    return row?.photo_media_type ?? null;
  }

  async replaceGarment(id: string, input: GarmentInput): Promise<Garment | null> {
    return this.writeAttributes(id, input, "any");
  }

  async applyTags(id: string, tags: GarmentInput, expectedUpdatedAt?: string): Promise<Garment | null> {
    return this.writeAttributes(id, tags, expectedUpdatedAt ?? "untagged");
  }

  async markTagFailed(id: string): Promise<Garment | null> {
    const guard = writeGuard("untagged");
    const result = this.database.prepare(`
      UPDATE garments SET tag_status = 'failed', updated_at = ?
      WHERE id = ? AND ${guard.sql}
    `).run(new Date().toISOString(), id, ...guard.params);
    return result.changes > 0 ? this.getGarment(id) : null;
  }

  private async writeAttributes(id: string, input: GarmentInput, condition: WriteCondition): Promise<Garment | null> {
    const guard = writeGuard(condition);
    this.database.exec("BEGIN IMMEDIATE");
    try {
      const result = this.database.prepare(`
        UPDATE garments SET name = ?, category = ?, formality = ?, warmth = ?, notes = ?, updated_at = ?, tag_status = 'tagged'
        WHERE id = ? AND ${guard.sql}
      `).run(input.name, input.category, input.formality, input.warmth, input.notes, new Date().toISOString(), id, ...guard.params);
      if (result.changes > 0) this.writeChildSets(id, input);
      this.database.exec("COMMIT");
      return result.changes > 0 ? this.getGarment(id) : null;
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }

  private writeChildSets(id: string, input: GarmentInput): void {
    this.database.prepare("DELETE FROM garment_colors WHERE garment_id = ?").run(id);
    this.database.prepare("DELETE FROM garment_occasions WHERE garment_id = ?").run(id);
    const insertColor = this.database.prepare(
      "INSERT INTO garment_colors (garment_id, position, color) VALUES (?, ?, ?)",
    );
    input.colors.forEach((color, position) => insertColor.run(id, position, color));
    const insertOccasion = this.database.prepare(
      "INSERT INTO garment_occasions (garment_id, occasion) VALUES (?, ?)",
    );
    input.occasions.forEach((occasion) => insertOccasion.run(id, occasion));
  }

  async deleteGarment(id: string): Promise<boolean> {
    return this.database.prepare("DELETE FROM garments WHERE id = ?").run(id).changes > 0;
  }

  async countGarments(): Promise<number> {
    const row = this.database.prepare("SELECT COUNT(*) AS count FROM garments")
      .get() as unknown as { count: number };
    return row.count;
  }

  close(): void {
    this.database.close();
  }
}

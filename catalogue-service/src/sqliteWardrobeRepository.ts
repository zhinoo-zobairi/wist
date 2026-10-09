import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { OCCASIONS, type Occasion } from "./styleProfile.js";
import { MAX_GARMENTS, type Garment, type GarmentInput } from "./wardrobe.js";
import { WardrobeFullError, type WardrobeRepository } from "./wardrobeRepository.js";

type GarmentRow = Omit<Garment, "colors" | "occasions" | "createdAt" | "updatedAt"> & {
  created_at: string;
  updated_at: string;
};

export class SqliteWardrobeRepository implements WardrobeRepository {
  private readonly database: DatabaseSync;

  constructor(path: string) {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.database = new DatabaseSync(path);
    this.database.exec("PRAGMA foreign_keys = ON");
    this.database.exec("PRAGMA journal_mode = WAL");
    this.database.exec("PRAGMA busy_timeout = 5000");
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS garments (
        id TEXT PRIMARY KEY,
        source TEXT NOT NULL CHECK (source IN ('manual')),
        name TEXT NOT NULL,
        category TEXT NOT NULL CHECK (category IN ('top','bottom','dress','outerwear','shoes','bag','accessory')),
        formality TEXT NOT NULL CHECK (formality IN ('casual','smart_casual','formal')),
        warmth TEXT NOT NULL CHECK (warmth IN ('light','medium','heavy')),
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
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
    };
  }

  async createGarment(input: GarmentInput, source: Garment["source"]): Promise<Garment> {
    const id = randomUUID();
    const now = new Date().toISOString();
    this.database.exec("BEGIN IMMEDIATE");
    try {
      const { count } = this.database.prepare("SELECT COUNT(*) AS count FROM garments")
        .get() as unknown as { count: number };
      if (count >= MAX_GARMENTS) throw new WardrobeFullError();
      this.database.prepare(`
        INSERT INTO garments (id, source, name, category, formality, warmth, notes, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, source, input.name, input.category, input.formality, input.warmth, input.notes, now, now);
      this.writeChildSets(id, input);
      this.database.exec("COMMIT");
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
    return { ...input, id, source, createdAt: now, updatedAt: now };
  }

  async replaceGarment(id: string, input: GarmentInput): Promise<Garment | null> {
    this.database.exec("BEGIN IMMEDIATE");
    try {
      const result = this.database.prepare(`
        UPDATE garments SET name = ?, category = ?, formality = ?, warmth = ?, notes = ?, updated_at = ?
        WHERE id = ?
      `).run(input.name, input.category, input.formality, input.warmth, input.notes, new Date().toISOString(), id);
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

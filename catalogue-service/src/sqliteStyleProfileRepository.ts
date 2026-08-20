import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

import {
  OCCASIONS,
  STYLES,
  type Occasion,
  type Style,
  type StyleProfile,
  type StyleProfileSelection,
} from "./styleProfile.js";
import type { StyleProfileRepository } from "./styleProfileRepository.js";

const OWNER_PROFILE_ID = "owner";

export class SqliteStyleProfileRepository implements StyleProfileRepository {
  private readonly database: DatabaseSync;

  constructor(path: string) {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.database = new DatabaseSync(path);
    this.database.exec("PRAGMA foreign_keys = ON");
    this.database.exec("PRAGMA journal_mode = WAL");
    this.database.exec("PRAGMA busy_timeout = 5000");
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS style_profiles (
        id TEXT PRIMARY KEY,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS style_profile_occasions (
        profile_id TEXT NOT NULL REFERENCES style_profiles(id) ON DELETE CASCADE,
        occasion TEXT NOT NULL CHECK (
          occasion IN ('work', 'evening', 'weekend', 'celebration', 'travel')
        ),
        PRIMARY KEY (profile_id, occasion)
      );

      CREATE TABLE IF NOT EXISTS style_profile_styles (
        profile_id TEXT NOT NULL REFERENCES style_profiles(id) ON DELETE CASCADE,
        style TEXT NOT NULL CHECK (
          style IN ('minimal', 'tailored', 'romantic', 'utilitarian', 'bold', 'eclectic')
        ),
        PRIMARY KEY (profile_id, style)
      );
    `);
  }

  async getProfile(): Promise<StyleProfile | null> {
    const profile = this.database
      .prepare("SELECT updated_at FROM style_profiles WHERE id = ?")
      .get(OWNER_PROFILE_ID) as unknown as { updated_at: string } | undefined;
    if (!profile) return null;

    const occasionRows = this.database
      .prepare(
        "SELECT occasion FROM style_profile_occasions WHERE profile_id = ?",
      )
      .all(OWNER_PROFILE_ID) as unknown as Array<{ occasion: Occasion }>;
    const styleRows = this.database
      .prepare("SELECT style FROM style_profile_styles WHERE profile_id = ?")
      .all(OWNER_PROFILE_ID) as unknown as Array<{ style: Style }>;
    const occasions = new Set(occasionRows.map((row) => row.occasion));
    const styles = new Set(styleRows.map((row) => row.style));

    return {
      occasions: OCCASIONS.filter((occasion) => occasions.has(occasion)),
      styles: STYLES.filter((style) => styles.has(style)),
      updatedAt: profile.updated_at,
    };
  }

  async replaceProfile(
    selection: StyleProfileSelection,
  ): Promise<StyleProfile> {
    const updatedAt = new Date().toISOString();
    this.database.exec("BEGIN IMMEDIATE");
    try {
      this.database
        .prepare(`
          INSERT INTO style_profiles (id, updated_at)
          VALUES (?, ?)
          ON CONFLICT (id) DO UPDATE SET updated_at = excluded.updated_at
        `)
        .run(OWNER_PROFILE_ID, updatedAt);
      this.database
        .prepare("DELETE FROM style_profile_occasions WHERE profile_id = ?")
        .run(OWNER_PROFILE_ID);
      this.database
        .prepare("DELETE FROM style_profile_styles WHERE profile_id = ?")
        .run(OWNER_PROFILE_ID);

      const insertOccasion = this.database.prepare(`
        INSERT INTO style_profile_occasions (profile_id, occasion)
        VALUES (?, ?)
      `);
      selection.occasions.forEach((occasion) => {
        insertOccasion.run(OWNER_PROFILE_ID, occasion);
      });

      const insertStyle = this.database.prepare(`
        INSERT INTO style_profile_styles (profile_id, style)
        VALUES (?, ?)
      `);
      selection.styles.forEach((style) => {
        insertStyle.run(OWNER_PROFILE_ID, style);
      });

      this.database.exec("COMMIT");
      return { ...selection, updatedAt };
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }

  close(): void {
    this.database.close();
  }
}

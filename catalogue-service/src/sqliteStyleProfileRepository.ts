import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

import {
  FIT_ROWS,
  HELP_WITH,
  NEVER_COLOURS,
  OCCASIONS,
  PALETTES,
  SIGNATURE_PIECES,
  SIZE_KINDS,
  STYLES,
  TASTE_AXES,
  WARDROBE_GAPS,
  type FitRow,
  type HelpWith,
  type NeverColour,
  type Occasion,
  type Palette,
  type SignaturePiece,
  type Style,
  type StyleDetails,
  type StyleProfile,
  type StyleProfileSelection,
  type TasteAxis,
  type WardrobeGap,
} from "./styleProfile.js";
import type { StyleProfileRepository } from "./styleProfileRepository.js";

const OWNER_PROFILE_ID = "owner";

// The set answers, one child table each, written delete-then-insert like
// occasions and styles. The CHECK lists come from the constants the parser
// validates against.
const SET_TABLES = {
  helpWith: { table: "style_profile_help", vocabulary: HELP_WITH },
  palettes: { table: "style_profile_palettes", vocabulary: PALETTES },
  neverColours: {
    table: "style_profile_never_colours",
    vocabulary: NEVER_COLOURS,
  },
  signature: { table: "style_profile_signature", vocabulary: SIGNATURE_PIECES },
  gaps: { table: "style_profile_gaps", vocabulary: WARDROBE_GAPS },
} as const;
type SetKey = keyof typeof SET_TABLES;

const TASTE_AXIS_NAMES = Object.keys(TASTE_AXES) as TasteAxis[];
const FIT_ROW_NAMES = Object.keys(FIT_ROWS) as FitRow[];

// The single answers, as columns on style_profiles. They are added at startup
// when missing, the way sqliteWardrobeRepository upgrades garments, so a
// database from the August schema keeps its profile.
const DETAIL_COLUMNS = [
  "shops_for TEXT",
  "work_dress_code TEXT",
  "prints TEXT",
  "drop_threshold INTEGER",
  ...TASTE_AXIS_NAMES.map((axis) => `taste_${axis} TEXT`),
  ...FIT_ROW_NAMES.map((row) => `fit_${row} TEXT`),
  ...SIZE_KINDS.map((kind) => `size_${kind} TEXT`),
];

type ProfileRow = Record<string, string | number | null>;

// Table, column and vocabulary names are constants above, never request
// data, so building SQL from them cannot inject anything.
const sqlList = (values: readonly string[]) =>
  values.map((value) => `'${value}'`).join(", ");

// Per-row answers stored as one column each, e.g. taste_edge. A NULL column is
// an unanswered row and stays out of the map.
function columnAnswers(
  row: ProfileRow,
  prefix: string,
  names: readonly string[],
): Record<string, string> {
  return Object.fromEntries(
    names.flatMap((name) => {
      const value = row[`${prefix}_${name}`];
      return typeof value === "string" ? [[name, value]] : [];
    }),
  );
}

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
    for (const { table, vocabulary } of Object.values(SET_TABLES)) {
      this.database.exec(`
        CREATE TABLE IF NOT EXISTS ${table} (
          profile_id TEXT NOT NULL REFERENCES style_profiles(id) ON DELETE CASCADE,
          value TEXT NOT NULL CHECK (value IN (${sqlList(vocabulary)})),
          PRIMARY KEY (profile_id, value)
        )
      `);
    }
    this.migrateDetailColumns();
  }

  private migrateDetailColumns(): void {
    const columns = this.database.prepare("PRAGMA table_info(style_profiles)")
      .all() as unknown as Array<{ name: string }>;
    const names = new Set(columns.map((column) => column.name));
    for (const definition of DETAIL_COLUMNS) {
      const name = definition.slice(0, definition.indexOf(" "));
      if (!names.has(name)) {
        this.database.exec(`ALTER TABLE style_profiles ADD COLUMN ${definition}`);
      }
    }
  }

  async getProfile(): Promise<StyleProfile | null> {
    return this.readProfile();
  }

  /** The owner's drop threshold in whole percent; 0, any new low, until answered. */
  getDropThreshold(): number {
    const row = this.database
      .prepare("SELECT drop_threshold FROM style_profiles WHERE id = ?")
      .get(OWNER_PROFILE_ID) as unknown as
      | { drop_threshold: number | null }
      | undefined;
    return row?.drop_threshold ?? 0;
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

      this.writeDetails(selection);
      // Read inside the transaction: awaiting here would let another request
      // start its own BEGIN on this connection.
      const profile = this.readProfile()!;
      this.database.exec("COMMIT");
      return profile;
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }

  // Only the answers present in the selection are written: an absent key
  // keeps the stored answer (Decision 4).
  private writeDetails(selection: StyleProfileSelection): void {
    const columns: Record<string, string | number | null> = {};
    if (selection.shopsFor !== undefined) columns.shops_for = selection.shopsFor;
    if (selection.workDressCode !== undefined) {
      columns.work_dress_code = selection.workDressCode;
    }
    if (selection.prints !== undefined) columns.prints = selection.prints;
    if (selection.dropThreshold !== undefined) {
      columns.drop_threshold = selection.dropThreshold;
    }
    const { defaultSizes, fit, tasteAxes } = selection;
    if (tasteAxes) {
      TASTE_AXIS_NAMES.forEach((axis) => {
        columns[`taste_${axis}`] = tasteAxes[axis] ?? null;
      });
    }
    if (fit) {
      FIT_ROW_NAMES.forEach((row) => {
        columns[`fit_${row}`] = fit[row] ?? null;
      });
    }
    if (defaultSizes) {
      SIZE_KINDS.forEach((kind) => {
        columns[`size_${kind}`] = defaultSizes[kind] ?? null;
      });
    }
    const names = Object.keys(columns);
    if (names.length > 0) {
      this.database
        .prepare(
          `UPDATE style_profiles SET ${names.map((name) => `${name} = ?`).join(", ")} WHERE id = ?`,
        )
        .run(...Object.values(columns), OWNER_PROFILE_ID);
    }

    for (const key of Object.keys(SET_TABLES) as SetKey[]) {
      const values = selection[key];
      if (values === undefined) continue;
      const { table } = SET_TABLES[key];
      this.database
        .prepare(`DELETE FROM ${table} WHERE profile_id = ?`)
        .run(OWNER_PROFILE_ID);
      const insert = this.database.prepare(
        `INSERT INTO ${table} (profile_id, value) VALUES (?, ?)`,
      );
      values.forEach((value) => {
        insert.run(OWNER_PROFILE_ID, value);
      });
    }
  }

  private readProfile(): StyleProfile | null {
    const row = this.database
      .prepare("SELECT * FROM style_profiles WHERE id = ?")
      .get(OWNER_PROFILE_ID) as unknown as ProfileRow | undefined;
    if (!row) return null;

    const occasionRows = this.database
      .prepare(
        "SELECT occasion FROM style_profile_occasions WHERE profile_id = ?",
      )
      .all(OWNER_PROFILE_ID) as unknown as Array<{ occasion: Occasion }>;
    const styleRows = this.database
      .prepare("SELECT style FROM style_profile_styles WHERE profile_id = ?")
      .all(OWNER_PROFILE_ID) as unknown as Array<{ style: Style }>;
    const occasions = new Set(occasionRows.map((entry) => entry.occasion));
    const styles = new Set(styleRows.map((entry) => entry.style));

    return {
      occasions: OCCASIONS.filter((occasion) => occasions.has(occasion)),
      styles: STYLES.filter((style) => styles.has(style)),
      shopsFor: row.shops_for as StyleDetails["shopsFor"],
      helpWith: this.readSet("helpWith") as HelpWith[],
      workDressCode: row.work_dress_code as StyleDetails["workDressCode"],
      tasteAxes: columnAnswers(row, "taste", TASTE_AXIS_NAMES) as StyleDetails["tasteAxes"],
      palettes: this.readSet("palettes") as Palette[],
      neverColours: this.readSet("neverColours") as NeverColour[],
      prints: row.prints as StyleDetails["prints"],
      fit: columnAnswers(row, "fit", FIT_ROW_NAMES) as StyleDetails["fit"],
      defaultSizes: columnAnswers(row, "size", SIZE_KINDS),
      signature: this.readSet("signature") as SignaturePiece[],
      gaps: this.readSet("gaps") as WardrobeGap[],
      dropThreshold: row.drop_threshold as StyleDetails["dropThreshold"],
      updatedAt: row.updated_at as string,
    };
  }

  private readSet(key: SetKey): string[] {
    const { table, vocabulary } = SET_TABLES[key];
    const rows = this.database
      .prepare(`SELECT value FROM ${table} WHERE profile_id = ?`)
      .all(OWNER_PROFILE_ID) as unknown as Array<{ value: string }>;
    const stored = new Set(rows.map((entry) => entry.value));
    return (vocabulary as readonly string[]).filter((value) => stored.has(value));
  }

  close(): void {
    this.database.close();
  }
}

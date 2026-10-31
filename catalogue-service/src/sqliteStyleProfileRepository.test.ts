import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { SqliteStyleProfileRepository } from "./sqliteStyleProfileRepository.js";
import { emptyStyleDetails, type StyleDetails } from "./styleProfile.js";

const fullBrief: StyleDetails = {
  shopsFor: "womenswear",
  helpWith: ["use_what_i_own"],
  workDressCode: "smart",
  tasteAxes: { structure: "fluid", edge: "soft" },
  palettes: ["ivory_camel", "ink_grey"],
  neverColours: ["orange"],
  prints: "small_doses",
  fit: { tops: "relaxed", trousers: "wide", lengths: "midi" },
  defaultSizes: { tops: "S", bottoms: "36", shoes: "38" },
  signature: ["blazer", "loafers"],
  gaps: ["long_coat", "evening_shoes"],
  dropThreshold: 20,
};

describe("SQLite style profile repository", () => {
  const repositories: SqliteStyleProfileRepository[] = [];
  const temporaryDirectories: string[] = [];

  afterEach(() => {
    repositories.splice(0).forEach((repository) => repository.close());
    temporaryDirectories
      .splice(0)
      .forEach((directory) => rmSync(directory, { recursive: true }));
  });

  const createRepository = (path = ":memory:") => {
    const repository = new SqliteStyleProfileRepository(path);
    repositories.push(repository);
    return repository;
  };

  it("returns null before the owner has answered", async () => {
    await expect(createRepository().getProfile()).resolves.toBeNull();
  });

  it("round-trips and replaces the complete profile", async () => {
    const repository = createRepository();
    await repository.replaceProfile({
      occasions: ["work", "evening"],
      styles: ["minimal", "tailored"],
    });
    await repository.replaceProfile({
      occasions: ["travel"],
      styles: ["bold"],
    });

    await expect(repository.getProfile()).resolves.toMatchObject({
      occasions: ["travel"],
      styles: ["bold"],
    });
  });

  it("cascades child rows when the owner profile is deleted", async () => {
    const directory = mkdtempSync(join(tmpdir(), "wist-style-profile-"));
    temporaryDirectories.push(directory);
    const path = join(directory, "profile.sqlite");
    const repository = createRepository(path);
    await repository.replaceProfile({
      occasions: ["celebration"],
      styles: ["romantic"],
    });

    const database = new DatabaseSync(path);
    database.exec("PRAGMA foreign_keys = ON");
    database.prepare("DELETE FROM style_profiles WHERE id = ?").run("owner");
    const occasionCount = database
      .prepare("SELECT COUNT(*) AS count FROM style_profile_occasions")
      .get() as unknown as { count: number };
    const styleCount = database
      .prepare("SELECT COUNT(*) AS count FROM style_profile_styles")
      .get() as unknown as { count: number };
    database.close();

    expect(occasionCount.count).toBe(0);
    expect(styleCount.count).toBe(0);
    await expect(repository.getProfile()).resolves.toBeNull();
  });

  it("reads a profile saved without a brief as unanswered", async () => {
    const repository = createRepository();
    await repository.replaceProfile({ occasions: ["work"], styles: [] });

    await expect(repository.getProfile()).resolves.toEqual({
      ...emptyStyleDetails(),
      occasions: ["work"],
      styles: [],
      updatedAt: expect.any(String),
    });
  });

  it("round-trips every brief answer", async () => {
    const repository = createRepository();

    await expect(
      repository.replaceProfile({ occasions: [], styles: [], ...fullBrief }),
    ).resolves.toMatchObject(fullBrief);
    await expect(repository.getProfile()).resolves.toMatchObject(fullBrief);
  });

  // Decision 4: a client that predates a field cannot erase it.
  it("keeps the answers a write leaves out and clears the empty ones", async () => {
    const repository = createRepository();
    await repository.replaceProfile({ occasions: [], styles: [], ...fullBrief });
    await repository.replaceProfile({
      occasions: ["travel"],
      styles: [],
      palettes: [],
      shopsFor: null,
      fit: {},
    });

    await expect(repository.getProfile()).resolves.toEqual({
      ...fullBrief,
      occasions: ["travel"],
      styles: [],
      palettes: [],
      shopsFor: null,
      fit: {},
      updatedAt: expect.any(String),
    });
  });

  it("reads the drop threshold, 0 until answered", async () => {
    const repository = createRepository();
    expect(repository.getDropThreshold()).toBe(0);

    await repository.replaceProfile({ occasions: [], styles: [], dropThreshold: 30 });
    expect(repository.getDropThreshold()).toBe(30);
  });

  it("upgrades a database made by the August schema and keeps its answers", async () => {
    const directory = mkdtempSync(join(tmpdir(), "wist-style-profile-"));
    temporaryDirectories.push(directory);
    const path = join(directory, "profile.sqlite");
    const august = new DatabaseSync(path);
    august.exec(`
      CREATE TABLE style_profiles (id TEXT PRIMARY KEY, updated_at TEXT NOT NULL);
      CREATE TABLE style_profile_occasions (
        profile_id TEXT NOT NULL REFERENCES style_profiles(id) ON DELETE CASCADE,
        occasion TEXT NOT NULL,
        PRIMARY KEY (profile_id, occasion)
      );
      CREATE TABLE style_profile_styles (
        profile_id TEXT NOT NULL REFERENCES style_profiles(id) ON DELETE CASCADE,
        style TEXT NOT NULL,
        PRIMARY KEY (profile_id, style)
      );
      INSERT INTO style_profiles VALUES ('owner', '2026-08-21T12:00:00.000Z');
      INSERT INTO style_profile_occasions VALUES ('owner', 'work');
      INSERT INTO style_profile_styles VALUES ('owner', 'minimal');
    `);
    august.close();

    const repository = createRepository(path);
    await expect(repository.getProfile()).resolves.toEqual({
      ...emptyStyleDetails(),
      occasions: ["work"],
      styles: ["minimal"],
      updatedAt: "2026-08-21T12:00:00.000Z",
    });
    await repository.replaceProfile({
      occasions: ["work"],
      styles: ["minimal"],
      dropThreshold: 10,
    });
    expect(repository.getDropThreshold()).toBe(10);
  });
});

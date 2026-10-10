import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SqliteWardrobeRepository } from "./sqliteWardrobeRepository.js";
import type { GarmentInput } from "./wardrobe.js";
import { WardrobeFullError } from "./wardrobeRepository.js";

const input: GarmentInput = {
  name: "Navy shirt", category: "top", colors: ["navy", "cream"],
  formality: "smart_casual", warmth: "light", occasions: ["travel", "work"], notes: null,
};

describe("SQLite wardrobe repository", () => {
  const repositories: SqliteWardrobeRepository[] = [];
  const directories: string[] = [];
  afterEach(() => {
    repositories.splice(0).forEach((repository) => repository.close());
    directories.splice(0).forEach((directory) => rmSync(directory, { recursive: true }));
  });
  function createRepository(path = ":memory:") {
    const repository = new SqliteWardrobeRepository(path);
    repositories.push(repository);
    return repository;
  }

  it("round-trips attributes and lists newest first, including tied timestamps", async () => {
    const repository = createRepository();
    const first = await repository.createGarment(input, "manual");
    const second = await repository.createGarment({ ...input, name: "Cream shirt" }, "manual");
    expect(first.id).toMatch(/^[0-9a-f-]{36}$/);
    await expect(repository.getGarment(first.id)).resolves.toEqual({ ...first, occasions: ["work", "travel"] });
    expect((await repository.listGarments()).map((garment) => garment.id)).toEqual([second.id, first.id]);
    await expect(repository.countGarments()).resolves.toBe(2);
  });

  it("replaces all child sets without changing creation metadata or source", async () => {
    const repository = createRepository();
    const garment = await repository.createGarment(input, "manual");
    await expect(repository.replaceGarment(garment.id, {
      ...input, colors: ["red"], occasions: ["evening"], notes: "Altered",
    })).resolves.toMatchObject({
      colors: ["red"], occasions: ["evening"], notes: "Altered", source: "manual", createdAt: garment.createdAt,
    });
    await expect(repository.replaceGarment(garment.id, { ...input, occasions: [] }))
      .resolves.toMatchObject({ occasions: [] });
  });

  it("rolls back parent and child changes when a child constraint fails", async () => {
    const repository = createRepository();
    const garment = await repository.createGarment(input, "manual");
    await expect(repository.replaceGarment(garment.id, {
      ...input, name: "Changed", occasions: ["work", "work"],
    })).rejects.toThrow();
    await expect(repository.getGarment(garment.id)).resolves.toEqual({ ...garment, occasions: ["work", "travel"] });
  });

  it("returns null/false for unknown ids", async () => {
    const repository = createRepository();
    await expect(repository.getGarment("missing")).resolves.toBeNull();
    await expect(repository.replaceGarment("missing", input)).resolves.toBeNull();
    await expect(repository.deleteGarment("missing")).resolves.toBe(false);
  });

  it("persists garments on disk and cascades deletion to child rows", async () => {
    const directory = mkdtempSync(join(tmpdir(), "wist-wardrobe-"));
    directories.push(directory);
    const path = join(directory, "wardrobe.sqlite");
    const repository = createRepository(path);
    const garment = await repository.createGarment(input, "manual");
    const reopened = createRepository(path);
    await expect(reopened.getGarment(garment.id)).resolves.toMatchObject({ name: input.name, colors: input.colors });
    await expect(reopened.deleteGarment(garment.id)).resolves.toBe(true);
    const database = new DatabaseSync(path);
    try {
      expect(database.prepare("SELECT COUNT(*) AS count FROM garment_colors").get()).toMatchObject({ count: 0 });
      expect(database.prepare("SELECT COUNT(*) AS count FROM garment_occasions").get()).toMatchObject({ count: 0 });
    } finally {
      database.close();
    }
    await expect(repository.getGarment(garment.id)).resolves.toBeNull();
  });

  it("enforces the 300-garment limit atomically and frees capacity on deletion", async () => {
    const repository = createRepository();
    const results = await Promise.allSettled(
      Array.from({ length: 301 }, () => repository.createGarment(input, "manual")),
    );
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(300);
    expect(results[300]).toMatchObject({ status: "rejected", reason: expect.any(WardrobeFullError) });
    await expect(repository.countGarments()).resolves.toBe(300);
    const first = (await repository.listGarments())[0]!;
    await repository.deleteGarment(first.id);
    await expect(repository.createGarment(input, "manual")).resolves.toMatchObject({ name: input.name });
  });


  it("persists purchase links, public images and size notes through tagging and edits", async () => {
    const repository = createRepository();
    const garment = await repository.createPurchaseGarment("catalogue-1", "https://brand.example/shirt.jpg", "Size: M");
    expect(garment).toMatchObject({
      source: "purchase", catalogueItemId: "catalogue-1", photoUrl: "https://brand.example/shirt.jpg",
      name: "Untitled garment", colors: ["unknown"], tagStatus: "untagged", notes: "Size: M",
    });
    await expect(repository.getGarment(garment.id)).resolves.toEqual(garment);
    await expect(repository.getPhotoMediaType(garment.id)).resolves.toBeNull();
    await repository.applyTags(garment.id, { ...input, notes: garment.notes });
    await expect(repository.replaceGarment(garment.id, input)).resolves.toMatchObject({
      source: "purchase", catalogueItemId: "catalogue-1", photoUrl: garment.photoUrl, tagStatus: "tagged",
    });
    const duplicate = await repository.createPurchaseGarment("catalogue-1", garment.photoUrl!, null);
    expect(duplicate.id).not.toBe(garment.id);
    expect(duplicate.notes).toBeNull();
  });

  it("records a purchase change only when tags are applied, including after reopening", async () => {
    const directory = mkdtempSync(join(tmpdir(), "wist-purchase-change-"));
    directories.push(directory);
    const path = join(directory, "wardrobe.sqlite");
    const repository = createRepository(path);
    const garment = await repository.createPurchaseGarment("catalogue-1", "https://brand.example/shirt.jpg", null);
    await expect(repository.lastChangedAt()).resolves.toBeNull();
    await repository.markTagFailed(garment.id);
    await expect(repository.lastChangedAt()).resolves.toBeNull();
    const reopened = createRepository(path);
    await expect(reopened.lastChangedAt()).resolves.toBeNull();
    await reopened.applyTags(garment.id, input);
    await expect(repository.lastChangedAt()).resolves.toEqual(expect.any(String));
  });

  it("adds purchase columns to a B1.2 database without losing records and reopens safely", async () => {
    const directory = mkdtempSync(join(tmpdir(), "wist-purchase-upgrade-"));
    directories.push(directory);
    const path = join(directory, "wardrobe.sqlite");
    const database = new DatabaseSync(path);
    database.exec(`
      CREATE TABLE garments (
        id TEXT PRIMARY KEY, source TEXT NOT NULL CHECK (source IN ('manual','photo','purchase')),
        name TEXT NOT NULL, category TEXT NOT NULL, formality TEXT NOT NULL, warmth TEXT NOT NULL,
        notes TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, photo_media_type TEXT,
        tag_status TEXT NOT NULL DEFAULT 'tagged' CHECK (tag_status IN ('untagged','tagged','failed'))
      );
      CREATE TABLE garment_colors (
        garment_id TEXT NOT NULL REFERENCES garments(id) ON DELETE CASCADE,
        position INTEGER NOT NULL, color TEXT NOT NULL, PRIMARY KEY (garment_id, position)
      );
      CREATE TABLE garment_occasions (
        garment_id TEXT NOT NULL REFERENCES garments(id) ON DELETE CASCADE,
        occasion TEXT NOT NULL, PRIMARY KEY (garment_id, occasion)
      );
      INSERT INTO garments VALUES ('legacy', 'photo', 'Navy shirt', 'top', 'casual', 'light', 'Keep', '2026-10-01', '2026-10-02', 'image/jpeg', 'tagged');
      INSERT INTO garment_colors VALUES ('legacy', 0, 'navy');
      INSERT INTO garment_occasions VALUES ('legacy', 'work');
    `);
    database.close();
    const repository = createRepository(path);
    const expected = {
      id: "legacy", name: "Navy shirt", category: "top", formality: "casual", warmth: "light",
      notes: "Keep", source: "photo", colors: ["navy"], occasions: ["work"], tagStatus: "tagged",
      catalogueItemId: null, photoUrl: "/v1/wardrobe/legacy/photo", createdAt: "2026-10-01", updatedAt: "2026-10-02",
    };
    await expect(repository.getGarment("legacy")).resolves.toEqual(expected);
    const purchase = await repository.createPurchaseGarment("catalogue-1", "https://brand.example/shirt.jpg", null);
    const reopened = createRepository(path);
    await expect(reopened.getGarment("legacy")).resolves.toEqual(expected);
    await expect(reopened.getGarment(purchase.id)).resolves.toEqual(purchase);
    const check = new DatabaseSync(path);
    try {
      const columns = check.prepare("PRAGMA table_info(garments)").all().map((column) => column.name);
      expect(columns.filter((name) => name === "catalogue_item_id")).toHaveLength(1);
      expect(check.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
    } finally { check.close(); }
  });

  it("creates a photo garment and preserves its source and photo after owner edits", async () => {
    const repository = createRepository();
    const garment = await repository.createPhotoGarment("image/jpeg");
    expect(garment).toMatchObject({
      name: "Untitled garment", category: "top", colors: ["unknown"],
      formality: "casual", warmth: "medium", occasions: [], source: "photo",
      tagStatus: "untagged", photoUrl: `/v1/wardrobe/${garment.id}/photo`,
    });
    await expect(repository.getPhotoMediaType(garment.id)).resolves.toBe("image/jpeg");
    await expect(repository.replaceGarment(garment.id, input)).resolves.toMatchObject({
      source: "photo", tagStatus: "tagged", photoUrl: garment.photoUrl,
    });
    await expect(repository.getPhotoMediaType("missing")).resolves.toBeNull();
  });

  it("applies tags atomically, records failures, and never marks a tagged garment failed", async () => {
    const repository = createRepository();
    const garment = await repository.createPhotoGarment("image/webp");
    await expect(repository.markTagFailed(garment.id)).resolves.toMatchObject({ tagStatus: "failed" });
    await expect(repository.applyTags(garment.id, input)).resolves.toMatchObject({
      ...input, occasions: ["work", "travel"], source: "photo", tagStatus: "tagged", photoUrl: garment.photoUrl,
    });
    await expect(repository.applyTags(garment.id, { ...input, name: "Overwrite" })).resolves.toBeNull();
    await expect(repository.markTagFailed(garment.id)).resolves.toBeNull();
    await expect(repository.getGarment(garment.id)).resolves.toMatchObject({ name: input.name, tagStatus: "tagged" });
    const tagged = (await repository.getGarment(garment.id))!;
    const forced = await repository.applyTags(garment.id, { ...input, colors: ["cream"] }, tagged.updatedAt);
    expect(forced).toMatchObject({ colors: ["cream"], tagStatus: "tagged" });
    await expect(repository.markTagFailed(garment.id)).resolves.toBeNull();
    await expect(repository.getGarment(garment.id)).resolves.toMatchObject({ colors: ["cream"], tagStatus: "tagged" });
    await expect(repository.applyTags("missing", input)).resolves.toBeNull();
    await expect(repository.markTagFailed("missing")).resolves.toBeNull();
  });

  it("refuses forced tag writes once the garment changed after it was read", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      const repository = createRepository();
      vi.setSystemTime(new Date("2026-10-10T09:00:00.000Z"));
      const garment = await repository.createPhotoGarment("image/jpeg");
      const readBeforeTagging = (await repository.replaceGarment(garment.id, input))!;
      vi.setSystemTime(new Date("2026-10-10T09:00:30.000Z")); // the owner saves while the model call runs
      await repository.replaceGarment(garment.id, { ...input, name: "Edited mid-call" });

      await expect(repository.applyTags(garment.id, { ...input, name: "Model" }, readBeforeTagging.updatedAt))
        .resolves.toBeNull();
      await expect(repository.getGarment(garment.id))
        .resolves.toMatchObject({ name: "Edited mid-call", tagStatus: "tagged" });
    } finally {
      vi.useRealTimers();
    }
  });

  it("upgrades the B1.1 schema without losing garments or child rows and can reopen it", async () => {
    const directory = mkdtempSync(join(tmpdir(), "wist-wardrobe-upgrade-"));
    directories.push(directory);
    const path = join(directory, "wardrobe.sqlite");
    const database = new DatabaseSync(path);
    database.exec(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE garments (
        id TEXT PRIMARY KEY, source TEXT NOT NULL CHECK (source IN ('manual')),
        name TEXT NOT NULL,
        category TEXT NOT NULL CHECK (category IN ('top','bottom','dress','outerwear','shoes','bag','accessory')),
        formality TEXT NOT NULL CHECK (formality IN ('casual','smart_casual','formal')),
        warmth TEXT NOT NULL CHECK (warmth IN ('light','medium','heavy')),
        notes TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE garment_colors (
        garment_id TEXT NOT NULL REFERENCES garments(id) ON DELETE CASCADE,
        position INTEGER NOT NULL, color TEXT NOT NULL, PRIMARY KEY (garment_id, position)
      );
      CREATE TABLE garment_occasions (
        garment_id TEXT NOT NULL REFERENCES garments(id) ON DELETE CASCADE,
        occasion TEXT NOT NULL CHECK (occasion IN ('work','evening','weekend','celebration','travel')),
        PRIMARY KEY (garment_id, occasion)
      );
      INSERT INTO garments VALUES ('legacy', 'manual', 'Navy shirt', 'top', 'smart_casual', 'light', 'Keep me', '2026-10-01', '2026-10-02');
      INSERT INTO garment_colors VALUES ('legacy', 0, 'navy'), ('legacy', 1, 'cream');
      INSERT INTO garment_occasions VALUES ('legacy', 'travel'), ('legacy', 'work');
    `);
    database.close();
    const repository = createRepository(path);
    const expected = {
      id: "legacy", name: "Navy shirt", category: "top", colors: ["navy", "cream"],
      formality: "smart_casual", warmth: "light", occasions: ["work", "travel"],
      notes: "Keep me", source: "manual", catalogueItemId: null, tagStatus: "tagged", photoUrl: null,
      createdAt: "2026-10-01", updatedAt: "2026-10-02",
    };
    await expect(repository.getGarment("legacy")).resolves.toEqual(expected);
    const photo = await repository.createPhotoGarment("image/png");
    const reopened = createRepository(path);
    await expect(reopened.getGarment("legacy")).resolves.toEqual(expected);
    await expect(reopened.getGarment(photo.id)).resolves.toMatchObject({ source: "photo", tagStatus: "untagged" });
    await reopened.deleteGarment("legacy");
    const check = new DatabaseSync(path);
    try {
      expect(check.prepare("SELECT COUNT(*) AS count FROM garment_colors WHERE garment_id = 'legacy'").get())
        .toMatchObject({ count: 0 });
      expect(check.prepare("SELECT COUNT(*) AS count FROM garment_occasions WHERE garment_id = 'legacy'").get())
        .toMatchObject({ count: 0 });
      expect(check.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
    } finally {
      check.close();
    }
  });

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
});

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";

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
});

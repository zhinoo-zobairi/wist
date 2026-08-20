import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { SqliteStyleProfileRepository } from "./sqliteStyleProfileRepository.js";

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
});

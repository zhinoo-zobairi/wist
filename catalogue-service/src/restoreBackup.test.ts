import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { restoreBackup, runBackup } from "./backupData.js";

describe("restore", () => {
  const roots: string[] = [];
  afterEach(() => {
    for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
  });
  function setup() {
    const root = mkdtempSync(join(tmpdir(), "wist-restore-"));
    roots.push(root);
    const dataDir = join(root, "data");
    mkdirSync(join(dataDir, "wardrobe-photos"), { recursive: true });
    const databasePath = join(dataDir, "wist.sqlite");
    const db = new DatabaseSync(databasePath);
    db.exec("PRAGMA journal_mode = WAL");
    db.exec("CREATE TABLE garments (id TEXT, name TEXT)");
    db.exec("INSERT INTO garments VALUES ('a', 'coat'), ('b', 'scarf')");
    writeFileSync(join(dataDir, "wardrobe-photos", "a.jpg"), Buffer.from([1, 2, 3]));
    return { dataDir, databasePath, db, destination: join(root, "backups") };
  }
  const at = (day: number) => new Date(2026, 9, day, 4, 30);

  it("restores a backup over the data folder and refuses while a WAL file has content", () => {
    const { db, databasePath, destination, dataDir } = setup();
    runBackup({ databasePath, destination, now: at(1) });
    db.exec("INSERT INTO garments VALUES ('c', 'hat')");
    expect(existsSync(`${databasePath}-wal`)).toBe(true);
    expect(() => restoreBackup({ backupFolder: join(destination, "2026-10-01-0430"), databasePath })).toThrow(/stop the service/i);
    db.close();
    writeFileSync(join(dataDir, "wardrobe-photos", "extra.jpg"), "x");
    restoreBackup({ backupFolder: join(destination, "2026-10-01-0430"), databasePath });
    const restored = new DatabaseSync(databasePath);
    expect(restored.prepare("SELECT count(*) AS n FROM garments").get()).toEqual({ n: 2 });
    restored.close();
    expect(readdirSync(join(dataDir, "wardrobe-photos"))).toEqual(["a.jpg"]);
  });
});

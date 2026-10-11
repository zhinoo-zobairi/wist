import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runBackup } from "./backupData.js";

describe("backup", () => {
  const roots: string[] = [];
  afterEach(() => {
    for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
  });
  function setup() {
    const root = mkdtempSync(join(tmpdir(), "wist-backup-"));
    roots.push(root);
    const dataDir = join(root, "data");
    mkdirSync(join(dataDir, "wardrobe-photos"), { recursive: true });
    const databasePath = join(dataDir, "wist.sqlite");
    const db = new DatabaseSync(databasePath);
    db.exec("PRAGMA journal_mode = WAL");
    db.exec("CREATE TABLE garments (id TEXT, name TEXT)");
    db.exec("INSERT INTO garments VALUES ('a', 'coat'), ('b', 'scarf')");
    writeFileSync(join(dataDir, "wardrobe-photos", "a.jpg"), Buffer.from([1, 2, 3]));
    return { root, dataDir, databasePath, db, destination: join(root, "backups") };
  }
  const at = (day: number) => new Date(2026, 9, day, 4, 30);

  it("copies the database rows and the photos while the database is open", () => {
    const { db, databasePath, destination } = setup();
    runBackup({ databasePath, destination, now: at(11) });
    const folder = join(destination, "2026-10-11-0430");
    const copy = new DatabaseSync(join(folder, "wist.sqlite"));
    expect(copy.prepare("SELECT id, name FROM garments ORDER BY id").all()).toEqual([
      { id: "a", name: "coat" },
      { id: "b", name: "scarf" },
    ]);
    copy.close();
    db.close();
    expect([...readFileSync(join(folder, "wardrobe-photos", "a.jpg"))]).toEqual([1, 2, 3]);
  });

  it("keeps the 7 newest backups and ignores everything else", () => {
    const { db, databasePath, destination } = setup();
    mkdirSync(join(destination, "notes"), { recursive: true });
    writeFileSync(join(destination, "readme.txt"), "keep me");
    mkdirSync(join(destination, "2020-01-01-0430-old"));
    for (let day = 1; day <= 9; day++) runBackup({ databasePath, destination, now: at(day) });
    db.close();
    const names = readdirSync(destination).sort();
    expect(names).toEqual([
      "2020-01-01-0430-old",
      "2026-10-03-0430",
      "2026-10-04-0430",
      "2026-10-05-0430",
      "2026-10-06-0430",
      "2026-10-07-0430",
      "2026-10-08-0430",
      "2026-10-09-0430",
      "notes",
      "readme.txt",
    ]);
  });

  it("leaves no counted folder and deletes nothing when a run fails", () => {
    const { db, databasePath, destination, dataDir } = setup();
    runBackup({ databasePath, destination, now: at(1) });
    rmSync(join(dataDir, "wardrobe-photos"), { recursive: true });
    expect(() => runBackup({ databasePath, destination, now: at(2) })).toThrow(/photos/);
    db.close();
    expect(readdirSync(destination)).toEqual(["2026-10-01-0430"]);
  });
});

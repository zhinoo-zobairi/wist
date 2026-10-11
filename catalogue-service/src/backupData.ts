import { cpSync, mkdirSync, readdirSync, renameSync, rmSync, existsSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { dirname, join } from "node:path";

export const BACKUPS_TO_KEEP = 7;
const BACKUP_NAME = /^\d{4}-\d{2}-\d{2}-\d{4}$/;

export function backupName(now: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
}

// Writes <destination>/<name>/{wist.sqlite, wardrobe-photos/}. The folder is built under a
// ".tmp-" name (which never matches BACKUP_NAME) and renamed only when complete, so a half-written
// backup is never counted. VACUUM INTO reads a consistent snapshot while the service keeps running.
export function runBackup(options: { databasePath: string; destination: string; now: Date }): string {
  const { databasePath, destination, now } = options;
  const name = backupName(now);
  const finalFolder = join(destination, name);
  const tempFolder = join(destination, `.tmp-${name}`);
  const photosFolder = join(dirname(databasePath), "wardrobe-photos");
  if (existsSync(finalFolder)) throw new Error(`Backup ${name} already exists`);
  rmSync(tempFolder, { recursive: true, force: true });
  mkdirSync(tempFolder, { recursive: true });
  try {
    if (!existsSync(photosFolder)) throw new Error(`Cannot find the photos folder ${photosFolder}`);
    const database = new DatabaseSync(databasePath, { readOnly: true });
    try {
      database.exec(`VACUUM INTO '${join(tempFolder, "wist.sqlite").replaceAll("'", "''")}'`);
    } finally {
      database.close();
    }
    cpSync(photosFolder, join(tempFolder, "wardrobe-photos"), { recursive: true });
    renameSync(tempFolder, finalFolder);
  } catch (error) {
    rmSync(tempFolder, { recursive: true, force: true });
    throw error;
  }
  deleteOldBackups(destination);
  return finalFolder;
}

function deleteOldBackups(destination: string): void {
  const completed = readdirSync(destination, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && BACKUP_NAME.test(entry.name))
    .map((entry) => entry.name)
    .sort();
  for (const name of completed.slice(0, Math.max(0, completed.length - BACKUPS_TO_KEEP))) {
    rmSync(join(destination, name), { recursive: true, force: true });
  }
}

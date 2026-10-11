import { resolve } from "node:path";
import { runBackup } from "./backupData.js";

try {
  const folder = runBackup({
    databasePath: process.env.CATALOGUE_DB_PATH ?? resolve("catalogue-service/data/wist.sqlite"),
    destination: process.env.CATALOGUE_BACKUP_DIR ?? "/mnt/c/WistBackups",
    now: new Date(),
  });
  console.log(`Backup written to ${folder}`);
} catch (error) {
  console.error(`Backup failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  process.exitCode = 1;
}

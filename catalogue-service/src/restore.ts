import { resolve } from "node:path";
import { restoreBackup } from "./backupData.js";

try {
  const backupFolder = process.argv[2];
  if (!backupFolder) {
    throw new Error("Usage: npm run catalogue:restore -- /mnt/c/WistBackups/2026-10-11-0430");
  }
  restoreBackup({
    backupFolder: resolve(backupFolder),
    databasePath: process.env.CATALOGUE_DB_PATH ?? resolve("catalogue-service/data/wist.sqlite"),
  });
  console.log(`Restored ${backupFolder}`);
} catch (error) {
  console.error(`Restore failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  process.exitCode = 1;
}

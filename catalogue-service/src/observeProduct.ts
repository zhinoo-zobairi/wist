import { resolve } from "node:path";

import { createDefaultPoliteFetch } from "./politeFetch.js";
import { fetchProductObservation } from "./productObservation.js";
import { SqliteCatalogueRepository } from "./sqliteRepository.js";
import { SqliteStyleProfileRepository } from "./sqliteStyleProfileRepository.js";

async function main() {
  const productUrl = process.argv[2];
  if (!productUrl) {
    throw new Error(
      "Usage: npm run catalogue:observe -- https://www.bobbies.com/en/...html",
    );
  }

  const databasePath =
    process.env.CATALOGUE_DB_PATH ??
    resolve("catalogue-service/data/wist.sqlite");
  const profiles = new SqliteStyleProfileRepository(databasePath);
  const repository = new SqliteCatalogueRepository(databasePath, {
    dropThreshold: () => profiles.getDropThreshold(),
  });

  try {
    const { brand, item } = await fetchProductObservation(
      productUrl,
      createDefaultPoliteFetch(),
    );
    const result = await repository.recordObservation(brand, item);
    console.log(JSON.stringify(result, null, 2));
  } finally {
    repository.close();
    profiles.close();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error(`Product observation failed: ${message}`);
  process.exitCode = 1;
});

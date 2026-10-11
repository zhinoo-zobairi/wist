import { createDefaultPoliteFetch } from "./politeFetch.js";
import { fetchClaudiePierlotProduct } from "./claudiePierlotProduct.js";

async function main() {
  const productUrl = process.argv[2];
  if (!productUrl) {
    throw new Error(
      "Usage: npm run catalogue:probe:claudie-pierlot -- https://de.claudiepierlot.com/de_DE/p/...",
    );
  }

  const item = await fetchClaudiePierlotProduct(productUrl, createDefaultPoliteFetch());
  console.log(JSON.stringify(item, null, 2));
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error(`Claudie Pierlot probe failed: ${message}`);
  process.exitCode = 1;
});

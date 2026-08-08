import { fetchSandroProduct } from "./sandroProduct.js";

async function main() {
  const productUrl = process.argv[2];
  if (!productUrl) {
    throw new Error(
      "Usage: npm run catalogue:probe:sandro -- https://de.sandro-paris.com/de/p/...",
    );
  }

  const item = await fetchSandroProduct(productUrl);
  console.log(JSON.stringify(item, null, 2));
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error(`Sandro probe failed: ${message}`);
  process.exitCode = 1;
});

import { fetchBobbiesProduct } from "./bobbiesProduct.js";

async function main() {
  const productUrl = process.argv[2];
  if (!productUrl) {
    throw new Error(
      "Usage: npm run catalogue:probe:bobbies -- https://www.bobbies.com/en/...html",
    );
  }

  const item = await fetchBobbiesProduct(productUrl);
  console.log(JSON.stringify(item, null, 2));
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error(`Bobbies probe failed: ${message}`);
  process.exitCode = 1;
});

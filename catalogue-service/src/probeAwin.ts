import {
  fetchAwinFeedList,
  summarizeCandidateFeeds,
} from "./awinFeedList.js";

const verifiedAdvertiserIds = new Set([
  "30299", // Sézane US
  "30297", // Sézane UK
  "83637", // Sézane CH
  "102319", // Sézane DK
  "89061", // Sandro US
]);

async function main() {
  const apiKey = process.env.AWIN_PRODUCT_FEED_API_KEY;
  if (!apiKey) {
    throw new Error("AWIN_PRODUCT_FEED_API_KEY is required");
  }

  const feeds = await fetchAwinFeedList(apiKey);
  const candidates = summarizeCandidateFeeds(feeds, verifiedAdvertiserIds);
  console.log(
    JSON.stringify(
      {
        accessibleFeedCount: feeds.length,
        candidateFeedCount: candidates.length,
        candidates,
      },
      null,
      2,
    ),
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error(`Awin probe failed: ${message}`);
  process.exitCode = 1;
});

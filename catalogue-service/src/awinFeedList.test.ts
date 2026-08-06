import { describe, expect, it, vi } from "vitest";

import {
  fetchAwinFeedList,
  parseAwinFeedList,
  summarizeCandidateFeeds,
} from "./awinFeedList.js";

const csv = [
  "Advertiser ID,Advertiser Name,Primary Region,Membership Status,Feed ID,Feed Name,Language,Vertical,Last Imported,URL",
  '30299,Sézane - US,US,Joined,9001,"Main, retail",English,Fashion,2026-08-06 10:00:00,https://feed.example/secret-key',
  "100,Another Brand,DE,Not Joined,9002,Default,German,Fashion,2026-08-05 09:00:00,",
].join("\n");

describe("Awin feed list", () => {
  it("parses quoted CSV fields", () => {
    expect(parseAwinFeedList(csv)[0]).toMatchObject({
      advertiserId: "30299",
      advertiserName: "Sézane - US",
      feedName: "Main, retail",
      primaryRegion: "US",
    });
  });

  it("fetches the feed list without exposing the key in errors", async () => {
    const fetchImpl = vi.fn(async () => new Response(csv));
    const feeds = await fetchAwinFeedList("private/key", fetchImpl);

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://productdata.awin.com/datafeed/list/apikey/private%2Fkey",
    );
    expect(feeds).toHaveLength(2);
  });

  it("returns only candidates and strips credential-bearing URLs", () => {
    const summaries = summarizeCandidateFeeds(
      parseAwinFeedList(csv),
      new Set(["30299"]),
    );

    expect(summaries).toEqual([
      expect.objectContaining({
        advertiserId: "30299",
        hasDownloadUrl: true,
      }),
    ]);
    expect(summaries[0]).not.toHaveProperty("downloadUrl");
  });
});

export type AwinFeed = {
  advertiserId: string;
  advertiserName: string;
  primaryRegion: string;
  membershipStatus: string;
  feedId: string;
  feedName: string;
  language: string;
  vertical: string;
  lastImported: string;
  downloadUrl: string;
};

export type AwinFeedSummary = Omit<AwinFeed, "downloadUrl"> & {
  hasDownloadUrl: boolean;
};

type Fetch = typeof fetch;

function parseCsv(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index];
    const next = csv[index + 1];

    if (character === '"' && quoted && next === '"') {
      field += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && next === "\n") index += 1;
      row.push(field);
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

const normalizedHeader = (value: string) =>
  value.trim().toLowerCase().replaceAll(/[^a-z0-9]/g, "");

export function parseAwinFeedList(csv: string): AwinFeed[] {
  const [headers, ...rows] = parseCsv(csv);
  if (!headers) return [];

  const indexByHeader = new Map(
    headers.map((header, index) => [normalizedHeader(header), index]),
  );
  const value = (row: string[], header: string) =>
    row[indexByHeader.get(normalizedHeader(header)) ?? -1]?.trim() ?? "";

  if (!indexByHeader.has("advertiserid") || !indexByHeader.has("feedid")) {
    throw new Error("Awin feed list is missing required columns");
  }

  return rows.map((row) => ({
    advertiserId: value(row, "Advertiser ID"),
    advertiserName: value(row, "Advertiser Name"),
    primaryRegion: value(row, "Primary Region"),
    membershipStatus: value(row, "Membership Status"),
    feedId: value(row, "Feed ID"),
    feedName: value(row, "Feed Name"),
    language: value(row, "Language"),
    vertical: value(row, "Vertical"),
    lastImported: value(row, "Last Imported"),
    downloadUrl: value(row, "URL"),
  }));
}

export async function fetchAwinFeedList(
  apiKey: string,
  fetchImpl: Fetch = fetch,
): Promise<AwinFeed[]> {
  const response = await fetchImpl(
    `https://productdata.awin.com/datafeed/list/apikey/${encodeURIComponent(apiKey)}`,
  );
  if (!response.ok) {
    throw new Error(`Awin feed list request failed with HTTP ${response.status}`);
  }
  return parseAwinFeedList(await response.text());
}

export function summarizeCandidateFeeds(
  feeds: AwinFeed[],
  advertiserIds: ReadonlySet<string>,
): AwinFeedSummary[] {
  return feeds
    .filter((feed) => advertiserIds.has(feed.advertiserId))
    .map(({ downloadUrl, ...feed }) => ({
      ...feed,
      hasDownloadUrl: downloadUrl.length > 0,
    }));
}

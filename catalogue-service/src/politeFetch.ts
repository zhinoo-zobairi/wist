type Rule = { allow: boolean; pattern: string };

function parseRules(robotsTxt: string, userAgentToken: string): Rule[] {
  const token = userAgentToken.toLowerCase();
  const specific: Rule[] = [];
  const wildcard: Rule[] = [];
  let agents: string[] = [];
  let collectingAgents = false;

  for (const rawLine of robotsTxt.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*/, "").trim();
    const separator = line.indexOf(":");
    if (separator < 0) continue;
    const field = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();

    if (field === "user-agent") {
      if (!collectingAgents) agents = [];
      agents.push(value.toLowerCase());
      collectingAgents = true;
      continue;
    }
    collectingAgents = false;
    if ((field !== "allow" && field !== "disallow") || value === "") continue;

    const rule = { allow: field === "allow", pattern: value };
    if (agents.includes(token)) specific.push(rule);
    if (agents.includes("*")) wildcard.push(rule);
  }

  return specific.length > 0 ? specific : wildcard;
}

function matchLength(pattern: string, path: string): number {
  const anchored = pattern.endsWith("$");
  const body = anchored ? pattern.slice(0, -1) : pattern;
  const expression = body
    .split("*")
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  const matches = new RegExp(`^${expression}${anchored ? "$" : ""}`).test(path);
  return matches ? body.length : -1;
}

/** Pure robots.txt check: longest matching rule wins, Allow wins a tie. */
export function isAllowedByRobots(
  robotsTxt: string,
  userAgentToken: string,
  path: string,
): boolean {
  let best = { length: -1, allow: true };
  for (const rule of parseRules(robotsTxt, userAgentToken)) {
    const length = matchLength(rule.pattern, path);
    if (length > best.length || (length === best.length && length >= 0 && rule.allow)) {
      best = { length, allow: rule.allow };
    }
  }
  return best.allow;
}

export const DEFAULT_USER_AGENT =
  "WistCatalogue/1.0 (+https://github.com/zhinoo-zobairi/wist)";

const maxRobotsBytes = 128 * 1024;

export type PoliteFetchOptions = {
  userAgent: string;
  minHostSpacingMs: number;
  robotsTtlMs: number;
  fetchImpl?: typeof fetch;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
};

async function readBoundedText(response: Response): Promise<string | undefined> {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const chunks: string[] = [];
  let bytesRead = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytesRead += value.byteLength;
    if (bytesRead > maxRobotsBytes) {
      await reader.cancel();
      return undefined;
    }
    chunks.push(decoder.decode(value, { stream: true }));
  }
  chunks.push(decoder.decode());
  return chunks.join("");
}

/**
 * A drop-in `fetch` that identifies Wist, spaces requests per host and honours
 * robots.txt. One instance per process, so every caller shares the spacing.
 */
export function createPoliteFetch(options: PoliteFetchOptions): typeof fetch {
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? Date.now;
  const sleep =
    options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const userAgentToken = options.userAgent.split(/[\s/]/)[0] ?? options.userAgent;

  const tails = new Map<string, Promise<unknown>>();
  const nextAllowedAt = new Map<string, number>();
  const robotsCache = new Map<string, { robotsTxt: string; fetchedAt: number }>();
  const robotsInFlight = new Map<string, Promise<string>>();

  // Spacing only. Never call robotsFor from inside `send`, or the chain deadlocks.
  function spaced<T>(host: string, send: () => Promise<T>): Promise<T> {
    const run = (tails.get(host) ?? Promise.resolve()).then(async () => {
      const wait = (nextAllowedAt.get(host) ?? 0) - now();
      if (wait > 0) await sleep(wait);
      try {
        return await send();
      } finally {
        nextAllowedAt.set(host, now() + options.minHostSpacingMs);
      }
    });
    tails.set(host, run.catch(() => undefined));
    return run;
  }

  function withUserAgent(input: RequestInfo | URL, init?: RequestInit): RequestInit {
    const headers = new Headers(input instanceof Request ? input.headers : undefined);
    new Headers(init?.headers).forEach((value, key) => headers.set(key, value));
    headers.set("user-agent", options.userAgent);
    return { ...init, headers };
  }

  async function downloadRobots(origin: string, host: string): Promise<string | undefined> {
    try {
      const response = await spaced(host, () =>
        fetchImpl(`${origin}/robots.txt`, {
          headers: { accept: "text/plain", "user-agent": options.userAgent },
          redirect: "error",
        }),
      );
      if (response.status === 404) return "";
      if (!response.ok) {
        await response.body?.cancel();
        return undefined;
      }
      return await readBoundedText(response);
    } catch {
      return undefined;
    }
  }

  // Returns the robots.txt text; "" (allow everything) when unreachable, which is not cached.
  async function robotsFor(origin: string, host: string): Promise<string> {
    const cached = robotsCache.get(host);
    if (cached && now() - cached.fetchedAt < options.robotsTtlMs) return cached.robotsTxt;

    const pending = robotsInFlight.get(host);
    if (pending) return pending;

    const lookup = (async () => {
      const robotsTxt = await downloadRobots(origin, host);
      if (robotsTxt === undefined) return "";
      robotsCache.set(host, { robotsTxt, fetchedAt: now() });
      return robotsTxt;
    })().finally(() => robotsInFlight.delete(host));
    robotsInFlight.set(host, lookup);
    return lookup;
  }

  return async (input, init) => {
    const url = new URL(
      typeof input === "string" ? input : input instanceof URL ? input.href : input.url,
    );
    const robotsTxt = await robotsFor(url.origin, url.hostname);
    if (!isAllowedByRobots(robotsTxt, userAgentToken, url.pathname + url.search)) {
      throw new Error(`robots_disallowed: ${url.hostname}${url.pathname}`);
    }
    return spaced(url.hostname, () => fetchImpl(input, withUserAgent(input, init)));
  };
}

/** The one configuration every process uses: the approved spacing and robots cache. */
export function createDefaultPoliteFetch(): typeof fetch {
  return createPoliteFetch({
    userAgent: process.env.CATALOGUE_USER_AGENT ?? DEFAULT_USER_AGENT,
    minHostSpacingMs: 10_000,
    robotsTtlMs: 24 * 60 * 60 * 1000,
  });
}

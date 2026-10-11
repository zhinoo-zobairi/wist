import { describe, expect, it } from "vitest";

import { createPoliteFetch, isAllowedByRobots } from "./politeFetch.js";

describe("isAllowedByRobots", () => {
  it("allows everything when the file is empty", () => {
    expect(isAllowedByRobots("", "WistCatalogue", "/p/1")).toBe(true);
  });

  it("lets a group for our own agent beat the * group", () => {
    const robots = [
      "User-agent: *",
      "Disallow: /",
      "",
      "User-agent: WistCatalogue",
      "Disallow: /private",
    ].join("\n");
    expect(isAllowedByRobots(robots, "WistCatalogue", "/p/1")).toBe(true);
    expect(isAllowedByRobots(robots, "WistCatalogue", "/private/x")).toBe(false);
    expect(isAllowedByRobots(robots, "OtherBot", "/p/1")).toBe(false);
  });

  it("lets the longest matching rule win", () => {
    const robots = "User-agent: *\nDisallow: /products\nAllow: /products/public";
    expect(isAllowedByRobots(robots, "WistCatalogue", "/products/public/1")).toBe(true);
    expect(isAllowedByRobots(robots, "WistCatalogue", "/products/secret")).toBe(false);
  });

  it("prefers Allow when a tie in length", () => {
    const robots = "User-agent: *\nDisallow: /a\nAllow: /a";
    expect(isAllowedByRobots(robots, "WistCatalogue", "/a")).toBe(true);
  });

  it("supports * and $ wildcards", () => {
    const robots = "User-agent: *\nDisallow: /*.json$\nDisallow: /cart*/x";
    expect(isAllowedByRobots(robots, "WistCatalogue", "/a/b.json")).toBe(false);
    expect(isAllowedByRobots(robots, "WistCatalogue", "/a/b.json?x=1")).toBe(true);
    expect(isAllowedByRobots(robots, "WistCatalogue", "/cart123/x")).toBe(false);
  });

  it("matches a pathological wildcard pattern in linear time", () => {
    const robots = `User-agent: *\nDisallow: /${"*a".repeat(12)}b`;
    const started = performance.now();
    expect(isAllowedByRobots(robots, "WistCatalogue", `/${"a".repeat(40)}`)).toBe(true);
    expect(isAllowedByRobots(robots, "WistCatalogue", `/${"a".repeat(40)}b`)).toBe(false);
    expect(performance.now() - started).toBeLessThan(200);
  });

  it("uses our own group even when it only has an empty Disallow", () => {
    const robots = [
      "User-agent: *",
      "Disallow: /",
      "",
      "User-agent: WistCatalogue",
      "Disallow:",
    ].join("\n");
    expect(isAllowedByRobots(robots, "WistCatalogue", "/p/1")).toBe(true);
    expect(isAllowedByRobots(robots, "OtherBot", "/p/1")).toBe(false);
  });

  it("compares rules and paths in the same percent-encoding", () => {
    const raw = "User-agent: *\nDisallow: /café";
    const encoded = "User-agent: *\nDisallow: /caf%c3%a9";
    for (const robots of [raw, encoded]) {
      expect(isAllowedByRobots(robots, "WistCatalogue", "/caf%C3%A9")).toBe(false);
      expect(isAllowedByRobots(robots, "WistCatalogue", "/café/x")).toBe(false);
      expect(isAllowedByRobots(robots, "WistCatalogue", "/cafe")).toBe(true);
    }
  });

  it("ignores comments and an empty Disallow", () => {
    const robots = "User-agent: * # everyone\nDisallow:\n# nothing";
    expect(isAllowedByRobots(robots, "WistCatalogue", "/anything")).toBe(true);
  });

  it("shares rules across stacked User-agent lines", () => {
    const robots = "User-agent: a\nUser-agent: WistCatalogue\nDisallow: /x";
    expect(isAllowedByRobots(robots, "WistCatalogue", "/x")).toBe(false);
  });
});

const USER_AGENT = "WistCatalogue/1.0 (+https://github.com/zhinoo-zobairi/wist)";

function setup(
  robots: Record<string, (init?: RequestInit) => Response | Promise<Response>> = {},
  product: (init?: RequestInit) => Response | Promise<Response> = () =>
    new Response("product", { status: 200 }),
  requestTimeoutMs?: number,
) {
  let clock = 1_000_000;
  const sleeps: number[] = [];
  const requests: { url: string; headers: Headers; init?: RequestInit }[] = [];
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    requests.push({ url, headers: new Headers(init?.headers), init });
    const parsed = new URL(url);
    if (parsed.pathname === "/robots.txt") {
      const make = robots[parsed.hostname];
      return make ? make(init) : new Response("", { status: 404 });
    }
    return product(init);
  }) as typeof fetch;
  const politeFetch = createPoliteFetch({
    userAgent: USER_AGENT,
    minHostSpacingMs: 10_000,
    robotsTtlMs: 86_400_000,
    requestTimeoutMs,
    fetchImpl,
    now: () => clock,
    sleep: async (ms) => {
      sleeps.push(ms);
      clock += ms;
    },
  });
  return { politeFetch, sleeps, requests, advance: (ms: number) => (clock += ms) };
}

const robotsRequests = (requests: { url: string }[]) =>
  requests.filter((request) => request.url.endsWith("/robots.txt"));

describe("createPoliteFetch", () => {
  it("sets the user agent and keeps the caller's other options", async () => {
    const { politeFetch, requests } = setup();
    await politeFetch("https://shop.test/p/1", {
      headers: { accept: "text/html" },
      redirect: "error",
    });
    for (const request of requests) {
      expect(request.headers.get("user-agent")).toBe(USER_AGENT);
    }
    const product = requests.find((request) => request.url === "https://shop.test/p/1")!;
    expect(product.headers.get("accept")).toBe("text/html");
    expect(product.init?.redirect).toBe("error");
  });

  it("waits at least the spacing between two requests to the same host", async () => {
    const { politeFetch, sleeps } = setup();
    await politeFetch("https://shop.test/p/1");
    await politeFetch("https://shop.test/p/2");
    expect(sleeps.length).toBeGreaterThan(0);
    expect(sleeps.every((ms) => ms >= 0)).toBe(true);
    // robots.txt, p/1, p/2 are three spaced requests: two waits of the full 10 s.
    expect(sleeps).toEqual([10_000, 10_000]);
  });

  it("does not delay requests to a different host", async () => {
    const { politeFetch, sleeps } = setup();
    await politeFetch("https://one.test/p/1");
    sleeps.length = 0;
    await politeFetch("https://two.test/p/1");
    expect(sleeps).toEqual([10_000]); // only its own robots.txt then product, no wait on one.test
  });

  it("queues concurrent calls to one host in order", async () => {
    const { politeFetch, requests } = setup();
    await Promise.all([
      politeFetch("https://shop.test/p/1"),
      politeFetch("https://shop.test/p/2"),
      politeFetch("https://shop.test/p/3"),
    ]);
    expect(requests.map((request) => new URL(request.url).pathname)).toEqual([
      "/robots.txt",
      "/p/1",
      "/p/2",
      "/p/3",
    ]);
    expect(robotsRequests(requests)).toHaveLength(1);
  });

  it("fetches robots.txt once within the TTL and again after it", async () => {
    const { politeFetch, requests, advance } = setup();
    await politeFetch("https://shop.test/p/1");
    await politeFetch("https://shop.test/p/2");
    expect(robotsRequests(requests)).toHaveLength(1);
    advance(86_400_000 + 1);
    await politeFetch("https://shop.test/p/3");
    expect(robotsRequests(requests)).toHaveLength(2);
  });

  it("throws robots_disallowed without fetching the product", async () => {
    const { politeFetch, requests } = setup({
      "shop.test": () => new Response("User-agent: *\nDisallow: /secret", { status: 200 }),
    });
    await expect(politeFetch("https://shop.test/secret/1")).rejects.toThrow(
      "robots_disallowed: shop.test/secret/1",
    );
    expect(requests.some((request) => request.url.includes("/secret"))).toBe(false);
  });

  it("allows everything when robots.txt is 404", async () => {
    const { politeFetch } = setup();
    await expect(politeFetch("https://shop.test/p/1")).resolves.toBeInstanceOf(Response);
  });

  it("treats a robots.txt 4xx other than 429 as allow-all and caches it", async () => {
    const { politeFetch, requests } = setup({
      "forbidden.test": () => new Response("User-agent: *\nDisallow: /", { status: 403 }),
      "limited.test": () => new Response("User-agent: *\nDisallow: /", { status: 429 }),
    });
    await politeFetch("https://forbidden.test/p/1");
    await politeFetch("https://forbidden.test/p/2");
    expect(robotsRequests(requests).filter((r) => r.url.includes("forbidden.test"))).toHaveLength(1);
    await politeFetch("https://limited.test/p/1");
    await politeFetch("https://limited.test/p/2");
    expect(robotsRequests(requests).filter((r) => r.url.includes("limited.test"))).toHaveLength(2);
  });

  it("allows when robots.txt is a 5xx or the network fails, and retries next time", async () => {
    const { politeFetch, requests } = setup({
      "five.test": () => new Response("User-agent: *\nDisallow: /", { status: 503 }),
      "down.test": () => {
        throw new TypeError("network down");
      },
    });
    await expect(politeFetch("https://five.test/p/1")).resolves.toBeInstanceOf(Response);
    await expect(politeFetch("https://down.test/p/1")).resolves.toBeInstanceOf(Response);
    await politeFetch("https://five.test/p/2");
    expect(robotsRequests(requests).filter((r) => r.url.includes("five.test"))).toHaveLength(2);
  });

  it("treats a robots.txt over 128 KB as unreachable", async () => {
    const { politeFetch } = setup({
      "big.test": () =>
        new Response("User-agent: *\nDisallow: /\n" + "#".repeat(128 * 1024), { status: 200 }),
    });
    await expect(politeFetch("https://big.test/p/1")).resolves.toBeInstanceOf(Response);
  });

  describe("request timeout", () => {
    const hangUntilAborted = (init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
      });

    it("gives every request a 15 second timeout signal by default", async () => {
      const { politeFetch, requests } = setup();
      await politeFetch("https://shop.test/p/1");
      expect(requests).toHaveLength(2);
      for (const request of requests) {
        expect(request.init?.signal).toBeInstanceOf(AbortSignal);
        expect(request.init?.signal?.aborted).toBe(false);
      }
    });

    it("fails a product request that does not answer in time and does not wedge the host queue", async () => {
      let calls = 0;
      const { politeFetch } = setup(
        {},
        (init) => (++calls === 1 ? hangUntilAborted(init) : new Response("ok", { status: 200 })),
        20,
      );
      await expect(politeFetch("https://shop.test/p/1")).rejects.toThrow();
      await expect(politeFetch("https://shop.test/p/2")).resolves.toBeInstanceOf(Response);
    });

    it("treats a robots.txt that times out as unreachable: allow, and ask again next time", async () => {
      const { politeFetch, requests } = setup(
        { "slow.test": hangUntilAborted },
        undefined,
        20,
      );
      await expect(politeFetch("https://slow.test/p/1")).resolves.toBeInstanceOf(Response);
      await politeFetch("https://slow.test/p/2");
      expect(robotsRequests(requests)).toHaveLength(2);
    });
  });
});

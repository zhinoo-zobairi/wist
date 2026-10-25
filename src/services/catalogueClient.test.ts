import { describe, expect, it, vi } from "vitest";

import {
  importCatalogueWatch,
  loadCatalogue,
  loadPriceDropAlerts,
  loadStyleProfile,
  loadWatches,
  saveStyleProfile,
  saveWatchSizes,
  setCatalogueWatch,
  withTimeout,
} from "./catalogueClient";

describe("catalogue client", () => {
  it("loads brands and their products from the backend", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ brands: [{ id: "bobbies", name: "Bobbies" }] }),
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            items: [
              {
                id: "bobbies-L-M24WO-OPE01",
                brandId: "bobbies",
                name: "Opéra - Iridescent Champagne",
                imageUrl: "https://images.bobbies.com/opera.jpg",
                media: [
                  {
                    type: "image",
                    url: "https://images.bobbies.com/opera.jpg",
                  },
                  {
                    type: "video",
                    url: "https://videos.bobbies.com/opera.mp4",
                  },
                ],
                variants: [
                  { id: "137", label: "39", available: false },
                  { id: "138", label: "40", available: false },
                ],
                currentPrice: 225,
                currency: "EUR",
                url: "https://www.bobbies.com/en/opera.html",
                available: true,
                observedAt: "2026-08-08T12:00:00.000Z",
                previousPrice: null,
                sourceProductId: "L-M24WO-OPE01",
              },
            ],
          }),
        ),
      );

    await expect(
      loadCatalogue(fetchImpl, "http://catalogue.test/"),
    ).resolves.toEqual({
      brands: [
        { id: "bobbies", name: "Bobbies", monogram: "B", curated: true },
      ],
      items: [
        {
          id: "bobbies-L-M24WO-OPE01",
          brandId: "bobbies",
          name: "Opéra - Iridescent Champagne",
          imageUrl: "https://images.bobbies.com/opera.jpg",
          media: [
            {
              type: "image",
              url: "https://images.bobbies.com/opera.jpg",
            },
            {
              type: "video",
              url: "https://videos.bobbies.com/opera.mp4",
            },
          ],
          variants: [
            { id: "137", label: "39", available: false },
            { id: "138", label: "40", available: false },
          ],
          currentPrice: 225,
          currency: "EUR",
          url: "https://www.bobbies.com/en/opera.html",
          available: true,
          observedAt: "2026-08-08T12:00:00.000Z",
          previousPrice: null,
          sourceProductId: "L-M24WO-OPE01",
        },
      ],
    });
    expect(fetchImpl).toHaveBeenNthCalledWith(
      1,
      "http://catalogue.test/v1/brands",
      { headers: { accept: "application/json" }, signal: expect.any(AbortSignal) },
    );
  });

  it("loads watched items with their chosen sizes over the owner token", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            itemIds: ["bobbies-L-M24WO-OPE01"],
            sizes: { "bobbies-L-M24WO-OPE01": ["40"] },
          }),
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            itemId: "bobbies-L-M24WO-OPE01",
            watched: true,
          }),
        ),
      );

    await expect(
      loadWatches(fetchImpl, "http://catalogue.test", "owner-token"),
    ).resolves.toEqual({
      itemIds: ["bobbies-L-M24WO-OPE01"],
      sizes: { "bobbies-L-M24WO-OPE01": ["40"] },
    });
    await expect(
      setCatalogueWatch(
        "bobbies-L-M24WO-OPE01",
        true,
        fetchImpl,
        "http://catalogue.test",
        "owner-token",
      ),
    ).resolves.toBeUndefined();

    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      "http://catalogue.test/v1/watches/bobbies-L-M24WO-OPE01",
      {
        headers: {
          accept: "application/json",
          authorization: "Bearer owner-token",
        },
        method: "PUT",
        signal: expect.any(AbortSignal),
      },
    );
  });

  it("defaults to no sizes when the backend omits the map", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ itemIds: ["bobbies-L-M24WO-OPE01"] })),
    );

    await expect(
      loadWatches(fetchImpl, "http://catalogue.test", "owner-token"),
    ).resolves.toEqual({
      itemIds: ["bobbies-L-M24WO-OPE01"],
      sizes: {},
    });
  });

  it("replaces the sizes a watch cares about", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({ itemId: "bobbies-L-M24WO-OPE01", watched: true }),
      ),
    );

    await expect(
      saveWatchSizes(
        "bobbies-L-M24WO-OPE01",
        ["40"],
        fetchImpl,
        "http://catalogue.test",
        "owner-token",
      ),
    ).resolves.toBeUndefined();
    expect(fetchImpl).toHaveBeenCalledWith(
      "http://catalogue.test/v1/watches/bobbies-L-M24WO-OPE01",
      {
        body: JSON.stringify({ sizes: ["40"] }),
        headers: {
          accept: "application/json",
          authorization: "Bearer owner-token",
          "content-type": "application/json",
        },
        method: "PUT",
        signal: expect.any(AbortSignal),
      },
    );
  });

  it("imports a product URL directly into the watch list", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          itemId: "sandro-SFPRO00001",
          watched: true,
        }),
        { status: 201 },
      ),
    );

    await expect(
      importCatalogueWatch(
        "https://de.sandro-paris.com/de/p/tweed-kleid/SFPRO00001.html",
        fetchImpl,
        "http://catalogue.test/",
        "owner-token",
      ),
    ).resolves.toBe("sandro-SFPRO00001");
    expect(fetchImpl).toHaveBeenCalledWith("http://catalogue.test/v1/watches", {
      body: JSON.stringify({
        url: "https://de.sandro-paris.com/de/p/tweed-kleid/SFPRO00001.html",
      }),
      headers: {
        accept: "application/json",
        authorization: "Bearer owner-token",
        "content-type": "application/json",
      },
      method: "POST",
      signal: expect.any(AbortSignal),
    });
  });

  it("surfaces the backend explanation when product import fails", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          error: "product_import_failed",
          message: "URL must be a supported product page",
        }),
        { status: 422 },
      ),
    );

    await expect(
      importCatalogueWatch(
        "https://example.com/product",
        fetchImpl,
        "http://catalogue.test",
        "owner-token",
      ),
    ).rejects.toThrow("URL must be a supported product page");
  });

  it.each([
    [
      "robots_disallowed",
      "This shop asks automated tools not to read this page, so Wist can't watch it.",
    ],
    [
      "storefront_timeout",
      "This shop didn't answer in time. Please try again later.",
    ],
  ])("explains a %s import failure in plain words", async (code, copy) => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ error: code }), { status: 422 }),
    );

    await expect(
      importCatalogueWatch(
        "https://example.com/product",
        fetchImpl,
        "http://catalogue.test",
        "owner-token",
      ),
    ).rejects.toThrow(copy);
  });

  it("loads price-drop alerts with the owner bearer token", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          alerts: [
            {
              id: "price-drop-1",
              itemId: "bobbies-L-M24WO-OPE01",
              oldPrice: 225,
              newPrice: 180,
              currency: "EUR",
              pctOff: 20,
              observedAt: "2026-08-15T12:00:00.000Z",
            },
          ],
        }),
      ),
    );

    await expect(
      loadPriceDropAlerts(fetchImpl, "http://catalogue.test", "owner-token"),
    ).resolves.toEqual([
      {
        id: "price-drop-1",
        userId: "local-user",
        itemId: "bobbies-L-M24WO-OPE01",
        oldPrice: 225,
        newPrice: 180,
        pctOff: 20,
        createdAt: "2026-08-15T12:00:00.000Z",
        read: false,
      },
    ]);
    expect(fetchImpl).toHaveBeenCalledWith("http://catalogue.test/v1/alerts", {
      headers: {
        accept: "application/json",
        authorization: "Bearer owner-token",
      },
      signal: expect.any(AbortSignal),
    });
  });

  it("loads and replaces the owner style profile", async () => {
    const profile = {
      occasions: ["work", "travel"],
      styles: ["minimal", "bold"],
      updatedAt: "2026-08-21T12:00:00.000Z",
    };
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ profile })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ profile })));

    await expect(
      loadStyleProfile(fetchImpl, "http://catalogue.test", "owner-token"),
    ).resolves.toEqual(profile);
    await expect(
      saveStyleProfile(
        ["work", "travel"],
        ["minimal", "bold"],
        fetchImpl,
        "http://catalogue.test",
        "owner-token",
      ),
    ).resolves.toEqual(profile);

    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      "http://catalogue.test/v1/profile",
      {
        body: JSON.stringify({
          occasions: ["work", "travel"],
          styles: ["minimal", "bold"],
        }),
        headers: {
          accept: "application/json",
          authorization: "Bearer owner-token",
          "content-type": "application/json",
        },
        method: "PUT",
        signal: expect.any(AbortSignal),
      },
    );
  });

  it("distinguishes an unanswered profile and rejects invalid selections", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ profile: null })),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            profile: {
              occasions: ["unknown"],
              styles: [],
              updatedAt: "2026-08-21T12:00:00.000Z",
            },
          }),
        ),
      );

    await expect(
      loadStyleProfile(fetchImpl, "http://catalogue.test", "owner-token"),
    ).resolves.toBeNull();
    await expect(
      loadStyleProfile(fetchImpl, "http://catalogue.test", "owner-token"),
    ).rejects.toThrow("invalid style profile selections");
  });
});

describe("withTimeout", () => {
  it("passes the caller's init through with an abort signal and clears the timer on success", async () => {
    vi.useFakeTimers();
    try {
      const fetchImpl = vi.fn().mockResolvedValue(new Response("{}"));
      await withTimeout(fetchImpl, 10_000)("http://catalogue.test/v1/brands", {
        headers: { accept: "application/json" },
      });
      expect(fetchImpl).toHaveBeenCalledExactlyOnceWith("http://catalogue.test/v1/brands", {
        headers: { accept: "application/json" },
        signal: expect.any(AbortSignal),
      });
      const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
      expect(init.signal?.aborted).toBe(false);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("aborts a request that has not answered after the timeout", async () => {
    vi.useFakeTimers();
    try {
      const fetchImpl = vi.fn(
        (_input: RequestInfo | URL, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
          }),
      );
      const pending = withTimeout(fetchImpl, 10_000)("http://catalogue.test/v1/alerts");
      const outcome = expect(pending).rejects.toThrow("aborted");
      await vi.advanceTimersByTimeAsync(9_999);
      expect(vi.getTimerCount()).toBe(1);
      await vi.advanceTimersByTimeAsync(1);
      await outcome;
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});

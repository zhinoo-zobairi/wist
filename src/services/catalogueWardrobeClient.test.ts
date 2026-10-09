import { afterEach, describe, expect, it, vi } from "vitest";
import type { Garment } from "../types";
import {
  deleteGarment, garmentPhotoSource, loadWardrobe, retagGarment, saveGarment,
  UncertainWardrobeRequestError, uploadGarmentPhoto, WardrobeApiError,
} from "./catalogueClient";

const garment: Garment = {
  id: "01234567-1234-1234-1234-012345678901", name: "Navy shirt", category: "top",
  colors: ["navy"], formality: "smart_casual", warmth: "light", occasions: ["work"],
  notes: null, source: "photo", tagStatus: "tagged",
  photoUrl: "/v1/wardrobe/01234567-1234-1234-1234-012345678901/photo",
  createdAt: "2026-10-10T10:00:00.000Z", updatedAt: "2026-10-10T10:00:00.000Z",
};
const base = "http://localhost:4000/";
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });

afterEach(() => vi.useRealTimers());

describe("wardrobe client", () => {
  it("loads authenticated records and rejects duplicates or invalid vocabulary", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(json({ garments: [garment] }));
    expect(await loadWardrobe(fetchImpl, base, "owner")).toEqual([garment]);
    expect(fetchImpl).toHaveBeenCalledWith("http://localhost:4000/v1/wardrobe", {
      headers: { accept: "application/json", authorization: "Bearer owner" },
    });
    fetchImpl.mockResolvedValueOnce(json({ garments: [garment, garment] }));
    await expect(loadWardrobe(fetchImpl, base, "owner")).rejects.toThrow("duplicate");
    for (const invalid of [
      { category: "hat" }, { colors: [] }, { colors: ["navy", "navy"] },
      { colors: ["NAVY"] }, { warmth: "warm" }, { occasions: ["work", "work"] },
      { tagStatus: "pending" }, { notes: "x".repeat(281) },
      { photoUrl: "https://example.com/photo" }, { createdAt: "yesterday" },
    ]) {
      fetchImpl.mockResolvedValueOnce(json({ garments: [{ ...garment, ...invalid }] }));
      await expect(loadWardrobe(fetchImpl, base, "owner")).rejects.toThrow();
    }
  });

  it("reads a local URI without credentials and posts raw JPEG bytes", async () => {
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3])))
      .mockResolvedValueOnce(json({ garment }, 201));
    expect(await uploadGarmentPhoto("file:///photo.jpg", fetchImpl, base, "owner")).toEqual(garment);
    expect(fetchImpl.mock.calls[0]?.[1]).not.toHaveProperty("headers");
    const [url, options] = fetchImpl.mock.calls[1]!;
    expect(url).toBe("http://localhost:4000/v1/wardrobe/photos");
    expect(options).toMatchObject({ method: "POST", headers: {
      authorization: "Bearer owner", "content-type": "image/jpeg",
    } });
    expect([...new Uint8Array(await (options?.body as Blob).arrayBuffer())]).toEqual([1, 2, 3]);
  });

  it("preserves error codes and does not retry rejected uploads", async () => {
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("photo"))
      .mockResolvedValueOnce(json({ error: "wardrobe_full" }, 409));
    await expect(uploadGarmentPhoto("file:///photo.jpg", fetchImpl, base, "owner"))
      .rejects.toMatchObject({ code: "wardrobe_full", status: 409 });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it.each(["network", "timeout"])("reports %s upload failure as uncertain without re-uploading", async (failure) => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response("photo"));
    fetchImpl.mockImplementationOnce(async (_url, options) => {
      if (failure === "network") throw new TypeError("Network request failed");
      return new Promise((_resolve, reject) => {
        options?.signal?.addEventListener("abort", () => reject(new Error("AbortError")));
      });
    });
    const result = uploadGarmentPhoto("file:///photo.jpg", fetchImpl, base, "owner");
    const assertion = expect(result).rejects.toBeInstanceOf(UncertainWardrobeRequestError);
    if (failure === "timeout") await vi.advanceTimersByTimeAsync(90_000);
    await assertion;
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("uses PUT and DELETE and validates the authoritative results", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(json({ garment }));
    expect(await saveGarment(garment.id, garment, fetchImpl, base, "owner")).toEqual(garment);
    expect(fetchImpl.mock.calls[0]).toMatchObject([
      `http://localhost:4000/v1/wardrobe/${garment.id}`, { method: "PUT", body: JSON.stringify(garment) },
    ]);
    fetchImpl.mockResolvedValueOnce(json({ id: garment.id, deleted: true }));
    await deleteGarment(garment.id, fetchImpl, base, "owner");
    expect(fetchImpl.mock.calls[1]?.[1]?.method).toBe("DELETE");
    fetchImpl.mockResolvedValueOnce(json({ id: "other", deleted: true }));
    await expect(deleteGarment(garment.id, fetchImpl, base, "owner")).rejects.toThrow("invalid deletion");
  });

  it("sends explicit force and clears the retag deadline on success or rejection", async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(json({ garment }));
    await retagGarment(garment.id, true, fetchImpl, base, "owner");
    expect(fetchImpl.mock.calls[0]).toMatchObject([
      `http://localhost:4000/v1/wardrobe/${garment.id}/tag`, { method: "POST", body: '{"force":true}' },
    ]);
    expect(vi.getTimerCount()).toBe(0);
    fetchImpl.mockResolvedValueOnce(json({ error: "already_tagged" }, 409));
    await expect(retagGarment(garment.id, false, fetchImpl, base, "owner")).rejects.toBeInstanceOf(WardrobeApiError);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("aborts retag at 90 seconds without retrying", async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async (_url, options) =>
      new Promise((_resolve, reject) => {
        options?.signal?.addEventListener("abort", () => reject(new Error("AbortError")));
      }),
    );
    const result = retagGarment(garment.id, false, fetchImpl, base, "owner");
    const assertion = expect(result).rejects.toBeInstanceOf(UncertainWardrobeRequestError);
    await vi.advanceTimersByTimeAsync(90_000);
    await assertion;
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("attaches photo credentials only to the matching backend route", () => {
    expect(garmentPhotoSource(garment, base, "owner")).toEqual({
      uri: `http://localhost:4000${garment.photoUrl}`, headers: { authorization: "Bearer owner" },
    });
    expect(garmentPhotoSource({ ...garment, photoUrl: null }, base, "owner")).toBeUndefined();
    expect(() => garmentPhotoSource({ ...garment, photoUrl: "https://example.com" }, base, "owner")).toThrow();
    expect(() => garmentPhotoSource(garment, base, "")).toThrow("OWNER_TOKEN");
  });
});

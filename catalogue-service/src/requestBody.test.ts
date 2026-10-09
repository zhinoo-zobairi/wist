import { Readable } from "node:stream";
import { describe, expect, it } from "vitest";
import { MAX_PHOTO_BYTES } from "./garmentPhotoStore.js";
import { MAX_JSON_BODY_BYTES, readRequestBody } from "./requestBody.js";

describe("bounded request bodies", () => {
  it("preserves image bytes across chunks without UTF-8 conversion", async () => {
    const chunks = [Buffer.from([0, 255]), Buffer.from([128, 195, 169])];
    await expect(readRequestBody(Readable.from(chunks), MAX_PHOTO_BYTES))
      .resolves.toEqual({ bodyBytes: Buffer.concat(chunks) });
  });

  it.each([MAX_JSON_BODY_BYTES, MAX_PHOTO_BYTES])("accepts exactly %d bytes and rejects one extra", async (limit) => {
    const bytes = Buffer.alloc(limit, 255);
    const result = await readRequestBody(Readable.from([bytes]), limit);
    expect(result.bodyTooLarge).toBeUndefined();
    expect(result.bodyBytes?.equals(bytes)).toBe(true);
    await expect(readRequestBody(Readable.from([Buffer.alloc(limit), Buffer.from([1])]), limit))
      .resolves.toEqual({ bodyTooLarge: true });
  });

  it("rejects a large declared length before touching the stream", async () => {
    async function* request() { throw new Error("Must not consume body"); yield Buffer.alloc(1); }
    await expect(readRequestBody(request(), MAX_PHOTO_BYTES, String(MAX_PHOTO_BYTES + 1)))
      .resolves.toEqual({ bodyTooLarge: true });
  });

  it("counts bytes for multibyte text and discards all chunks after overflow", async () => {
    await expect(readRequestBody(Readable.from(["é", "a", "b", "c"]), 2))
      .resolves.toEqual({ bodyTooLarge: true });
  });
});

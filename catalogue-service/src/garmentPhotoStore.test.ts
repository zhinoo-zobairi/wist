import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { DiskGarmentPhotoStore, PHOTO_MEDIA_TYPES } from "./garmentPhotoStore.js";

describe("disk garment photos", () => {
  const directories: string[] = [];
  afterEach(async () => {
    for (const directory of directories.splice(0)) await rm(directory, { recursive: true, force: true });
  });
  async function setup() {
    const directory = await mkdtemp(join(tmpdir(), "wist-photos-"));
    directories.push(directory);
    return new DiskGarmentPhotoStore(join(directory, "wardrobe-photos"));
  }

  it.each(PHOTO_MEDIA_TYPES)("round-trips %s without changing bytes and removes it", async (mediaType) => {
    const store = await setup();
    const id = randomUUID();
    const bytes = Buffer.from([0, 255, 128, 1, 2, 3]);
    await store.write(id, mediaType, bytes);
    await expect(store.read(id, mediaType)).resolves.toEqual(bytes);
    await store.remove(id);
    await expect(store.read(id, mediaType)).resolves.toBeNull();
    await expect(store.remove(id)).resolves.toBeUndefined();
  });

  it("does not overwrite an existing photo", async () => {
    const store = await setup();
    const id = randomUUID();
    await store.write(id, "image/jpeg", Buffer.from("first"));
    await expect(store.write(id, "image/jpeg", Buffer.from("second"))).rejects.toThrow();
    await expect(store.read(id, "image/jpeg")).resolves.toEqual(Buffer.from("first"));
  });

  it.each(["../secret", "/tmp/secret", "not-a-uuid", "__proto__"])("rejects unsafe ids: %s", async (id) => {
    const store = await setup();
    await expect(store.write(id, "image/jpeg", Buffer.from("photo"))).rejects.toThrow("Invalid garment UUID");
    await expect(store.read(id, "image/jpeg")).rejects.toThrow("Invalid garment UUID");
    await expect(store.remove(id)).rejects.toThrow("Invalid garment UUID");
  });

  it("uses only the fixed media-type extension map", async () => {
    const store = await setup();
    await expect(store.write(randomUUID(), "../../secret", Buffer.from("photo")))
      .rejects.toThrow("Unsupported photo media type");
  });
});

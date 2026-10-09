import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

export const PHOTO_MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type PhotoMediaType = (typeof PHOTO_MEDIA_TYPES)[number];
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const EXTENSIONS: Record<PhotoMediaType, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp",
};

export interface GarmentPhotoStore {
  write(garmentId: string, mediaType: string, bytes: Buffer): Promise<void>;
  read(garmentId: string, mediaType: string): Promise<Buffer | null>;
  remove(garmentId: string): Promise<void>;
}

export class DiskGarmentPhotoStore implements GarmentPhotoStore {
  constructor(private readonly directory: string) {}

  private path(garmentId: string, mediaType: string): string {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(garmentId)) {
      throw new Error("Invalid garment UUID");
    }
    if (!PHOTO_MEDIA_TYPES.includes(mediaType as PhotoMediaType)) {
      throw new Error("Unsupported photo media type");
    }
    return join(this.directory, `${garmentId}.${EXTENSIONS[mediaType as PhotoMediaType]}`);
  }

  async write(garmentId: string, mediaType: string, bytes: Buffer): Promise<void> {
    const path = this.path(garmentId, mediaType);
    await mkdir(this.directory, { recursive: true });
    await writeFile(path, bytes, { flag: "wx" });
  }

  async read(garmentId: string, mediaType: string): Promise<Buffer | null> {
    try {
      return await readFile(this.path(garmentId, mediaType));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }

  async remove(garmentId: string): Promise<void> {
    for (const mediaType of PHOTO_MEDIA_TYPES) {
      try {
        await unlink(this.path(garmentId, mediaType));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
    }
  }
}

import { readFile } from "node:fs/promises";
import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";

import { ImglyCutoutMaker, normaliseCutout } from "./imglyCutoutMaker.js";

const transparent = { r: 0, g: 0, b: 0, alpha: 0 };

/** A 300 × 100 transparent image with an opaque red block at x 50–249, y 20–79. */
async function subjectWithMargins(): Promise<Buffer> {
  const block = await sharp({ create: { width: 200, height: 60, channels: 4, background: { r: 200, g: 0, b: 0, alpha: 1 } } }).png().toBuffer();
  return sharp({ create: { width: 300, height: 100, channels: 4, background: transparent } })
    .composite([{ input: block, left: 50, top: 20 }]).png().toBuffer();
}

async function pixel(png: Buffer, x: number, y: number): Promise<number[]> {
  const { data } = await sharp(png).extract({ left: x, top: y, width: 1, height: 1 }).raw().toBuffer({ resolveWithObject: true });
  return [...data];
}

describe("cutout normalisation", () => {
  it("trims the subject and centres it on a transparent 4:5 canvas with a margin", async () => {
    const result = await normaliseCutout(await subjectWithMargins());
    expect(result).not.toBeNull();
    const meta = await sharp(result!).metadata();
    expect([meta.width, meta.height, meta.hasAlpha, meta.format]).toEqual([1024, 1280, true, "png"]);
    // The 200 × 60 block fills the 896 px inner width, so it spans x 64–959 around y 640.
    expect(await pixel(result!, 512, 640)).toEqual([200, 0, 0, 255]);
    expect((await pixel(result!, 58, 640))[3]).toBe(0);
    expect((await pixel(result!, 72, 640))[3]).toBe(255);
    expect((await pixel(result!, 965, 640))[3]).toBe(0);
    expect((await pixel(result!, 512, 300))[3]).toBe(0);
  });

  it("returns null when nothing opaque is left", async () => {
    const empty = await sharp({ create: { width: 100, height: 100, channels: 4, background: transparent } }).png().toBuffer();
    await expect(normaliseCutout(empty)).resolves.toBeNull();
  });
});

describe("img.ly cutout maker", () => {
  it("reports a model failure instead of throwing", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const maker = new ImglyCutoutMaker({ removeBackground: async () => { throw new Error("onnx exploded"); } });
    await expect(maker.cut(Buffer.from([1, 2, 3]), "image/jpeg")).resolves.toEqual({ ok: false, reason: "model_error" });
  });

  it("reports an empty result when the model keeps nothing", async () => {
    const empty = await sharp({ create: { width: 10, height: 10, channels: 4, background: transparent } }).png().toBuffer();
    const maker = new ImglyCutoutMaker({ removeBackground: async () => new Blob([empty], { type: "image/png" }) });
    await expect(maker.cut(Buffer.from([1, 2, 3]), "image/jpeg")).resolves.toEqual({ ok: false, reason: "empty" });
  });

  it("hands the model a blob of the photo's media type and normalises what comes back", async () => {
    const seen: Blob[] = [];
    const maker = new ImglyCutoutMaker({ removeBackground: async (image) => { seen.push(image as Blob); return new Blob([await subjectWithMargins()], { type: "image/png" }); } });
    const result = await maker.cut(Buffer.from([1, 2, 3]), "image/webp");
    expect(result.ok).toBe(true);
    expect(seen[0]?.type).toBe("image/webp");
    expect(seen[0]?.size).toBe(3);
    const meta = await sharp((result as { png: Buffer }).png).metadata();
    expect([meta.width, meta.height]).toEqual([1024, 1280]);
  });

  // Loads the real ~80 MB model: CUTOUT_PROBE=1 npx vitest run catalogue-service/src/imglyCutoutMaker.test.ts
  it.runIf(process.env.CUTOUT_PROBE === "1")("cuts a real photo with the bundled model", async () => {
    const photo = await readFile(new URL("../../assets/editorial/covet.jpg", import.meta.url));
    const result = await new ImglyCutoutMaker().cut(photo, "image/jpeg");
    expect(result.ok).toBe(true);
    const meta = await sharp((result as { png: Buffer }).png).metadata();
    expect([meta.width, meta.height, meta.hasAlpha]).toEqual([1024, 1280, true]);
  }, 120_000);
});

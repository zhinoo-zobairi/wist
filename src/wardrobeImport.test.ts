import { describe, expect, it, vi } from "vitest";
import { importGarmentPhotos, importSelectionLimit } from "./wardrobeImport";

describe("importGarmentPhotos", () => {
  it("uploads one photo after another and reports progress before each", async () => {
    const order: string[] = [];
    const progress: Array<{ done: number; total: number }> = [];
    let running = 0;
    let peak = 0;
    const upload = async (item: string) => {
      running += 1; peak = Math.max(peak, running); order.push(item);
      await new Promise((resolve) => setTimeout(resolve, 1));
      running -= 1;
    };
    const outcome = await importGarmentPhotos(["a", "b", "c"], upload, { onProgress: (step) => progress.push(step) });
    expect(outcome).toEqual({ added: 3, failed: 0, stoppedBy: undefined });
    expect(order).toEqual(["a", "b", "c"]);
    expect(peak).toBe(1);
    expect(progress).toEqual([{ done: 0, total: 3 }, { done: 1, total: 3 }, { done: 2, total: 3 }]);
  });

  it("counts a failed photo, logs why, and carries on", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const upload = vi.fn<(item: number) => Promise<void>>()
      .mockResolvedValueOnce(undefined).mockRejectedValueOnce(new TypeError("bad")).mockResolvedValueOnce(undefined);
    await expect(importGarmentPhotos([1, 2, 3], upload)).resolves.toEqual({ added: 2, failed: 1, stoppedBy: undefined });
    expect(upload).toHaveBeenCalledTimes(3);
    expect(warn).toHaveBeenCalledWith("Garment import failed", { index: 1, errorClass: "TypeError", message: "bad" });
    warn.mockRestore();
  });

  it("stops at the first error the caller calls final and reports it", async () => {
    const full = new Error("full");
    const upload = vi.fn<(item: number) => Promise<void>>()
      .mockResolvedValueOnce(undefined).mockRejectedValueOnce(full).mockResolvedValueOnce(undefined);
    await expect(importGarmentPhotos([1, 2, 3], upload, { stopWhen: (error) => error === full }))
      .resolves.toEqual({ added: 1, failed: 1, stoppedBy: full });
    expect(upload).toHaveBeenCalledTimes(2);
  });
});

describe("importSelectionLimit", () => {
  it("allows at most 20 per batch and never past the 300-garment wardrobe", () => {
    expect(importSelectionLimit(0)).toBe(20);
    expect(importSelectionLimit(290)).toBe(10);
    expect(importSelectionLimit(300)).toBe(0);
    expect(importSelectionLimit(305)).toBe(0);
  });
});

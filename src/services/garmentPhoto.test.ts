import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ImagePickerAsset } from "expo-image-picker";
const mock = vi.hoisted(() => ({
  resize: vi.fn(), renderAsync: vi.fn(), saveAsync: vi.fn(),
  releaseContext: vi.fn(), releaseImage: vi.fn(), manipulate: vi.fn(),
}));
vi.mock("expo-image-manipulator", () => ({
  ImageManipulator: { manipulate: mock.manipulate }, SaveFormat: { JPEG: "jpeg" },
}));
import { prepareGarmentPhoto } from "./garmentPhoto";

describe("garment photo preparation", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mock.manipulate.mockReturnValue({ resize: mock.resize, renderAsync: mock.renderAsync, release: mock.releaseContext });
    mock.renderAsync.mockResolvedValue({ saveAsync: mock.saveAsync, release: mock.releaseImage });
    mock.saveAsync.mockResolvedValue({ uri: "file:///prepared.jpg" });
  });
  it.each([
    [3000, 2000, { width: 1568 }], [2000, 3000, { height: 1568 }], [1568, 1568, null], [800, 600, null],
  ])("caps the long edge of %s × %s without upscaling", async (width, height, size) => {
    expect(await prepareGarmentPhoto({ uri: "file:///original.heic", width, height } as ImagePickerAsset)).toBe("file:///prepared.jpg");
    if (size) expect(mock.resize).toHaveBeenCalledWith(size);
    else expect(mock.resize).not.toHaveBeenCalled();
    expect(mock.saveAsync).toHaveBeenCalledWith({ format: "jpeg", compress: 0.8 });
    expect(mock.releaseImage).toHaveBeenCalledTimes(1);
    expect(mock.releaseContext).toHaveBeenCalledTimes(1);
  });
  it("releases native resources on failed rendering or encoding", async () => {
    mock.renderAsync.mockRejectedValueOnce(new Error("render failed"));
    await expect(prepareGarmentPhoto({ uri: "file:///photo", width: 800, height: 600 } as ImagePickerAsset)).rejects.toThrow();
    expect(mock.releaseContext).toHaveBeenCalledTimes(1);
    mock.saveAsync.mockRejectedValueOnce(new Error("encode failed"));
    await expect(prepareGarmentPhoto({ uri: "file:///photo", width: 800, height: 600 } as ImagePickerAsset)).rejects.toThrow();
    expect(mock.releaseImage).toHaveBeenCalledTimes(1);
    expect(mock.releaseContext).toHaveBeenCalledTimes(2);
  });
});

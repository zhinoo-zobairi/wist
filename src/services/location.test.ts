import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ permission: vi.fn(), position: vi.fn(), background: vi.fn(), watch: vi.fn() }));
vi.mock("expo-location", () => ({
  requestForegroundPermissionsAsync: mock.permission, getCurrentPositionAsync: mock.position,
  requestBackgroundPermissionsAsync: mock.background, watchPositionAsync: mock.watch,
  Accuracy: { Balanced: 3 },
}));
import { currentCoarseLocation } from "./location";

beforeEach(() => { vi.resetAllMocks(); vi.useFakeTimers(); });
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

describe("current coarse location", () => {
  it("requests foreground permission once, uses balanced accuracy and returns only rounded coordinates", async () => {
    mock.permission.mockResolvedValueOnce({ granted: true });
    mock.position.mockResolvedValueOnce({
      coords: { latitude: 52.5249, longitude: 13.4051, altitude: 100, accuracy: 3, heading: 20 }, timestamp: 1234,
    });
    await expect(currentCoarseLocation()).resolves.toEqual({ latitude: 52.52, longitude: 13.41 });
    expect(mock.permission).toHaveBeenCalledTimes(1);
    expect(mock.position).toHaveBeenCalledExactlyOnceWith({ accuracy: 3 });
    expect(mock.background).not.toHaveBeenCalled();
    expect(mock.watch).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("returns null on denied permission without reading a position", async () => {
    mock.permission.mockResolvedValueOnce({ granted: false });
    await expect(currentCoarseLocation()).resolves.toBeNull();
    expect(mock.position).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("returns null on permission and position errors without retrying", async () => {
    mock.permission.mockRejectedValueOnce(new Error("permission unavailable"));
    await expect(currentCoarseLocation()).resolves.toBeNull();
    expect(mock.position).not.toHaveBeenCalled();
    mock.permission.mockResolvedValueOnce({ granted: true });
    mock.position.mockRejectedValueOnce(new Error("GPS unavailable"));
    await expect(currentCoarseLocation()).resolves.toBeNull();
    expect(mock.position).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([[NaN, 13], [91, 13], [52, Infinity], [52, -181]])(
    "returns null for invalid device coordinates (%j, %j)", async (latitude, longitude) => {
      mock.permission.mockResolvedValueOnce({ granted: true });
      mock.position.mockResolvedValueOnce({ coords: { latitude, longitude } });
      await expect(currentCoarseLocation()).resolves.toBeNull();
    },
  );

  it("rounds negative coordinates and accepts inclusive bounds", async () => {
    mock.permission.mockResolvedValue({ granted: true });
    mock.position.mockResolvedValueOnce({ coords: { latitude: -33.8688, longitude: -151.2093 } });
    await expect(currentCoarseLocation()).resolves.toEqual({ latitude: -33.87, longitude: -151.21 });
    mock.position.mockResolvedValueOnce({ coords: { latitude: -90, longitude: 180 } });
    await expect(currentCoarseLocation()).resolves.toEqual({ latitude: -90, longitude: 180 });
  });

  it("returns null after 10 seconds and ignores a late native position", async () => {
    mock.permission.mockResolvedValueOnce({ granted: true });
    let finish!: (value: unknown) => void;
    mock.position.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const pending = currentCoarseLocation();
    let settled = false;
    void pending.then(() => { settled = true; });
    await vi.advanceTimersByTimeAsync(9999);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await expect(pending).resolves.toBeNull();
    finish({ coords: { latitude: 52.52, longitude: 13.41 } });
    await expect(pending).resolves.toBeNull();
    expect(mock.position).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not start a position read if the permission dialog finishes after the 10 s wait", async () => {
    let grant!: (value: unknown) => void;
    mock.permission.mockImplementationOnce(() => new Promise((resolve) => { grant = resolve; }));
    const pending = currentCoarseLocation();
    await vi.advanceTimersByTimeAsync(10_000);
    await expect(pending).resolves.toBeNull();
    grant({ granted: true });
    await Promise.resolve();
    expect(mock.position).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});

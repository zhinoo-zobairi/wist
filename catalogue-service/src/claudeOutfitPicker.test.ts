import Anthropic from "@anthropic-ai/sdk";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ClaudeOutfitPicker } from "./claudeOutfitPicker.js";
import type { PickInput } from "./outfitPicker.js";
import type { Garment } from "./wardrobe.js";

const garment: Garment = { id: "b", name: "Navy shirt", category: "top", colors: ["navy"],
  formality: "smart_casual", warmth: "light", occasions: ["work"], notes: "private notes",
  photoUrl: "/private-photo", source: "photo", catalogueItemId: null, tagStatus: "tagged", createdAt: "stamp", updatedAt: "stamp" };
const input: PickInput = {
  garments: [garment, { ...garment, id: "a", category: "outerwear", name: "Wool coat", warmth: "heavy" }],
  weather: { minC: 6, maxC: 11, precipitationChancePct: 70, maxWindKph: 20, condition: "rain" },
  outfits: [
    { id: "o1", occasion: "work", garmentIds: ["a", "b"], saved: false },
    { id: "o2", occasion: "weekend", garmentIds: ["b", "gone"], saved: true },
  ],
};
const ranking = { order: ["o1", "o2"], top: [{ id: "o1", reason: "The coat keeps the rain off." }] };
function stub(response: unknown) {
  const parse = vi.fn().mockResolvedValue(response);
  return { picker: new ClaudeOutfitPicker({ beta: { messages: { parse } } } as unknown as Anthropic), parse };
}
const fakeTransport = (stop_reason: string, text: string) => {
  const fetch = vi.fn().mockResolvedValue(Response.json({
    id: "test", type: "message", role: "assistant", model: "claude-sonnet-5-5", stop_reason, stop_sequence: null,
    content: [{ type: "text", text }], usage: { input_tokens: 100, output_tokens: 20 },
  }));
  return new Anthropic({ apiKey: "test-key", authToken: null, baseURL: "https://api.anthropic.com", fetch });
};

describe("Claude outfit picker", () => {
  beforeEach(() => { vi.spyOn(console, "error").mockImplementation(() => {}); });
  afterEach(() => { vi.restoreAllMocks(); });

  it("uses the approved policy, the cached wardrobe first, then weather and outfits", async () => {
    const { picker, parse } = stub({ stop_reason: "end_turn", parsed_output: ranking });
    await expect(picker.pick(input)).resolves.toEqual({ ok: true, ...ranking });
    const [request, options] = parse.mock.calls[0]!;
    expect(options).toEqual({ timeout: 90_000, maxRetries: 2 });
    expect(request).toMatchObject({
      model: "claude-sonnet-5-5", max_tokens: 8_000,
      betas: ["server-side-fallback-2026-07-01"], fallbacks: "default",
      output_config: { effort: "medium" },
    });
    const content = request.messages[0].content;
    expect(content).toHaveLength(3);
    const [wardrobe, weather, outfits] = content;
    expect(wardrobe.cache_control).toEqual({ type: "ephemeral", ttl: "5m" });
    expect(wardrobe.text.indexOf('"id":"a"')).toBeLessThan(wardrobe.text.indexOf('"id":"b"'));
    expect(wardrobe.text).not.toContain("private notes");
    expect(weather.cache_control).toBeUndefined();
    expect(weather.text).toContain('"condition":"rain"');
    expect(weather.text).toContain('"minC":6');
    expect(outfits.cache_control).toBeUndefined();
    expect(outfits.text).toContain('{"id":"o1","occasion":"work","garmentIds":["a","b"],"saved":false}');
    expect(outfits.text).toContain('{"id":"o2","occasion":"weekend","garmentIds":["b","gone"],"saved":true}');
  });

  it("checks refusal before reading parsed output", async () => {
    const response = { stop_reason: "refusal", get parsed_output() { throw new Error("Must not read"); } };
    await expect(stub(response).picker.pick(input)).resolves.toEqual({ ok: false, reason: "refused" });
  });

  it.each([null, {}, { order: null, top: [] }, { order: ["o1"], top: [{ id: 1, reason: "x" }] }, { order: [1], top: [] }])(
    "classifies malformed output %j", async (parsed_output) => {
      await expect(stub({ stop_reason: "end_turn", parsed_output }).picker.pick(input))
        .resolves.toEqual({ ok: false, reason: "invalid_output" });
    },
  );

  it("maps API errors without logging the payload", async () => {
    const { picker, parse } = stub(null);
    parse.mockRejectedValue(new Anthropic.APIError(500, { secret: "x" }, "boom", new Headers()));
    await expect(picker.pick(input)).resolves.toEqual({ ok: false, reason: "api_error" });
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("secret");
  });

  it.each([
    ["refusal", "I cannot help.", "refused"],
    ["end_turn", "invalid JSON", "invalid_output"],
    ["max_tokens", '{"order":["o1",', "truncated"],
  ])("handles %s through the real SDK parser with fake transport", async (stopReason, text, reason) => {
    await expect(new ClaudeOutfitPicker(fakeTransport(stopReason, text)).pick(input))
      .resolves.toEqual({ ok: false, reason });
  });

  it("validates successful output through the real SDK without network calls", async () => {
    await expect(new ClaudeOutfitPicker(fakeTransport("end_turn", JSON.stringify(ranking))).pick(input))
      .resolves.toEqual({ ok: true, ...ranking });
  });
});

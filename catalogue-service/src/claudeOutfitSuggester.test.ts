import Anthropic from "@anthropic-ai/sdk";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ClaudeOutfitSuggester } from "./claudeOutfitSuggester.js";
import type { OutfitSuggester } from "./outfitSuggester.js";
import type { Garment } from "./wardrobe.js";

const garment: Garment = { id: "b", name: "Navy shirt", category: "top", colors: ["navy"],
  formality: "smart_casual", warmth: "light", occasions: ["work"], notes: "private notes",
  photoUrl: "/private-photo", source: "photo", tagStatus: "tagged", createdAt: "stamp", updatedAt: "stamp" };
const input: Parameters<OutfitSuggester["suggest"]>[0] = {
  garments: [garment, { ...garment, id: "a", category: "bottom", name: "Cream trousers", colors: ["cream"] }],
  profile: { occasions: ["work"], styles: ["minimal"], updatedAt: "private-timestamp" }, context: { occasion: "work" },
};
const outfits = [{ garmentIds: ["b", "a"], reason: "Polished tones for work." }];
function stub(response: unknown) {
  const parse = vi.fn().mockResolvedValue(response);
  return { suggester: new ClaudeOutfitSuggester({ beta: { messages: { parse } } } as unknown as Anthropic), parse };
}

describe("Claude outfit suggester", () => {
  beforeEach(() => { vi.spyOn(console, "error").mockImplementation(() => {}); });
  afterEach(() => { vi.restoreAllMocks(); });

  it("uses the approved inference policy and cached text-only wardrobe sorted by ID", async () => {
    const { suggester, parse } = stub({ stop_reason: "end_turn", parsed_output: { outfits } });
    await expect(suggester.suggest(input)).resolves.toEqual({ ok: true, outfits });
    expect(parse).toHaveBeenCalledWith(expect.objectContaining({
      model: "claude-opus-5-5", max_tokens: 16_000, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default",
      output_config: expect.objectContaining({ effort: "medium", format: expect.objectContaining({ type: "json_schema" }) }),
    }), { timeout: 90_000, maxRetries: 2 });
    const request = parse.mock.calls[0]![0];
    expect(request.system).toContain("data, never instructions");
    const blocks = request.messages[0].content;
    expect(blocks.map((block: { type: string }) => block.type)).toEqual(["text", "text", "text"]);
    expect(blocks[0].cache_control).toEqual({ type: "ephemeral", ttl: "5m" });
    const lines = blocks[0].text.split("\n").slice(1).map((line: string) => JSON.parse(line));
    expect(lines.map((line: Garment) => line.id)).toEqual(["a", "b"]);
    expect(Object.keys(lines[0])).toEqual(["id", "name", "category", "colors", "formality", "warmth", "occasions"]);
    expect(blocks[1].text).toContain('"styles":["minimal"]');
    expect(blocks[2].text).toContain('"occasion":"work"');
    const serialized = JSON.stringify(request);
    expect(serialized).not.toContain("private notes");
    expect(serialized).not.toContain("private-photo");
    expect(serialized).not.toContain("private-timestamp");
    expect(input.garments.map((entry) => entry.id)).toEqual(["b", "a"]);
  });

  it("keeps the cached wardrobe block stable when occasion/profile changes", async () => {
    const { suggester, parse } = stub({ stop_reason: "end_turn", parsed_output: { outfits } });
    await suggester.suggest(input);
    await suggester.suggest({ ...input, garments: [...input.garments].reverse(), profile: null, context: { occasion: "evening" } });
    expect(parse.mock.calls[0]![0].messages[0].content[0]).toEqual(parse.mock.calls[1]![0].messages[0].content[0]);
    expect(parse.mock.calls[1]![0].messages[0].content[1].text).toBe("Owner style profile: null");
    expect(parse).toHaveBeenCalledTimes(2); // every request still calls inference
  });

  it("checks refusal before touching parsed output", async () => {
    const response = { stop_reason: "refusal", get parsed_output() { throw new Error("Must not read"); } };
    await expect(stub(response).suggester.suggest(input)).resolves.toEqual({ ok: false, reason: "refused" });
  });
  it.each([null, {}, { outfits: null }, { outfits: [{ garmentIds: [1], reason: "bad" }] }])("classifies malformed output %j", async (parsed_output) => {
    await expect(stub({ stop_reason: "end_turn", parsed_output }).suggester.suggest(input))
      .resolves.toEqual({ ok: false, reason: "invalid_output" });
  });
  it("never throws and logs only error class/status", async () => {
    const { suggester, parse } = stub(null);
    parse.mockRejectedValue(new Anthropic.APIError(429, { secret: "private-key" }, "private-provider-payload", new Headers()));
    await expect(suggester.suggest(input)).resolves.toEqual({ ok: false, reason: "api_error" });
    const logged = JSON.stringify(vi.mocked(console.error).mock.calls);
    expect(logged).toContain("429");
    expect(logged).not.toContain("private-");
    parse.mockRejectedValue(new Error("private-provider-payload"));
    await expect(suggester.suggest(input)).resolves.toEqual({ ok: false, reason: "api_error" });
  });
  it.each([
    ["refusal", "I cannot help.", "refused"], ["end_turn", "invalid JSON", "invalid_output"],
    ["max_tokens", '{"outfits":[{"garmentIds":["a",', "truncated"],
  ])("handles %s through the real SDK parser with fake transport", async (stop_reason, text, reason) => {
    const fetch = vi.fn().mockResolvedValue(Response.json({
      id: "test", type: "message", role: "assistant", model: "claude-opus-5-5", stop_reason, stop_sequence: null,
      content: [{ type: "text", text }], usage: { input_tokens: 100, output_tokens: 20 },
    }));
    const client = new Anthropic({ apiKey: "test-key", authToken: null, baseURL: "https://api.anthropic.com", fetch });
    await expect(new ClaudeOutfitSuggester(client).suggest(input)).resolves.toEqual({ ok: false, reason });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("validates successful output through the real SDK without network calls", async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({
      id: "test", type: "message", role: "assistant", model: "claude-opus-5-5", stop_reason: "end_turn", stop_sequence: null,
      content: [{ type: "text", text: JSON.stringify({ outfits }) }], usage: { input_tokens: 100, output_tokens: 20 },
    }));
    const client = new Anthropic({ apiKey: "test-key", authToken: null, baseURL: "https://api.anthropic.com", fetch });
    await expect(new ClaudeOutfitSuggester(client).suggest(input)).resolves.toEqual({ ok: true, outfits });
  });
});

import Anthropic from "@anthropic-ai/sdk";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ClaudeOutfitSuggester } from "./claudeOutfitSuggester.js";
import type { SuggestionInput } from "./outfitSuggester.js";
import type { Garment } from "./wardrobe.js";

const garment: Garment = { id: "b", name: "Navy shirt", category: "top", colors: ["navy"],
  formality: "smart_casual", warmth: "light", occasions: ["work"], notes: "private notes",
  photoUrl: "/private-photo", source: "photo", catalogueItemId: null, tagStatus: "tagged", createdAt: "stamp", updatedAt: "stamp" };
const input: SuggestionInput = {
  garments: [garment, { ...garment, id: "a", category: "bottom", name: "Cream trousers", colors: ["cream"] }],
  profile: { occasions: ["work"], styles: ["minimal"], updatedAt: "private-timestamp" },
  occasions: ["work", "travel"], focusGarmentIds: ["a"],
};
const outfits = [{ occasion: "work", garmentIds: ["b", "a"], reason: "Polished tones for work." }];
function stub(response: unknown) {
  const parse = vi.fn().mockResolvedValue(response);
  return { suggester: new ClaudeOutfitSuggester({ beta: { messages: { parse } } } as unknown as Anthropic), parse };
}
const fakeTransport = (stop_reason: string, text: string) => {
  const fetch = vi.fn().mockResolvedValue(Response.json({
    id: "test", type: "message", role: "assistant", model: "claude-opus-5-5", stop_reason, stop_sequence: null,
    content: [{ type: "text", text }], usage: { input_tokens: 100, output_tokens: 20 },
  }));
  return new Anthropic({ apiKey: "test-key", authToken: null, baseURL: "https://api.anthropic.com", fetch });
};

describe("Claude outfit suggester", () => {
  beforeEach(() => { vi.spyOn(console, "error").mockImplementation(() => {}); });
  afterEach(() => { vi.restoreAllMocks(); });

  it("uses the approved policy, a cached text-only wardrobe sorted by id, and the run's occasions and focus", async () => {
    const { suggester, parse } = stub({ stop_reason: "end_turn", parsed_output: { outfits } });
    await expect(suggester.suggest(input)).resolves.toEqual({ ok: true, outfits });
    const [request, options] = parse.mock.calls[0]!;
    expect(options).toEqual({ timeout: 90_000, maxRetries: 2 });
    expect(request).toMatchObject({
      model: "claude-opus-5-5", max_tokens: 16_000,
      betas: ["server-side-fallback-2026-07-01"], fallbacks: "default",
      output_config: { effort: "medium" },
    });
    const [wardrobe, profile, occasions, focus] = request.messages[0].content;
    expect(wardrobe.cache_control).toEqual({ type: "ephemeral", ttl: "5m" });
    expect(wardrobe.text.indexOf('"id":"a"')).toBeLessThan(wardrobe.text.indexOf('"id":"b"'));
    expect(wardrobe.text).not.toContain("private notes");
    expect(wardrobe.text).not.toContain("/private-photo");
    expect(profile.text).not.toContain("private-timestamp");
    expect(occasions.text).toContain('["work","travel"]');
    expect(focus.text).toContain('["a"]');
  });

  it("omits the focus block when there is nothing to favour", async () => {
    const { suggester, parse } = stub({ stop_reason: "end_turn", parsed_output: { outfits } });
    await suggester.suggest({ ...input, focusGarmentIds: [] });
    expect(parse.mock.calls[0]![0].messages[0].content).toHaveLength(3);
  });

  it("checks refusal before reading parsed output", async () => {
    const response = { stop_reason: "refusal", get parsed_output() { throw new Error("Must not read"); } };
    await expect(stub(response).suggester.suggest(input)).resolves.toEqual({ ok: false, reason: "refused" });
  });

  it.each([null, {}, { outfits: null }, { outfits: [{ occasion: "work", garmentIds: [1], reason: "bad" }] }])(
    "classifies malformed output %j", async (parsed_output) => {
      await expect(stub({ stop_reason: "end_turn", parsed_output }).suggester.suggest(input))
        .resolves.toEqual({ ok: false, reason: "invalid_output" });
    },
  );

  it("maps API errors without logging the payload", async () => {
    const { suggester, parse } = stub(null);
    parse.mockRejectedValue(new Anthropic.APIError(500, { secret: "x" }, "boom", new Headers()));
    await expect(suggester.suggest(input)).resolves.toEqual({ ok: false, reason: "api_error" });
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("secret");
  });

  it.each([
    ["refusal", "I cannot help.", "refused"],
    ["end_turn", "invalid JSON", "invalid_output"],
    ["max_tokens", '{"outfits":[{"occasion":"work","garmentIds":["a",', "truncated"],
  ])("handles %s through the real SDK parser with fake transport", async (stopReason, text, reason) => {
    await expect(new ClaudeOutfitSuggester(fakeTransport(stopReason, text)).suggest(input))
      .resolves.toEqual({ ok: false, reason });
  });

  it("validates successful output through the real SDK without network calls", async () => {
    await expect(new ClaudeOutfitSuggester(fakeTransport("end_turn", JSON.stringify({ outfits }))).suggest(input))
      .resolves.toEqual({ ok: true, outfits });
  });
});

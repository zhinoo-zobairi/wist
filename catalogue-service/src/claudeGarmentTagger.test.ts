import Anthropic from "@anthropic-ai/sdk";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ClaudeGarmentTagger } from "./claudeGarmentTagger.js";

const photo = { bytes: Buffer.from("private-image-bytes"), mediaType: "image/jpeg" as const };
const tags = {
  name: "Navy cotton shirt", category: "top", colors: [" NAVY "],
  formality: "smart_casual", warmth: "light", occasions: ["travel", "work"],
};

function stub(response: unknown) {
  const parse = vi.fn().mockResolvedValue(response);
  const client = { beta: { messages: { parse } } } as unknown as Anthropic;
  return { tagger: new ClaudeGarmentTagger(client), parse };
}

describe("Claude garment tagger", () => {
  beforeEach(() => { vi.spyOn(console, "error").mockImplementation(() => {}); });
  afterEach(() => { vi.restoreAllMocks(); });

  it("uses the approved model, effort, timeout, retry/fallback policy, and image block", async () => {
    const { tagger, parse } = stub({ stop_reason: "end_turn", parsed_output: tags });
    await expect(tagger.tag(photo)).resolves.toEqual({ ok: true, tags: {
      ...tags, colors: ["navy"], occasions: ["work", "travel"], notes: null,
    } });
    expect(parse).toHaveBeenCalledWith(expect.objectContaining({
      model: "claude-opus-5-5", max_tokens: 2000,
      betas: ["server-side-fallback-2026-07-01"], fallbacks: "default",
      output_config: expect.objectContaining({ effort: "low", format: expect.objectContaining({ type: "json_schema" }) }),
      messages: [{ role: "user", content: [
        { type: "image", source: { type: "base64", media_type: "image/jpeg", data: photo.bytes.toString("base64") } },
        { type: "text", text: "Tag this garment." },
      ] }],
    }), { timeout: 60_000, maxRetries: 2 });
  });

  it("checks refusal before reading parsed output", async () => {
    const response = { stop_reason: "refusal", get parsed_output() { throw new Error("Must not read refused output"); } };
    await expect(stub(response).tagger.tag(photo)).resolves.toEqual({ ok: false, reason: "refused" });
  });

  it.each([
    null, { ...tags, colors: ["navy", "cream", "red", "olive", "black"] },
    { ...tags, colors: ["navy", "NAVY"] }, { ...tags, name: "a".repeat(81) },
    { ...tags, category: "unknown" }, { ...tags, occasions: ["work", "work"] },
  ])("rejects output that fails schema or domain validation: %j", async (parsed_output) => {
    await expect(stub({ stop_reason: "end_turn", parsed_output }).tagger.tag(photo))
      .resolves.toEqual({ ok: false, reason: "invalid_output" });
  });

  it("maps typed API errors without logging the image, key, or error payload", async () => {
    const { tagger, parse } = stub(null);
    parse.mockRejectedValue(new Anthropic.APIError(429, { secret: "private-key" }, photo.bytes.toString("base64"), new Headers()));
    await expect(tagger.tag(photo)).resolves.toEqual({ ok: false, reason: "api_error" });
    const logged = JSON.stringify(vi.mocked(console.error).mock.calls);
    expect(logged).toContain("429");
    expect(logged).not.toContain("private-key");
    expect(logged).not.toContain(photo.bytes.toString("base64"));
  });

  it("never throws on an unexpected client failure", async () => {
    const { tagger, parse } = stub(null);
    parse.mockRejectedValue(new Error("Unexpected failure"));
    await expect(tagger.tag(photo)).resolves.toEqual({ ok: false, reason: "api_error" });
  });

  it.each([
    { stop_reason: "refusal", text: "I cannot process this image.", reason: "refused" },
    { stop_reason: "end_turn", text: "invalid JSON", reason: "invalid_output" },
    { stop_reason: "end_turn", text: JSON.stringify({ ...tags, category: "unknown" }), reason: "invalid_output" },
  ])("handles $reason through the real SDK parser without network access", async ({ stop_reason, text, reason }) => {
    const fetch = vi.fn().mockResolvedValue(Response.json({
      id: "test-message", type: "message", role: "assistant", model: "claude-opus-5-5",
      stop_reason, stop_sequence: null, content: [{ type: "text", text }],
      usage: { input_tokens: 100, output_tokens: 20 },
    }));
    const client = new Anthropic({ apiKey: "test-key", authToken: null, baseURL: "https://api.anthropic.com", fetch });
    await expect(new ClaudeGarmentTagger(client).tag(photo)).resolves.toEqual({ ok: false, reason });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

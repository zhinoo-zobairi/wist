import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

import type { GarmentTagger, TagResult } from "./garmentTagger.js";
import { OCCASIONS } from "./styleProfile.js";
import { FORMALITIES, GARMENT_CATEGORIES, WARMTHS, parseGarmentInput } from "./wardrobe.js";

const TagSchema = z.object({
  name: z.string(), category: z.enum(GARMENT_CATEGORIES), colors: z.array(z.string()),
  formality: z.enum(FORMALITIES), warmth: z.enum(WARMTHS), occasions: z.array(z.enum(OCCASIONS)),
});
const outputFormat = zodOutputFormat(TagSchema);
const safeOutputFormat = {
  ...outputFormat,
  // The SDK parses text before exposing stop_reason. A refusal or malformed
  // JSON must remain inspectable, rather than escaping as a parser exception.
  parse(text: string) {
    try { return outputFormat.parse(text); } catch { return null; }
  },
};

const TAGGING_SYSTEM_PROMPT = `Tag one owned garment in the photo. If several garments are visible, tag the most prominent one.
Use only these categories: top, bottom, dress, outerwear, shoes, bag, accessory.
Name it in 2–6 words, in sentence case: colour, material if visible, and garment type. Do not invent a material you cannot see.
Colors are 1–3 plain colour words, dominant first, such as navy, cream, or olive. Use lowercase, no hex codes, and no fashion names such as aubergine.
Formality: casual means relaxed everyday clothing; smart_casual means polished but not ceremonial; formal means suited to dress codes and formal events.
Warmth: light means breathable or thin; medium means moderate coverage or layering; heavy means insulation or cold-weather clothing.
Occasions: work means offices, meetings, and professional settings; evening means dinners, drinks, and going out; weekend means casual daytime, errands, and coffee; celebration means weddings, parties, and milestone events; travel means transit, holidays, and packing.
Choose only clearly suitable occasions; an empty array is valid.
If the photo is not a garment, still return the schema with your best guess and the name Unrecognised item. The owner can correct the result.`;

export class ClaudeGarmentTagger implements GarmentTagger {
  constructor(private readonly client: Anthropic) {}

  async tag(photo: Parameters<GarmentTagger["tag"]>[0]): Promise<TagResult> {
    try {
      const response = await this.client.beta.messages.parse({
        model: "claude-opus-5-5",
        max_tokens: 2000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: "low", format: safeOutputFormat },
        system: TAGGING_SYSTEM_PROMPT,
        messages: [{ role: "user", content: [
          { type: "image", source: { type: "base64", media_type: photo.mediaType, data: photo.bytes.toString("base64") } },
          { type: "text", text: "Tag this garment." },
        ] }],
      }, { timeout: 60_000, maxRetries: 2 });
      if (response.stop_reason === "refusal") {
        console.error("Garment tagging refused", { stopReason: response.stop_reason });
        return { ok: false, reason: "refused" };
      }
      const parsed = TagSchema.safeParse(response.parsed_output);
      const tags = parsed.success ? parseGarmentInput({ ...parsed.data, notes: null }) : null;
      if (!tags) {
        console.error("Invalid garment tagging output", { stopReason: response.stop_reason });
        return { ok: false, reason: "invalid_output" };
      }
      return { ok: true, tags };
    } catch (error) {
      console.error("Garment tagging API failed", {
        errorClass: error instanceof Error ? error.name : "UnknownError",
        status: error instanceof Anthropic.APIError ? error.status : undefined,
      });
      return { ok: false, reason: "api_error" };
    }
  }
}

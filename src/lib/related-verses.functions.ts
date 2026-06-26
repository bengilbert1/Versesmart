import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({
  reference: z.string().min(2).max(100),
  translation: z.any().optional().transform(() => "WEB" as const),
});

const Schema = z.object({
  themes: z.array(z.string()).min(1).max(3),
  related: z
    .array(
      z.object({
        reference: z.string().min(2).max(60),
        theme: z.string().min(1).max(60),
        blurb: z.string().min(1).max(160),
      }),
    )
    .min(3)
    .max(6),
});

export type RelatedVersesResult = z.infer<typeof Schema>;

const SYSTEM_PROMPT = `You are a biblical cross-reference assistant. Given a passage, identify its 3 main themes (no more, no fewer), then suggest 4-6 other Bible passages that explore those same themes. Prefer well-known, widely-studied verses. Avoid suggesting the same passage back. Each suggestion: a canonical reference (e.g. "Romans 8:28", "Psalm 23"), the theme it shares (must be one of the 3 themes), and a one-sentence blurb (max ~20 words) explaining the connection. Return JSON only.`;

export const getRelatedVerses = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }): Promise<RelatedVersesResult> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const { buildCacheKey, getCached, setCached, normaliseReference } = await import("./ai-cache.server");
    const cacheKey = buildCacheKey("relatedVerses", {
      reference: normaliseReference(data.reference),
      translation: data.translation,
    });
    const cached = await getCached<RelatedVersesResult>(cacheKey);
    if (cached) {
      try { return Schema.parse(cached); } catch { /* refetch */ }
    }

    const model = "google/gemini-2.5-flash-lite";
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `Passage: "${data.reference}" (${data.translation}). Suggest related passages exploring the same themes.`,
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "related_verses",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                themes: { type: "array", items: { type: "string" } },
                related: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      reference: { type: "string" },
                      theme: { type: "string" },
                      blurb: { type: "string" },
                    },
                    required: ["reference", "theme", "blurb"],
                  },
                },
              },
              required: ["themes", "related"],
            },
          },
        },
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("Related verses AI error:", response.status, text);
      throw new Error("Failed to fetch related verses");
    }

    const json = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = json.choices?.[0]?.message?.content;
    if (!content) throw new Error("Empty AI response");
    const { parseLooseJson } = await import("./json-repair");
    const result = Schema.parse(parseLooseJson(content));
    await setCached(cacheKey, "relatedVerses", result, { model });
    return result;
  });

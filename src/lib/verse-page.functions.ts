
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { slugToReference } from "./verse-slug";

const Input = z.object({
  slug: z.string().min(1).max(80).regex(/^[a-z0-9-]+$/),
  translation: z.any().optional().transform(() => "WEB" as const),
});

const Schema = z.object({
  verseReference: z.string(),
  verseText: z.string(),
  translation: z.string(),
  commentaries: z.array(z.object({
    author: z.string(),
    era: z.string(),
    tradition: z.string(),
    summary: z.string(),
    keyInsight: z.string(),
  })),
  commonGround: z.array(z.string()),
  contrasts: z.array(z.object({
    topic: z.string(),
    severity: z.enum(["slight", "strong"]),
    positions: z.array(z.object({ author: z.string(), view: z.string() })),
  })),
});

export type PublicCommentary = z.infer<typeof Schema>;

const SYSTEM_PROMPT = `You are a careful biblical-studies research assistant. Given a Bible passage reference and a translation, return a JSON object comparing how the most influential public-domain Christian commentators interpret it.

Use these 5 commentators: Matthew Henry, John Calvin, Charles H. Spurgeon, Albert Barnes, John Wesley. For each: 2-3 sentence faithful summary of their exegetical view + one-line key insight. Do not invent quotations.

Then: commonGround (2-4 short bullets all agree on), and contrasts (0-3 disagreements: severity "slight"|"strong", topic, positions: 2+ {author, view}).

verseText: include the verse text in the requested translation for a single verse; otherwise a concise 2-3 sentence overview. Be concise, accurate, ecumenical.

STYLE — VERY IMPORTANT:
Write so a curious 12-year-old can follow every sentence, while keeping the FULL theological idea intact. The goal of Verse Smart is to make complex, contrasting ideas easy to grasp — never to dumb them down.
- Use everyday words. Swap jargon for plain English: "justification" → "being made right with God", "atonement" → "Jesus paying the price for sin", "sovereignty" → "God being in full control".
- If a technical term truly matters, use it once and explain it in the same sentence in parentheses.
- Short sentences. Active voice. No Latin, no untranslated Greek/Hebrew.
- Keep disagreements sharp and specific — simple words, not simple ideas.
- No flowery or sermon-y language. Sound like a smart friend explaining at a coffee table.`;

async function callAI(reference: string, translation: string): Promise<PublicCommentary> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-lite",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Compare commentaries on: "${reference}". Translation: ${translation}. Return JSON only.` },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "commentary_comparison",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              verseReference: { type: "string" },
              verseText: { type: "string" },
              translation: { type: "string" },
              commentaries: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    author: { type: "string" }, era: { type: "string" }, tradition: { type: "string" },
                    summary: { type: "string" }, keyInsight: { type: "string" },
                  },
                  required: ["author", "era", "tradition", "summary", "keyInsight"],
                },
              },
              commonGround: { type: "array", items: { type: "string" } },
              contrasts: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    topic: { type: "string" },
                    severity: { type: "string", enum: ["slight", "strong"] },
                    positions: {
                      type: "array",
                      items: {
                        type: "object",
                        additionalProperties: false,
                        properties: { author: { type: "string" }, view: { type: "string" } },
                        required: ["author", "view"],
                      },
                    },
                  },
                  required: ["topic", "severity", "positions"],
                },
              },
            },
            required: ["verseReference", "verseText", "translation", "commentaries", "commonGround", "contrasts"],
          },
        },
      },
    }),
  });
  if (!response.ok) {
    const text = await response.text();
    console.error("AI error:", response.status, text);
    throw new Error("Failed to fetch commentary");
  }
  const json = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error("Empty AI response");
  const { parseLooseJson } = await import("./json-repair");
  return Schema.parse(parseLooseJson(content));
}

export const getPublicCommentary = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }): Promise<{ commentary: PublicCommentary; reference: string } | null> => {
    const parsed = slugToReference(data.slug);
    if (!parsed) return null;

    // Cache lookup
    const { data: cached } = await supabaseAdmin
      .from("verse_cache")
      .select("payload")
      .eq("slug", data.slug)
      .eq("translation", data.translation)
      .maybeSingle();

    if (cached?.payload) {
      try {
        return { commentary: Schema.parse(cached.payload), reference: parsed.reference };
      } catch {
        // fall through and refetch
      }
    }

    const commentary = await callAI(parsed.reference, data.translation);

    await supabaseAdmin.from("verse_cache").upsert({
      slug: data.slug,
      reference: parsed.reference,
      translation: data.translation,
      payload: commentary,
      updated_at: new Date().toISOString(),
    }, { onConflict: "slug,translation" });

    return { commentary, reference: parsed.reference };
  });

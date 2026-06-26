import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const CommentInput = z.object({
  author: z.string().min(1).max(120),
  era: z.string().max(120).optional().default(""),
  tradition: z.string().max(160).optional().default(""),
  sourceGroup: z.string().min(1).max(60),
  summary: z.string().min(1).max(4000),
  keyInsight: z.string().max(2000).optional().default(""),
});

const InputSchema = z.object({
  reference: z.string().min(2).max(120),
  translation: z.string().min(1).max(100),
  verseText: z.string().max(4000).optional().default(""),
  commentaries: z.array(CommentInput).min(2).max(40),
  language: z.enum(["en", "es", "fr", "de", "zh-Hans", "zh-Hant", "hi"]).default("en"),
});

const WorldviewEnum = z.enum(["guilt-innocence", "shame-honour", "fear-power"]);

const OutputSchema = z.object({
  authorAssignments: z
    .array(z.object({ author: z.string(), worldview: WorldviewEnum }))
    .max(60),
  commonGround: z
    .array(z.object({ worldview: WorldviewEnum, text: z.string() }))
    .max(15),
  contrasts: z
    .array(
      z.object({
        topic: z.string(),
        severity: z.enum(["slight", "strong"]),
        worldview: WorldviewEnum,
        positions: z
          .array(z.object({ author: z.string(), view: z.string() }))
          .min(2),
      }),
    )
    .max(12),
});

export type UnifiedComparisonResult = z.infer<typeof OutputSchema>;
export type UnifiedWorldview = z.infer<typeof WorldviewEnum>;

const SYSTEM = `You are a careful biblical-studies research assistant. You will receive short summaries of how MULTIPLE theologians from DIFFERENT historical traditions interpret one Bible passage.

Produce ONE unified cross-tradition comparison organised around THREE biblical worldviews:
  • guilt-innocence  — legal/moral frame (sin, law, justification, forgiveness)
  • shame-honour     — relational/communal frame (honour, shame, face, kinship, covenant loyalty)
  • fear-power       — spiritual-cosmic frame (powers, deliverance, victory over evil, authority)

WORLDVIEW ASSIGNMENT — STRICT RULES:
1. Assign EVERY provided author to EXACTLY ONE worldview for this verse. No author may appear in more than one worldview section.
2. Choose the worldview that best matches the themes that author actually emphasises in their commentary on THIS verse (not their general reputation).
3. If an author is roughly equally suitable for two worldviews on this verse, prefer "fear-power" first, then "shame-honour", then "guilt-innocence" — but ONLY when it does not misrepresent their commentary.
4. **Global representation is REQUIRED**: each worldview section that has any authors at all MUST include at least one Global South voice (Africa, Asia, or Latin America) when one is present in the input list. If a worldview otherwise has only Western authors, move the closest-fitting Global South author into it (without distorting their actual point) rather than leaving the section monocultural. Justice / liberation / oppression themes typically belong to "shame-honour" (communal honour, restored standing) or "guilt-innocence" (divine verdict on injustice) — choose whichever the author's own framing fits best.
5. Maintain overall balance: try to populate all three worldviews when the source material allows. Weight Global South voices equally with Western ones — do not let Western authors dominate any section by count or summary length. Do not pile every author into one worldview unless the verse genuinely demands it.

COMMON GROUND:
- 1–3 short bullets per worldview where the authors assigned to THAT worldview broadly agree. Each bullet must be tagged with the worldview it belongs to. Skip a worldview's common-ground entirely if there is nothing meaningful to say.

CONTRASTS:
- 2–6 substantive disagreements total. Each contrast belongs to ONE worldview (the lens through which the disagreement is most naturally framed).
- Positions inside a contrast may only cite authors who are assigned to THAT contrast's worldview.
- Each contrast: topic, severity ("slight" = nuance/emphasis difference, "strong" = real doctrinal disagreement), worldview, and 2–4 positions {author, view}.

WORLDVIEW-EMPHASIS WORDING (CRITICAL — do not distort meaning):
- When you write each position's "view" text and each common-ground bullet, FRAME the wording through that worldview's natural vocabulary:
    · guilt-innocence → law, guilt, righteousness, forgiveness, justification, verdict
    · shame-honour    → honour, shame, face, family/community, covenant loyalty, restoration of standing
    · fear-power      → powers, spiritual conflict, deliverance, victory, authority, freedom from bondage
- Highlight what THAT worldview naturally hears in the author's commentary, but stay faithful to the author's actual point. Do NOT invent positions the author did not hold. Do NOT add quotations.

STYLE:
- Plain language a curious 12-year-old can follow, but keep the full theological idea intact.
- Short sentences, active voice. No Latin, no untranslated Greek/Hebrew.
- Use the author names exactly as provided.
- Be concise, accurate, ecumenical. Return JSON only.`;

const jsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    authorAssignments: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          author: { type: "string" },
          worldview: { type: "string", enum: ["guilt-innocence", "shame-honour", "fear-power"] },
        },
        required: ["author", "worldview"],
      },
    },
    commonGround: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          worldview: { type: "string", enum: ["guilt-innocence", "shame-honour", "fear-power"] },
          text: { type: "string" },
        },
        required: ["worldview", "text"],
      },
    },
    contrasts: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          topic: { type: "string" },
          severity: { type: "string", enum: ["slight", "strong"] },
          worldview: { type: "string", enum: ["guilt-innocence", "shame-honour", "fear-power"] },
          positions: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                author: { type: "string" },
                view: { type: "string" },
              },
              required: ["author", "view"],
            },
          },
        },
        required: ["topic", "severity", "worldview", "positions"],
      },
    },
  },
  required: ["authorAssignments", "commonGround", "contrasts"],
};

export const synthesizeUnifiedComparison = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }): Promise<UnifiedComparisonResult> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    // Cache lookup — keyed by passage + translation + language + the set of
    // commentary inputs that drive the synthesis. Same inputs → cached result.
    const { buildCacheKey, getCached, setCached, normaliseReference } = await import("./ai-cache.server");
    const cacheKey = buildCacheKey("unifiedComparison", {
      reference: normaliseReference(data.reference),
      translation: data.translation,
      language: data.language,
      commentaries: data.commentaries.map((c) => ({
        author: c.author,
        sourceGroup: c.sourceGroup,
        summary: c.summary,
        keyInsight: c.keyInsight,
      })),
    });
    const cached = await getCached<UnifiedComparisonResult>(cacheKey);
    if (cached) {
      try { return OutputSchema.parse(cached); } catch { /* refetch */ }
    }

    const corpus = data.commentaries
      .map(
        (c) =>
          `### ${c.author}  [group: ${c.sourceGroup}; ${c.era || "—"}; ${c.tradition || "—"}]\n${c.summary}${c.keyInsight ? `\nKey insight: ${c.keyInsight}` : ""}`,
      )
      .join("\n\n");

    const authorList = data.commentaries.map((c) => `- ${c.author}`).join("\n");

    const user = `Passage: ${data.reference} (${data.translation})
${data.verseText ? `Text: "${data.verseText}"\n` : ""}
Authors to assign (each must appear in authorAssignments exactly once):
${authorList}

Below are their interpretations. Produce the unified worldview-organised comparison as specified. Frame each position's wording through the lens of its assigned worldview, without distorting the author's actual point.

${corpus}

Return JSON only.`;

    const { getLanguage, languageDirective } = await import("./languages");
    const langConfig = getLanguage(data.language);
    const directive = languageDirective(data.language, langConfig.translationName);

    const model = "google/gemini-2.5-flash-lite";
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM + directive },
          { role: "user", content: user },
        ],
        response_format: {
          type: "json_schema",
          json_schema: { name: "unified_comparison", strict: true, schema: jsonSchema },
        },
      }),
    });

    if (response.status === 429) throw new Error("Rate limit reached. Please try again in a moment.");
    if (response.status === 402) throw new Error("AI credits exhausted.");
    if (!response.ok) {
      const text = await response.text();
      console.error("Unified synthesis AI gateway error:", response.status, text);
      throw new Error("Failed to synthesize unified comparison.");
    }

    const json = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = json.choices?.[0]?.message?.content;
    if (!content) throw new Error("Empty AI response");
    const { parseLooseJson } = await import("./json-repair");
    const result = OutputSchema.parse(parseLooseJson(content));
    await setCached(cacheKey, "unifiedComparison", result, { model });
    return result;
  });

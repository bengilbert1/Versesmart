import { z } from "zod";

export const HISTORICAL_GROUPS = {
  foundational: {
    label: "Foundational Theologians",
    blurb: "Early & medieval architects of Christian thought",
    authors: ["Origen", "Augustine", "John Chrysostom", "Thomas Aquinas"],
  },
  fathers: {
    label: "Historic Church Fathers",
    blurb: "Patristic voices who shaped the creeds and councils",
    authors: [
      "Athanasius",
      "Jerome",
      "Ambrose",
      "Gregory of Nazianzus",
      "Irenaeus",
      "Tertullian",
      "Cyril of Alexandria",
    ],
  },
  reformation: {
    label: "Reformation Voices",
    blurb: "16th-century reformers who reshaped Western Christianity",
    authors: ["Martin Luther", "Huldrych Zwingli", "Philip Melanchthon", "John Knox", "William Tyndale"],
  },
} as const;

export type HistoricalGroupKey = keyof typeof HISTORICAL_GROUPS;

const InputSchema = z.object({
  reference: z.string().min(2).max(100),
  group: z.enum(["foundational", "fathers", "reformation"]),
  translation: z.any().optional().transform(() => "WEB" as const),
  environment: z.enum(["sandbox", "live"]).default("sandbox"),
  language: z.enum(["en", "es", "fr", "de", "zh-Hans", "zh-Hant", "hi"]).default("en"),
});

const Schema = z.object({
  verseReference: z.string(),
  translation: z.string(),
  commentaries: z
    .array(
      z.object({
        author: z.string(),
        era: z.string(),
        tradition: z.string(),
        summary: z.string(),
        keyInsight: z.string(),
      }),
    )
    .min(2)
    .max(10),
  commonGround: z.array(z.string()).min(1),
  contrasts: z.array(
    z.object({
      topic: z.string(),
      severity: z.enum(["slight", "strong"]),
      positions: z.array(z.object({ author: z.string(), view: z.string() })).min(2),
    }),
  ),
});

export type HistoricalCommentaryResult = z.infer<typeof Schema> & {
  group: HistoricalGroupKey;
  locked?: boolean;
};

const PLAIN_LANGUAGE_STYLE = `STYLE — VERY IMPORTANT:
Write so a curious 12-year-old can follow every sentence, while keeping the FULL theological idea intact.
- Use everyday words. Swap jargon for plain English.
- If a technical term truly matters, use it once and explain it in the same sentence in parentheses.
- Short sentences. Active voice. No Latin, no untranslated Greek/Hebrew.
- Keep disagreements sharp and specific — simple words, not simple ideas.
- No flowery or sermon-y language.`;

function systemPromptFor(group: HistoricalGroupKey): string {
  const g = HISTORICAL_GROUPS[group];
  const authorList = g.authors.map((a) => `- ${a}`).join("\n");
  return `You are a careful biblical-studies research assistant. Compare how these ${g.label} interpret a Bible passage:
${authorList}

Pick the most relevant authors (at least 2). For each: 2-3 sentence faithful summary of their actual interpretation of the passage (or their broader framework as it bears on the passage), plus a one-line key insight. Do NOT invent quotations.

Then produce:
- commonGround: 2-4 short bullets where they broadly agree.
- contrasts: 0-3 substantive disagreements among them, each with severity ("slight" or "strong"), topic, and positions array of 2+ {author, view}.

Be concise, accurate, ecumenical.

${PLAIN_LANGUAGE_STYLE}`;
}

const jsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    verseReference: { type: "string" },
    translation: { type: "string" },
    commentaries: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          author: { type: "string" },
          era: { type: "string", description: "Approximate dates the author was actively writing on Scripture, e.g. 'c. 1700–1714' or 'c. 1850s–1890s'. Prefer year ranges over century labels." },
          tradition: { type: "string" },
          summary: { type: "string" },
          keyInsight: { type: "string" },
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
  required: ["verseReference", "translation", "commentaries", "commonGround", "contrasts"],
};

export async function runHistoricalAi(
  group: HistoricalGroupKey,
  reference: string,
  translation: string,
  language: "en" | "es" | "fr" | "de" | "zh-Hans" | "zh-Hant" | "hi" = "en",
): Promise<HistoricalCommentaryResult> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

  const { buildCacheKey, getCached, setCached, normaliseReference } = await import("./ai-cache.server");
  const cacheKey = buildCacheKey("historicalCommentary", {
    group,
    reference: normaliseReference(reference),
    translation,
    language,
  });
  const cached = await getCached<HistoricalCommentaryResult>(cacheKey);
  if (cached) {
    try {
      const parsed = Schema.parse(cached);
      return { ...parsed, group, locked: false };
    } catch { /* refetch */ }
  }

  const { getLanguage, languageDirective } = await import("./languages");
  const langConfig = getLanguage(language);
  const directive = languageDirective(language, langConfig.translationName);

  const model = "google/gemini-2.5-flash-lite";
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPromptFor(group) + directive },
        {
          role: "user",
          content: `Compare ${HISTORICAL_GROUPS[group].label} on: "${reference}". Translation: ${langConfig.translationName}. Return JSON only.`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: `historical_${group}`, strict: true, schema: jsonSchema },
      },
    }),
  });

  if (response.status === 429) throw new Error("Rate limit reached. Please try again in a moment.");
  if (response.status === 402) throw new Error("AI credits exhausted.");
  if (!response.ok) {
    const text = await response.text();
    console.error("AI gateway error:", response.status, text);
    throw new Error("Failed to fetch historical commentary.");
  }

  const json = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error("Empty AI response");
  const { parseLooseJson } = await import("./json-repair");
  const parsed = Schema.parse(parseLooseJson(content));
  await setCached(cacheKey, "historicalCommentary", parsed, { model });
  return { ...parsed, group, locked: false };
}

export const compareHistoricalCommentaries = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }): Promise<HistoricalCommentaryResult> => {
    return runHistoricalAi(data.group, data.reference, data.translation, data.language);
  });

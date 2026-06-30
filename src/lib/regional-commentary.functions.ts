
import { z } from "zod";

// Curated list of countries with notable, historically recognized Christian
// theologians/commentators (broadly public-domain or safely citable). The auto
// prompt only triggers for countries on this list. The manual selector exposes
// the full list to every user.
export const REGIONAL_COUNTRIES: { code: string; name: string }[] = [
  { code: "US", name: "United States" },
  { code: "GB", name: "United Kingdom" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
  { code: "CH", name: "Switzerland" },
  { code: "NL", name: "Netherlands" },
  { code: "IT", name: "Italy" },
  { code: "ES", name: "Spain" },
  { code: "GR", name: "Greece" },
  { code: "RU", name: "Russia" },
  { code: "EG", name: "Egypt" },
  { code: "ET", name: "Ethiopia" },
  { code: "ZA", name: "South Africa" },
  { code: "KE", name: "Kenya" },
  { code: "NG", name: "Nigeria" },
  { code: "BR", name: "Brazil" },
  { code: "MX", name: "Mexico" },
  { code: "AR", name: "Argentina" },
  { code: "CA", name: "Canada" },
  { code: "AU", name: "Australia" },
  { code: "KR", name: "South Korea" },
  { code: "JP", name: "Japan" },
  { code: "CN", name: "China" },
  { code: "IN", name: "India" },
  { code: "PH", name: "Philippines" },
  { code: "IE", name: "Ireland" },
  { code: "SE", name: "Sweden" },
  { code: "NO", name: "Norway" },
  { code: "DK", name: "Denmark" },
  { code: "IL", name: "Israel" },
  { code: "GH", name: "Ghana" },
  { code: "TW", name: "Taiwan" },
  { code: "LK", name: "Sri Lanka" },
  { code: "TH", name: "Thailand" },
  { code: "PE", name: "Peru" },
  { code: "EC", name: "Ecuador" },
  { code: "PR", name: "Puerto Rico" },
  { code: "CR", name: "Costa Rica" },
];

const REGIONAL_CODE_SET = new Set(REGIONAL_COUNTRIES.map((c) => c.code));

export function countryHasTheologians(code: string | null | undefined): boolean {
  if (!code) return false;
  return REGIONAL_CODE_SET.has(code.toUpperCase());
}

export function countryName(code: string): string {
  return REGIONAL_COUNTRIES.find((c) => c.code === code.toUpperCase())?.name ?? code;
}

const InputSchema = z.object({
  reference: z.string().min(2).max(100),
  countryCode: z.string().min(2).max(3),
  translation: z.any().optional().transform(() => "WEB" as const),
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
    .max(8),
  commonGround: z.array(z.string()),
  contrasts: z.array(
    z.object({
      topic: z.string(),
      severity: z.enum(["slight", "strong"]),
      positions: z.array(z.object({ author: z.string(), view: z.string() })).min(2),
    }),
  ),
});

export type RegionalCommentaryResult = z.infer<typeof Schema> & {
  countryCode: string;
  countryName: string;
  locked?: boolean;
};

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
          era: { type: "string" },
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

export const compareRegionalCommentaries = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }): Promise<RegionalCommentaryResult> => {
    const country = data.countryCode.toUpperCase();
    const name = countryName(country);

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const { buildCacheKey, getCached, setCached, normaliseReference } = await import("./ai-cache.server");
    const cacheKey = buildCacheKey("regionalCommentary", {
      reference: normaliseReference(data.reference),
      country,
      translation: data.translation,
      language: data.language,
    });
    const cached = await getCached<Omit<RegionalCommentaryResult, "countryCode" | "countryName" | "locked">>(cacheKey);
    if (cached) {
      const parsed = Schema.safeParse(cached);
      if (parsed.success) {
        return { ...parsed.data, countryCode: country, countryName: name, locked: false };
      }
    }

    const { getLanguage, languageDirective } = await import("./languages");
    const langConfig = getLanguage(data.language);
    const directive = languageDirective(data.language, langConfig.translationName);

    const system = `You are a careful biblical-studies research assistant. Identify 2-5 historically recognized Christian theologians, commentators, preachers, reformers, or church fathers FROM ${name} who have written substantively on themes related to the given Bible passage. Prefer figures whose works are public domain or safely citable.

For each: 2-3 sentence faithful summary of how they read this passage (or how their broader theological framework bears on it), plus a one-line key insight. Do NOT invent quotations and do NOT include living figures unless their published work is widely respected and well-attested.

If you genuinely cannot identify suitable figures from ${name} for this passage, return an EMPTY commentaries array (the UI will handle it).

Then produce:
- commonGround: 1-3 short bullets where they broadly agree (may be empty if only one figure).
- contrasts: 0-2 substantive disagreements among them, each with severity ("slight" or "strong"), topic, and positions array of 2+ {author, view}.

STYLE: Write so a curious 12-year-old can follow every sentence. Short sentences. Active voice. Plain English. No untranslated Greek/Hebrew or Latin.

Be concise, accurate, ecumenical.${directive}`;

    const model = "google/gemini-2.5-flash-lite";
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: system },
          {
            role: "user",
            content: `Regional voices from ${name} on: "${data.reference}". Translation: ${langConfig.translationName}. Return JSON only.`,
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: { name: `regional_${country}`, strict: true, schema: jsonSchema },
        },
      }),
    });

    if (response.status === 429) throw new Error("Rate limit reached. Please try again in a moment.");
    if (response.status === 402) throw new Error("AI credits exhausted.");
    if (!response.ok) {
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      throw new Error("Failed to fetch regional commentary.");
    }

    const json = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = json.choices?.[0]?.message?.content;
    if (!content) throw new Error("Empty AI response");
    const { parseLooseJson } = await import("./json-repair");
    const result = Schema.safeParse(parseLooseJson(content));
    if (!result.success) {
      console.error("Regional commentary schema validation failed:", result.error.issues);
      throw new Error("Regional commentary response was incomplete. Please try again.");
    }
    await setCached(cacheKey, "regionalCommentary", result.data, { model });
    return { ...result.data, countryCode: country, countryName: name, locked: false };
  });

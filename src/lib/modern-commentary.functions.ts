
import { z } from "zod";

const InputSchema = z.object({
  reference: z.string().min(2).max(100),
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
    .min(3)
    .max(10),
  commonGround: z.array(z.string()).min(1),
  contrasts: z.array(
    z.object({
      topic: z.string(),
      severity: z.enum(["slight", "strong"]),
      positions: z
        .array(z.object({ author: z.string(), view: z.string() }))
        .min(2),
    }),
  ),
});

export type ModernCommentaryResult = z.infer<typeof Schema> & { locked?: boolean };

const SYSTEM_PROMPT = `You are a careful biblical-studies research assistant. Given a Bible passage and translation, your job is to ADD modern theological voices into an existing comparison alongside 5 classic public-domain commentators, so the user sees ONE integrated comparison — not two separate ones.

The 5 classic commentators already in the comparison (you can REFER to them by name in commonGround and contrasts, but do NOT include them in the "commentaries" array — only modern voices go there):
- Matthew Henry (Nonconformist / Reformed)
- John Calvin (Reformed)
- Charles H. Spurgeon (Reformed Baptist)
- Albert Barnes (Presbyterian)
- John Wesley (Methodist / Arminian)

Choose the 5-7 most relevant MODERN (20th-21st century) theologians for the passage from the list below. **Global balance is REQUIRED**: every comparison MUST include at least ONE voice from each of these regions when at all relevant — Africa, Asia, Latin America, and the Western world (Europe / North America). Weight Global South voices equally — do not let Western names dominate by count or summary length. You may add other suitable modern Global South theologians beyond this list if they sharpen global representation, but never invent people.

WESTERN:
- N. T. Wright (b. 1948, UK, Anglican / NT scholar, "New Perspective on Paul")
- John Stott (1921-2011, UK, Anglican / Evangelical)
- J. I. Packer (1926-2020, UK/Canada, Anglican / Reformed Evangelical)
- D. A. Carson (b. 1946, Canada, Evangelical / Reformed Baptist)
- Gordon Fee (1934-2022, Canada, Pentecostal / NT scholar)
- Tim Keller (1950-2023, USA, Reformed / Presbyterian, PCA)
- John Piper (b. 1946, USA, Reformed Baptist / Christian Hedonism)
- Walter Brueggemann (b. 1933, USA, Reformed / OT scholar)
- Jürgen Moltmann (1926-2024, Germany, Reformed / Theology of Hope)
- Alister McGrath (b. 1953, UK, Anglican / Historical theology & science)
- Derek Prince (1915-2003, UK/Israel, Bible teacher; charismatic / evangelical)

AFRICA:
- John Mbiti (1931-2019, Kenya, pioneer of African Christian theology; African religion + biblical thought)
- Byang Kato (1936-1975, Nigeria, evangelical African theologian; biblical authority in African context)
- Mercy Amba Oduyoye (b. 1934, Ghana, founder of African women's theology; community + gender)
- Kwame Bediako (1945-2008, Ghana, African Christian identity; gospel + African primal religions)

ASIA:
- Kosuke Koyama (1929-2009, Japan/Thailand, "Water Buffalo Theology"; slow, contextual mission)
- C. S. Song (b. 1929, Taiwan, Asian contextual / story theology; Cross from the Asian underside)
- Ajith Fernando (b. 1948, Sri Lanka, practical theology of suffering, discipleship, mission)

LATIN AMERICA:
- Samuel Escobar (b. 1934, Peru, Latin American evangelical missiology)
- René Padilla (1932-2021, Ecuador/Argentina, integral mission — mission as word + deed + justice)
- Orlando Costas (1942-1987, Puerto Rico, contextual evangelism from the margins)
- Gustavo Gutiérrez (1928-2024, Peru, liberation theology — God's preferential option for the poor)
- Elsa Tamez (b. 1950, Mexico/Costa Rica, justice-focused biblical interpretation; Latina feminist exegesis)

For each chosen MODERN commentator: 2-3 sentence ORIGINAL faithful summary of how their theological framework reads this passage. Do NOT quote or paraphrase copyrighted material; write fresh original prose. Plus a one-line key insight.

Then produce — CROSS-COMPARING modern AND classic voices together:
- commonGround: 2-4 short bullets where BOTH the modern voices AND the classic 5 broadly agree (so the user sees points the whole tradition shares). Phrase as shared insights, not author-by-author.
- contrasts: 0-3 substantive disagreements where MODERN voices read the passage DIFFERENTLY from one or more of the classic 5, or where Global South voices reframe the passage (e.g. liberation, honour/shame, communal, spiritual-power readings) differently from Western readings. Each with severity ("slight" or "strong"), topic, and a positions array of 2+ {author, view} mixing modern AND classic, Western AND Global South names. Only include contrasts that genuinely add something.

Be concise, accurate, ecumenical.

STYLE — VERY IMPORTANT:
Write so a curious 12-year-old can follow every sentence, while keeping the FULL theological idea intact. The goal of Verse Smart is to make complex, contrasting ideas easy to grasp — never to dumb them down.
- Use everyday words. Swap jargon for plain English: "justification" → "being made right with God", "covenant" → "God's binding promise", "eschatology" → "what the Bible says about the end", "hermeneutic" → "way of reading the text".
- If a technical term truly matters, use it once and explain it in the same sentence in parentheses.
- Short sentences. Active voice. No Latin, no untranslated Greek/Hebrew.
- Keep the actual disagreement sharp and specific — simple words, not simple ideas. Don't soften what a thinker actually argued.
- No flowery or sermon-y language. Sound like a smart friend explaining it at a coffee table.`;

export const compareModernCommentaries = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }): Promise<ModernCommentaryResult> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const { buildCacheKey, getCached, setCached, normaliseReference } = await import("./ai-cache.server");
    const cacheKey = buildCacheKey("modernCommentary", {
      reference: normaliseReference(data.reference),
      translation: data.translation,
      language: data.language,
    });
    const cached = await getCached<Omit<ModernCommentaryResult, "locked">>(cacheKey);
    if (cached) {
      const safe = Schema.safeParse(cached);
      if (safe.success) return { ...safe.data, locked: false };
    }

    const { getLanguage, languageDirective } = await import("./languages");
    const langConfig = getLanguage(data.language);
    const directive = languageDirective(data.language, langConfig.translationName);

    const model = "google/gemini-2.5-flash-lite";
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT + directive },
          {
            role: "user",
            content: `Compare modern theologians on: "${data.reference}". Translation: ${langConfig.translationName}. Return JSON only.`,
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "modern_commentary_comparison",
            strict: true,
            schema: {
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
                      era: { type: "string", description: "Approximate dates the author has been actively writing/publishing on Scripture, e.g. 'c. 1990s–present'. Prefer year ranges over century labels." },
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
                          properties: {
                            author: { type: "string" },
                            view: { type: "string" },
                          },
                          required: ["author", "view"],
                        },
                      },
                    },
                    required: ["topic", "severity", "positions"],
                  },
                },
              },
              required: [
                "verseReference",
                "translation",
                "commentaries",
                "commonGround",
                "contrasts",
              ],
            },
          },
        },
      }),
    });

    if (response.status === 429) throw new Error("Rate limit reached. Please try again in a moment.");
    if (response.status === 402) throw new Error("AI credits exhausted.");
    if (!response.ok) {
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      throw new Error("Failed to fetch modern commentary.");
    }

    const json = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = json.choices?.[0]?.message?.content;
    if (!content) throw new Error("Empty AI response");

    const { parseLooseJson } = await import("./json-repair");
    const parsedJson = parseLooseJson(content);
    const parsed = Schema.parse(parsedJson);
    await setCached(cacheKey, "modernCommentary", parsed, { model });
    return { ...parsed, locked: false };
  });

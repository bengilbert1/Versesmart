
import { z } from "zod";

const Input = z.object({
  query: z.string().min(2).max(200),
});

const Schema = z.object({
  themes: z
    .array(
      z.object({
        theme: z.string().min(1).max(60),
        blurb: z.string().min(1).max(160),
        verses: z
          .array(
            z.object({
              reference: z.string().min(2).max(60),
              blurb: z.string().min(1).max(160),
            }),
          )
          .min(3)
          .max(5),
      }),
    )
    .min(3)
    .max(3),
});

export type ThemeSearchResult = z.infer<typeof Schema>;

const SYSTEM_PROMPT = `You are a biblical theme assistant. The user describes what they are pondering, feeling, or curious about in plain language. Suggest exactly 3 distinct biblical themes that match. For each theme, give a short name (2-4 words), a one-sentence blurb (max ~20 words), and 3-5 well-known canonical Bible verses or short passages (e.g. "Romans 8:28", "Psalm 23") that explore that theme, each with a one-sentence blurb (max ~20 words) explaining the connection. Prefer widely-studied, beloved verses. Return JSON only.`;

export const searchByTheme = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }): Promise<ThemeSearchResult> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const { buildCacheKey, getCached, setCached } = await import("./ai-cache.server");
    const cacheKey = buildCacheKey("themeSearch", {
      query: data.query.trim().toLowerCase().replace(/\s+/g, " "),
    });
    const cached = await getCached<ThemeSearchResult>(cacheKey);
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
          { role: "user", content: `User is pondering: "${data.query}". Suggest 3 themes with associated verses.` },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "theme_search",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                themes: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      theme: { type: "string" },
                      blurb: { type: "string" },
                      verses: {
                        type: "array",
                        items: {
                          type: "object",
                          additionalProperties: false,
                          properties: {
                            reference: { type: "string" },
                            blurb: { type: "string" },
                          },
                          required: ["reference", "blurb"],
                        },
                      },
                    },
                    required: ["theme", "blurb", "verses"],
                  },
                },
              },
              required: ["themes"],
            },
          },
        },
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("Theme search AI error:", response.status, text);
      throw new Error("Failed to fetch theme suggestions");
    }

    const json = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = json.choices?.[0]?.message?.content;
    if (!content) throw new Error("Empty AI response");
    const { parseLooseJson } = await import("./json-repair");
    const result = Schema.parse(parseLooseJson(content));
    await setCached(cacheKey, "themeSearch", result, { model, ttlDays: 30 });
    return result;
  });

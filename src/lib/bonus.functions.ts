
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { getUserTier } from "./tier-server";
import type { CommentaryResult } from "./commentary.functions";
import type { ModernCommentaryResult } from "./modern-commentary.functions";
import { runHistoricalAi, type HistoricalCommentaryResult } from "./historical-commentary.functions";

const InputSchema = z.object({
  reference: z.string().min(2).max(100),
  translation: z.string().optional().transform(() => "WEB" as const),
  environment: z.enum(["sandbox", "live"]).default("sandbox"),
});

let _admin: any = null;
function admin(): any {
  if (!_admin) {
    _admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  }
  return _admin;
}

async function getUserFromAuthHeader(): Promise<{ id: string; email: string | null } | null> {
  try {
    const authHeader = getRequestHeader("authorization");
    if (!authHeader) return null;
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return null;
    const userClient = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { global: { headers: { Authorization: `Bearer ${token}` } } },
    );
    const { data } = await userClient.auth.getUser();
    if (!data.user) return null;
    return { id: data.user.id, email: data.user.email ?? null };
  } catch {
    return null;
  }
}

const PLAIN_LANGUAGE_STYLE = `STYLE — VERY IMPORTANT:
Write so a curious 12-year-old can follow every sentence, while keeping the FULL theological idea intact. Use everyday words; if a technical term truly matters, explain it in the same sentence in parentheses. Short sentences, active voice, no Latin, no untranslated Greek/Hebrew. Keep disagreements sharp and specific — simple words, not simple ideas.`;

const CLASSIC_PROMPT = `You are a careful biblical-studies research assistant. Given a Bible passage and translation, return a JSON object comparing how 5 public-domain commentators interpret it: Matthew Henry, John Calvin, Charles H. Spurgeon, Albert Barnes, John Wesley.
For each: 2-3 sentence faithful summary + one-line key insight. Do not invent quotations.
Then produce commonGround (2-4 short bullets) and contrasts (0-3 disagreements, each with severity "slight" or "strong", topic, and 2+ positions {author, view}).
${PLAIN_LANGUAGE_STYLE}`;

const MODERN_PROMPT = `You are a careful biblical-studies research assistant. ADD 5-7 modern (20th-21st c.) theologians into a comparison alongside the 5 classics (Henry, Calvin, Spurgeon, Barnes, Wesley). Global balance is REQUIRED: include at least one voice from EACH region — Africa, Asia, Latin America, and the Western world — when relevant. Weight Global South voices equally; do not let Western names dominate by count or length. Choose from (and you may add other suitable modern Global South theologians):
Western — N. T. Wright, John Stott, J. I. Packer, D. A. Carson, Gordon Fee, Tim Keller, John Piper, Walter Brueggemann, Jürgen Moltmann, Alister McGrath, Derek Prince.
Africa — John Mbiti, Byang Kato, Mercy Amba Oduyoye, Kwame Bediako.
Asia — Kosuke Koyama, C. S. Song, Ajith Fernando.
Latin America — Samuel Escobar, René Padilla, Orlando Costas, Gustavo Gutiérrez, Elsa Tamez.
Include only modern voices in "commentaries" but cross-compare with classics in commonGround/contrasts.
2-3 sentence ORIGINAL faithful summary + one-line key insight per modern. Do NOT quote or paraphrase copyrighted material; write fresh original prose.
commonGround = shared insights across modern AND classic, Western AND Global South. contrasts = 0-3 substantive disagreements that mix modern vs classic AND Global South vs Western framings.
${PLAIN_LANGUAGE_STYLE}`;

const ClassicSchema = z.object({
  verseReference: z.string(),
  verseText: z.string(),
  translation: z.string(),
  commentaries: z.array(z.object({
    author: z.string(),
    era: z.string(),
    tradition: z.string(),
    summary: z.string(),
    keyInsight: z.string(),
  })).min(3).max(6),
  commonGround: z.array(z.string()).min(1),
  contrasts: z.array(z.object({
    topic: z.string(),
    severity: z.enum(["slight", "strong"]),
    positions: z.array(z.object({ author: z.string(), view: z.string() })).min(2),
  })),
});

const ModernSchema = z.object({
  verseReference: z.string(),
  translation: z.string(),
  commentaries: z.array(z.object({
    author: z.string(),
    era: z.string(),
    tradition: z.string(),
    summary: z.string(),
    keyInsight: z.string(),
  })).min(3).max(10),
  commonGround: z.array(z.string()).min(1),
  contrasts: z.array(z.object({
    topic: z.string(),
    severity: z.enum(["slight", "strong"]),
    positions: z.array(z.object({ author: z.string(), view: z.string() })).min(2),
  })),
});

const classicJsonSchema = {
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
  required: ["verseReference", "verseText", "translation", "commentaries", "commonGround", "contrasts"],
};

const modernJsonSchema = {
  ...classicJsonSchema,
  properties: { ...classicJsonSchema.properties },
  required: ["verseReference", "translation", "commentaries", "commonGround", "contrasts"],
};
delete (modernJsonSchema.properties as any).verseText;

async function runAi(systemPrompt: string, userPrompt: string, name: string, schema: any, cacheParams?: { fnName: string; key: Record<string, unknown> }): Promise<any> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

  let cacheKey: string | null = null;
  if (cacheParams) {
    const { buildCacheKey, getCached } = await import("./ai-cache.server");
    cacheKey = buildCacheKey(cacheParams.fnName, cacheParams.key);
    const cached = await getCached<any>(cacheKey);
    if (cached) return cached;
  }

  const model = "google/gemini-2.5-flash-lite";
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_schema", json_schema: { name, strict: true, schema } },
    }),
  });
  if (!response.ok) {
    console.error("AI gateway error:", response.status, await response.text());
    throw new Error("Failed to fetch bonus analysis.");
  }
  const json: any = await response.json();
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error("Empty AI response");
  const { parseLooseJson } = await import("./json-repair");
  const parsed = parseLooseJson(content);
  if (cacheKey && cacheParams) {
    const { setCached } = await import("./ai-cache.server");
    await setCached(cacheKey, cacheParams.fnName, parsed, { model });
  }
  return parsed;
}

export type BonusDeepAnalysisResult = {
  classic: CommentaryResult;
  modern: ModernCommentaryResult;
  historical: HistoricalCommentaryResult[];
  useCount: number;
};

const BONUS_WINDOW_DAYS = 3;

export const getBonusDeepAnalysis = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }): Promise<BonusDeepAnalysisResult> => {
    const authUser = await getUserFromAuthHeader();
    if (!authUser) throw new Error("SIGNIN_REQUIRED");

    const tier = await getUserTier(authUser.id, authUser.email, data.environment);
    if (tier !== "free") throw new Error("BONUS_NOT_ELIGIBLE");

    // Allow one preview per rolling 3-day window.
    const cutoff = new Date(Date.now() - BONUS_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const { data: recent } = await admin()
      .from("bonus_lookups")
      .select("id")
      .eq("user_id", authUser.id)
      .gte("used_at", cutoff)
      .limit(1);
    if (recent && recent.length > 0) throw new Error("BONUS_NOT_YET_AVAILABLE");

    const { count: priorCount } = await admin()
      .from("bonus_lookups")
      .select("id", { count: "exact", head: true })
      .eq("user_id", authUser.id);

    const { error: insertErr } = await admin()
      .from("bonus_lookups")
      .insert({ user_id: authUser.id, reference: data.reference });
    if (insertErr) throw new Error("BONUS_INSERT_FAILED");

    const useCount = (priorCount ?? 0) + 1;

    const userPromptClassic = `Compare commentaries on: "${data.reference}". Translation: ${data.translation}. Return JSON only.`;
    const userPromptModern = `Compare modern theologians on: "${data.reference}". Translation: ${data.translation}. Return JSON only.`;

    const [classicJson, modernJson, foundational, fathers, reformation] = await Promise.all([
      runAi(CLASSIC_PROMPT, userPromptClassic, "commentary_comparison", classicJsonSchema, {
        fnName: "bonusClassic",
        key: { reference: data.reference.trim().toLowerCase(), translation: data.translation },
      }),
      runAi(MODERN_PROMPT, userPromptModern, "modern_commentary_comparison", modernJsonSchema, {
        fnName: "bonusModern",
        key: { reference: data.reference.trim().toLowerCase(), translation: data.translation },
      }),
      runHistoricalAi("foundational", data.reference, data.translation),
      runHistoricalAi("fathers", data.reference, data.translation),
      runHistoricalAi("reformation", data.reference, data.translation),
    ]);

    const classic = ClassicSchema.parse(classicJson) as CommentaryResult;
    const modern = ModernSchema.parse(modernJson) as ModernCommentaryResult;

    return {
      classic: { ...classic, contrastsLocked: false },
      modern: { ...modern, locked: false },
      historical: [foundational, fathers, reformation],
      useCount,
    };
  });

export const getBonusStatus = createServerFn({ method: "GET" })
  .handler(async (): Promise<{ eligible: boolean; useCount: number; nextAvailableAt: string | null }> => {
    const authUser = await getUserFromAuthHeader();
    if (!authUser) return { eligible: false, useCount: 0, nextAvailableAt: null };
    const { data, count } = await admin()
      .from("bonus_lookups")
      .select("used_at", { count: "exact" })
      .eq("user_id", authUser.id)
      .order("used_at", { ascending: false })
      .limit(1);
    const useCount = count ?? 0;
    const last = data?.[0]?.used_at as string | undefined;
    if (!last) return { eligible: true, useCount, nextAvailableAt: null };
    const nextMs = new Date(last).getTime() + BONUS_WINDOW_DAYS * 24 * 60 * 60 * 1000;
    const eligible = Date.now() >= nextMs;
    return { eligible, useCount, nextAvailableAt: eligible ? null : new Date(nextMs).toISOString() };
  });

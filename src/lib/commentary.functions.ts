import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { getUserTier, getMonthlySearchCount, logSearchUsage, isActiveTester } from "./tier-server";
import { TIER_LIMITS } from "./tiers";

const InputSchema = z.object({
  reference: z.string().min(2).max(100),
  translation: z.any().optional().transform(() => "WEB" as const),
  clientId: z.string().min(1).max(128).optional(),
  environment: z.enum(["sandbox", "live"]).default("sandbox"),
  language: z.enum(["en", "es", "fr", "de", "zh-Hans", "zh-Hant", "hi"]).default("en"),
  // Explore-tier manual override. When provided with ≥2 names, the selection
  // engine is bypassed entirely — only these commentators are used.
  userSelection: z.array(z.string().min(1).max(200)).max(80).optional(),
});

export const ANON_DAILY_LIMIT = 1;
export const FREE_DAILY_LIMIT = 3;

function normalizeRef(ref: string): string {
  return ref.trim().toLowerCase().replace(/\s+/g, " ");
}

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

const ALWAYS_UNLIMITED_EMAILS = new Set(["gilbertbg@gmail.com", "shiyanirefuge@gmail.com", "dangi@mailglobex.com"]);

// Persist every author observed in a commentary payload into
// commentator_overrides so the admin panel always shows them — even after
// cache entries expire. Inserts only; never overwrites existing override fields.
async function persistSeenAuthors(authors: Array<string | undefined | null>) {
  try {
    const names = (authors ?? []).map((n) => (n ?? "").trim()).filter(Boolean);
    if (!names.length) return;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { normalizeName } = await import("./commentator-metadata");
    const uniq = new Map<string, { key: string; display: string }>();
    for (const n of names) {
      const key = normalizeName(n);
      if (!key) continue;
      uniq.set(`${key}|${n}`, { key, display: n });
    }
    if (!uniq.size) return;
    const allKeys = Array.from(new Set(Array.from(uniq.values()).map((v) => v.key)));
    const { data: existingRows } = await supabaseAdmin
      .from("commentator_overrides")
      .select("name_key, display_name, is_primary")
      .in("name_key", allKeys);
    const rows = (existingRows ?? []) as Array<{ name_key: string; display_name: string; is_primary: boolean }>;
    const existingPairs = new Set(rows.map((r) => `${r.name_key}|${r.display_name}`));
    const keysWithPrimary = new Set(rows.filter((r) => r.is_primary).map((r) => r.name_key));
    const keysWithAny = new Set(rows.map((r) => r.name_key));
    const toInsert: Array<{ name_key: string; display_name: string; is_primary: boolean; is_manual: boolean }> = [];
    for (const { key, display } of uniq.values()) {
      if (existingPairs.has(`${key}|${display}`)) continue;
      const shouldPrime = !keysWithPrimary.has(key) && !keysWithAny.has(key);
      if (shouldPrime) {
        keysWithPrimary.add(key);
        keysWithAny.add(key);
      } else {
        keysWithAny.add(key);
      }
      toInsert.push({ name_key: key, display_name: display, is_primary: shouldPrime, is_manual: false });
    }
    if (toInsert.length) {
      await supabaseAdmin.from("commentator_overrides").insert(toInsert);
    }
  } catch (e) {
    console.warn("persistSeenAuthors failed", e);
  }
}


const CommentarySchema = z.object({
  verseReference: z.string(),
  verseText: z.string(),
  translation: z.string(),
  commentaries: z
    .array(
      z.object({
        author: z.string(),
        era: z.string(),
        tradition: z.string(),
        summary: z.string(),
        keyInsight: z.string(),
        country: z.string().optional(),
        denomination: z.string().optional(),
        sourceUrl: z.string().optional(),
      }),
    )
    .min(2)
    .max(16),
  commonGround: z.array(z.string()).min(1),
  contrasts: z
    .array(
      z.object({
        topic: z.string(),
        severity: z.enum(["slight", "strong"]),
        positions: z
          .array(z.object({ author: z.string(), view: z.string() }))
          .min(2),
      }),
    )
    .min(0),
});

export type CommentaryResult = z.infer<typeof CommentarySchema> & {
  contrastsLocked?: boolean;
  signupRequired?: boolean;
  upgradeRequired?: boolean;
};

const PLAIN_LANGUAGE_STYLE = `STYLE — VERY IMPORTANT:
Write so a curious 12-year-old can follow every sentence, while keeping the FULL theological idea intact. The goal of Verse Smart is to make complex, contrasting ideas easy to grasp — never to dumb them down.

- Use everyday words. Replace jargon with plain English: "justification" → "being made right with God", "atonement" → "Jesus paying the price for sin", "sovereignty" → "God being in full control", "eschatology" → "what the Bible says about the end", "exegesis" → "careful reading of the text".
- If a technical term truly matters, use it once and explain it in the same sentence in parentheses.
- Short sentences. Active voice. No Latin, no Greek/Hebrew transliteration unless you immediately translate it.
- Keep the actual disagreement sharp and specific — simple words, not simple ideas. Never water down what a thinker actually said.
- No flowery or sermon-y language. No "indeed", "moreover", "thus". Sound like a smart friend explaining it at a coffee table.`;

const SYSTEM_PROMPT = `You are a careful biblical-studies research assistant. Given a Bible passage reference (which may be a single verse like "John 3:16", a whole chapter like "Romans 8", or an entire book like "Philippians") and a translation, return a JSON object comparing how the specific commentators provided to you interpret it.

ROSTER — STRICT REQUIREMENT:
You DO NOT choose the commentators. Use EXACTLY the commentator list provided in the user message under "COMMENTATORS TO USE". Do not add commentators not on the list. Do not omit commentators on the list unless an author truly has no engagement with this passage (in that case, still write a faithful entry on how their broader framework bears on it). Use author names exactly as spelled in the provided list.

For each commentator, give a faithful 2-3 sentence summary of their actual exegetical view of the passage, plus a one-line "key insight". Do NOT invent quotations.

For each commentator also return:
- "tradition": their specific tradition/sub-tradition.
- "denomination": one of: "Catholic", "Orthodox", "Anglican", "Reformed", "Baptist", "Pentecostal / Charismatic", "Methodist / Wesleyan", "Lutheran", "Non-denominational / Evangelical", "Other Christian Traditions".
- "country": the author's primary country of ministry.
- "era": approximate active writing dates, e.g. "c. 1700–1714" or "c. 1980s–present".
- "sourceUrl" (optional): a stable public URL where the author's writings on Scripture can be read. Omit if you are not confident the URL exists.

Then produce:
- commonGround: 2-4 short bullets most or all of them agree on
- contrasts: 0-3 substantive interpretive disagreements, each with severity, topic, and positions (2+ {author, view}).

For "verseText":
- Single verse: include the verse text in the requested translation.
- Chapter / Book: concise 2-3 sentence overview.

${PLAIN_LANGUAGE_STYLE}`;

export const compareCommentaries = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }): Promise<CommentaryResult> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    // --- Entitlement / quota check ---
    const refKey = normalizeRef(data.reference) + "|" + data.translation;
    const authUser = await getUserFromAuthHeader();
    const userId = authUser?.id ?? null;
    const tier = await getUserTier(userId, authUser?.email ?? null, data.environment);
    const limits = TIER_LIMITS[tier];
    const isOwner = !!authUser?.email && ALWAYS_UNLIMITED_EMAILS.has(authUser.email.toLowerCase());
    const tester = !isOwner && (await isActiveTester(userId));

    const contrastsLocked = false;

    if (isOwner || tester) {
      // Site owner or active tester: bypass all quotas, just log usage for analytics.
      if (userId) await logSearchUsage(userId, data.clientId ?? null, refKey);
    } else if (tier === "free") {

      if (!userId) {
        // Anonymous: 2 lookups per day by client_id, then require signup.
        if (data.clientId) {
          const today = new Date().toISOString().slice(0, 10);
          const { data: existingRows } = await admin()
            .from("daily_usage")
            .select("reference_key")
            .eq("client_id", data.clientId)
            .is("user_id", null)
            .eq("usage_date", today);
          const existing: string[] = (existingRows ?? []).map((r: any) => r.reference_key);
          const alreadyUsed = existing.includes(refKey);
          if (!alreadyUsed && existing.length >= ANON_DAILY_LIMIT) {
            return {
              verseReference: data.reference,
              translation: data.translation,
              verseText: "",
              commonGround: [],
              contrasts: [],
              commentaries: [],
              signupRequired: true,
            } as CommentaryResult;
          }
          if (!alreadyUsed) {
            await admin().from("daily_usage").insert({
              client_id: data.clientId,
              user_id: null,
              usage_date: today,
              reference_key: refKey,
            });
          }
        }
      } else if (data.clientId) {
        // Signed-in free (Entry): 3 distinct lookups per day. When the limit
        // is reached, return an upgradeRequired sentinel so the client can
        // show the upgrade prompt instead of consuming an AI call.
        const today = new Date().toISOString().slice(0, 10);
        const { data: existingRows } = await admin()
          .from("daily_usage")
          .select("reference_key")
          .eq("user_id", userId)
          .eq("usage_date", today);
        const existing: string[] = (existingRows ?? []).map((r: any) => r.reference_key);
        const alreadyUsed = existing.includes(refKey);

        if (!alreadyUsed && existing.length >= FREE_DAILY_LIMIT) {
          return {
            verseReference: data.reference,
            translation: data.translation,
            verseText: "",
            commonGround: [],
            contrasts: [],
            commentaries: [],
            upgradeRequired: true,
          } as CommentaryResult;
        }
        if (!alreadyUsed) {
          await admin().from("daily_usage").insert({
            client_id: data.clientId,
            user_id: userId,
            usage_date: today,
            reference_key: refKey,
          });
        }
      }
    } else if (userId) {
      // Paid tiers (Engage 300/mo, Explore 1000/mo): monthly cap.
      if (limits.monthlySearches !== "unlimited") {
        const used = await getMonthlySearchCount(userId);
        const today = new Date().toISOString().slice(0, 10);
        const { data: dup } = await admin()
          .from("daily_usage")
          .select("id")
          .eq("user_id", userId)
          .eq("usage_date", today)
          .eq("reference_key", refKey)
          .limit(1);
        const isRevisit = !!(dup && dup.length > 0);
        if (!isRevisit && used >= limits.monthlySearches) {
          return {
            verseReference: data.reference,
            translation: data.translation,
            verseText: "",
            commonGround: [],
            contrasts: [],
            commentaries: [],
            upgradeRequired: true,
          } as CommentaryResult;
        }
      }
      await logSearchUsage(userId, data.clientId ?? null, refKey);
    }

    // Save to history for ALL authenticated users, then trim to tier limit.
    if (userId) {
      try {
        const trimmedRef = data.reference.trim();
        await admin()
          .from("search_history")
          .delete()
          .eq("user_id", userId)
          .eq("reference", trimmedRef)
          .eq("translation", data.translation);
        await admin().from("search_history").insert({
          user_id: userId,
          reference: trimmedRef,
          translation: data.translation,
        });

        // Trim to tier limit (free=10, engage=50, explore=100)
        const limit = limits.historyLimit;
        const { data: excess } = await admin()
          .from("search_history")
          .select("id")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .offset(limit)
          .limit(100);
        if (excess && excess.length > 0) {
          const idsToDelete = (excess as { id: string }[]).map((r) => r.id);
          await admin()
            .from("search_history")
            .delete()
            .in("id", idsToDelete);
        }
      } catch (e) {
        console.error("search_history insert failed:", e);
      }
    }

    const { getLanguage, languageDirective } = await import("./languages");
    const langConfig = getLanguage(data.language);
    const directive = languageDirective(data.language, langConfig.translationName);

    // Manual commentators added by admin — pinned into the engine selection.
    let mustInclude: string[] = [];
    let blocked: Set<string> = new Set();
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: manualRows } = await supabaseAdmin
        .from("commentator_overrides")
        .select("display_name")
        .eq("is_manual", true)
        .eq("is_hidden", false);
      mustInclude = (manualRows ?? []).map((r: any) => String(r.display_name)).sort();
      const { data: blockRows } = await supabaseAdmin
        .from("commentator_blocks")
        .select("name_key");
      blocked = new Set((blockRows ?? []).map((r: any) => String(r.name_key)));
      // Globally-deleted commentators are filtered exactly like blocks so
      // the selection engine never returns them, regardless of language.
      const { data: deletedRows } = await supabaseAdmin
        .from("deleted_commentators")
        .select("name_key");
      for (const r of deletedRows ?? []) blocked.add(String((r as any).name_key));
    } catch {
      mustInclude = [];
    }

    // Recency rotation: load this scope's last lookup + ever-used roster so
    // the engine guarantees ≥2 new authors each lookup and rotates toward
    // surfacing every author eventually.
    const scopeKey = userId ? `u:${userId}` : data.clientId ? `c:${data.clientId}` : null;
    let recentlyUsed = new Set<string>();
    let everUsed = new Set<string>();
    if (scopeKey) {
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { normalizeName } = await import("./commentator-metadata");
        const { data: hist } = await supabaseAdmin
          .from("commentator_lookup_history")
          .select("last_authors, ever_used")
          .eq("scope_key", scopeKey)
          .maybeSingle();
        if (hist) {
          recentlyUsed = new Set(((hist as any).last_authors ?? []).map((n: string) => normalizeName(n)));
          everUsed = new Set(((hist as any).ever_used ?? []).map((n: string) => normalizeName(n)));
        }
      } catch (e) {
        console.error("commentator_lookup_history read failed:", e);
      }
    }

    // Run the unified selection engine. Single source of truth for which
    // commentators appear — the AI never selects. If the caller passed a
    // manual `userSelection` (Explore tier) with ≥2 names, that fully
    // overrides the engine: no balancing, no fallback, no quotas.
    const { selectCommentatorsForVerse } = await import("./commentator-selection");
    const { normalizeName: _normName } = await import("./commentator-metadata");
    const manualOverride =
      Array.isArray(data.userSelection) && data.userSelection.length >= 2
        ? Array.from(
            new Map(
              data.userSelection
                .map((n) => n.trim())
                .filter(Boolean)
                .filter((n) => !blocked.has(_normName(n)))
                .map((n) => [_normName(n), n]),
            ).values(),
          )
        : null;
    const selection = manualOverride
      ? { commentators: manualOverride.map((n) => ({ name: n } as any)), warning: undefined }
      : selectCommentatorsForVerse(data.reference, {
          minCount: 10,
          maxCount: 16,
          targetCount: 12,
          mustInclude,
          blocked,
          recentlyUsed,
          everUsed,
          minNewAuthors: 2,
        });
    const rosterNames = selection.commentators.map((c) => c.name);
    const rosterKey = rosterNames.join("|");
    const rosterBlock = `\n\nCOMMENTATORS TO USE (exactly this list, ${rosterNames.length} names — do not add or omit):\n${rosterNames.map((n) => `- ${n}`).join("\n")}`;

    // Persist this lookup's roster so the next lookup can enforce rotation.
    // Also maintain a "__global__" scope row so the admin panel can show the
    // very last lookup roster across all users. And bump persistent per-
    // commentator usage counters on commentator_overrides.
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { normalizeName } = await import("./commentator-metadata");

      const scopes: string[] = ["__global__"];
      if (scopeKey) scopes.push(scopeKey);

      for (const sk of scopes) {
        const baseEver = sk === scopeKey ? everUsed : new Set<string>();
        // For __global__ we read the existing row to preserve ever_used.
        let ever = baseEver;
        if (sk === "__global__") {
          try {
            const { data: gh } = await supabaseAdmin
              .from("commentator_lookup_history")
              .select("ever_used")
              .eq("scope_key", "__global__")
              .maybeSingle();
            ever = new Set(((gh as any)?.ever_used ?? []).map((n: string) => normalizeName(n)));
          } catch {}
        }
        const merged = new Set<string>(ever);
        for (const n of rosterNames) merged.add(normalizeName(n));
        await supabaseAdmin
          .from("commentator_lookup_history")
          .upsert({
            scope_key: sk,
            last_authors: rosterNames,
            ever_used: Array.from(merged),
            updated_at: new Date().toISOString(),
          } as any, { onConflict: "scope_key" });
      }

      // Persistent usage counts — one increment per commentator per lookup.
      await supabaseAdmin.rpc("increment_commentator_usage", { p_names: rosterNames });
    } catch (e) {
      console.error("commentator_lookup_history / usage upsert failed:", e);
    }

    // Cache lookup — keyed by passage + translation + language + roster.
    const { buildCacheKey, getCached, setCached, normaliseReference } = await import("./ai-cache.server");
    const cacheKey = buildCacheKey("commentary-v4-engine", {
      reference: normaliseReference(data.reference),
      translation: data.translation,
      language: data.language,
      roster: rosterKey,
    });
    const cached = await getCached<any>(cacheKey);
    if (cached) {
      const safe = CommentarySchema.safeParse(cached);
      if (safe.success) {
        await persistSeenAuthors((safe.data.commentaries ?? []).map((c: any) => c.author));
        return { ...safe.data, contrastsLocked };
      }
    }

    const requestBody = {
      model: "google/gemini-2.5-flash-lite",
      messages: [
        { role: "system", content: SYSTEM_PROMPT + directive + rosterBlock },
        {
          role: "user",
          content: `Compare commentaries on the passage: "${data.reference}". Use the ${langConfig.translationName} translation. The roster has been pre-selected — use it exactly. Return JSON only.`,
        },
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
                    author: { type: "string" },
                    era: { type: "string", description: "Approximate dates the author was actively writing on Scripture, e.g. 'c. 1700–1714' or 'c. 1850s–1890s'. Prefer year ranges over century labels." },
                    tradition: { type: "string" },
                    summary: { type: "string" },
                    keyInsight: { type: "string" },
                    country: { type: "string", description: "Primary country of ministry. Empty string if unknown." },
                    denomination: { type: "string", description: "One of: Catholic, Orthodox, Anglican, Reformed, Baptist, Pentecostal / Charismatic, Methodist / Wesleyan, Lutheran, Non-denominational / Evangelical, Other Christian Traditions. Empty string if unsure." },
                    sourceUrl: { type: "string", description: "Stable public URL to the author's writings. Empty string if not confident one exists." },
                  },
                  required: ["author", "era", "tradition", "summary", "keyInsight", "country", "denomination", "sourceUrl"],
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
              "verseText",
              "translation",
              "commentaries",
              "commonGround",
              "contrasts",
            ],
          },
        },
      },
    };

    const { parseLooseJson } = await import("./json-repair");

    let lastError: unknown = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (response.status === 429) {
        throw new Error("Rate limit reached. Please try again in a moment.");
      }
      if (response.status === 402) {
        throw new Error("AI credits exhausted. Please add credits in your workspace.");
      }
      if (!response.ok) {
        const text = await response.text();
        console.error("AI gateway error:", response.status, text);
        throw new Error("Failed to fetch commentary comparison.");
      }

      const json = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = json.choices?.[0]?.message?.content;
      if (!content) {
        lastError = new Error("Empty AI response");
        continue;
      }

      try {
        const parsedJson = parseLooseJson(content);
        const parsed = CommentarySchema.parse(parsedJson);
        await setCached(cacheKey, "commentary-v4-engine", parsed, { model: "google/gemini-2.5-flash-lite" });
        await persistSeenAuthors((parsed.commentaries ?? []).map((c: any) => c.author));
        return { ...parsed, contrastsLocked };

      } catch (err) {
        lastError = err;
        console.error(`Commentary parse failed (attempt ${attempt + 1}):`, err);
        continue;
      }
    }

    console.error("Commentary parse failed after retries:", lastError);
    // Classify the failure so the UI can show a guided recovery flow
    // instead of a dead-end "incomplete response" message.
    const kind = rosterNames.length > 10 ? "OVERLOAD" : "INSUFFICIENT";
    throw new Error(`COMPARE_${kind}:${rosterNames.length}`);
  });


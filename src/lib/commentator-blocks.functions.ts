// Server functions for the admin commentator allow/block panel.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { normalizeName } from "./commentator-metadata";
import { KNOWN_COMMENTATORS } from "./known-commentators";

const ADMIN_EMAIL = "gilbertbg@gmail.com";

function assertAdmin(claims: Record<string, unknown> | undefined) {
  const email = typeof claims?.email === "string" ? (claims.email as string).toLowerCase() : "";
  if (email !== ADMIN_EMAIL) throw new Error("Not found");
}

export type BlockedCommentator = { name_key: string; display_name: string };

// Public read — anyone may fetch the blocklist so the client can filter UI
// consistently. Returns only names, no admin metadata.
export const listBlockedCommentators = createServerFn({ method: "GET" }).handler(
  async (): Promise<BlockedCommentator[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("commentator_blocks")
      .select("name_key, display_name")
      .order("display_name", { ascending: true });
    return (data ?? []).map((r) => ({
      name_key: String(r.name_key),
      display_name: String(r.display_name),
    }));
  },
);

// Admin-only: returns every distinct author name observed in any verse
// commentary payload cached so far. No new AI calls — derived from
// `verse_cache.payload`.
export type SeenCommentator = { name: string; blocked: boolean; count: number };

export const listSeenCommentators = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SeenCommentator[]> => {
    assertAdmin(context.claims as Record<string, unknown>);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [aiCacheRes, verseCacheRes, blockRes, deletedRes] = await Promise.all([
      supabaseAdmin
        .from("ai_cache")
        .select("payload, fn_name")
        .like("fn_name", "commentary%")
        .limit(2000),
      supabaseAdmin.from("verse_cache").select("payload").limit(2000),
      supabaseAdmin.from("commentator_blocks").select("name_key"),
      supabaseAdmin.from("deleted_commentators").select("name_key"),
    ]);

    const blocked = new Set((blockRes.data ?? []).map((r) => String(r.name_key)));
    const deleted = new Set(
      (deletedRes.data ?? []).map((r) => String((r as { name_key: string }).name_key)),
    );
    const byKey = new Map<string, string>();
    const collect = (rows: Array<{ payload: unknown }> | null | undefined) => {
      for (const row of rows ?? []) {
        const payload = row.payload as { commentaries?: Array<{ author?: string }> } | null;
        const list = payload?.commentaries ?? [];
        for (const c of list) {
          const name = (c?.author ?? "").trim();
          if (!name) continue;
          const key = normalizeName(name);
          if (deleted.has(key)) continue;
          if (!byKey.has(key)) byKey.set(key, name);
        }
      }
    };
    collect(aiCacheRes.data as Array<{ payload: unknown }> | null);
    collect(verseCacheRes.data as Array<{ payload: unknown }> | null);

    for (const name of KNOWN_COMMENTATORS) {
      const key = normalizeName(name);
      if (deleted.has(key)) continue;
      if (!byKey.has(key)) byKey.set(key, name);
    }

    const stubRows = Array.from(byKey.entries()).map(([key, name]) => ({
      name_key: key,
      display_name: name,
    }));
    if (stubRows.length > 0) {
      await supabaseAdmin
        .from("commentator_overrides")
        .upsert(stubRows, { onConflict: "name_key,display_name", ignoreDuplicates: true });
    }

    const { data: allOverrides } = await supabaseAdmin
      .from("commentator_overrides")
      .select("name_key, display_name, usage_count");
    const countByKey = new Map<string, number>();
    for (const row of allOverrides ?? []) {
      const key = String((row as { name_key: string }).name_key);
      if (deleted.has(key)) continue;
      const name = String((row as { display_name: string }).display_name);
      const c = Number((row as { usage_count?: number }).usage_count ?? 0);
      if (!byKey.has(key)) byKey.set(key, name);
      countByKey.set(key, Math.max(countByKey.get(key) ?? 0, c));
    }

    return Array.from(byKey.entries())
      .map(([key, name]) => ({
        name,
        blocked: blocked.has(key),
        count: countByKey.get(key) ?? 0,
      }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  });

// Admin-only: returns the most recent lookup's commentator roster (global).
export type LastLookupRoster = { authors: string[]; updatedAt: string | null };
export const getLastLookupRoster = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<LastLookupRoster> => {
    assertAdmin(context.claims as Record<string, unknown>);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("commentator_lookup_history")
      .select("last_authors, updated_at")
      .eq("scope_key", "__global__")
      .maybeSingle();
    return {
      authors: ((data as any)?.last_authors ?? []) as string[],
      updatedAt: (data as any)?.updated_at ?? null,
    };
  });

// Admin-only: country breakdown (lifetime + 90-day daily).
export type CountryAnalytics = {
  totals: { country: string; total: number; lastSeen: string | null }[];
  daily: { country: string; day: string; count: number }[];
};
export const getCountryAnalytics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CountryAnalytics> => {
    assertAdmin(context.claims as Record<string, unknown>);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [totalsRes, dailyRes] = await Promise.all([
      supabaseAdmin.rpc("admin_country_totals"),
      supabaseAdmin.rpc("admin_country_daily", { p_days: 90 }),
    ]);
    return {
      totals: ((totalsRes.data as any[]) ?? []).map((r) => ({
        country: String(r.country),
        total: Number(r.total ?? 0),
        lastSeen: r.last_seen ?? null,
      })),
      daily: ((dailyRes.data as any[]) ?? []).map((r) => ({
        country: String(r.country),
        day: String(r.day),
        count: Number(r.count ?? 0),
      })),
    };
  });

const SetBlockInput = z.object({
  name: z.string().min(1).max(200),
  blocked: z.boolean(),
});

export const setCommentatorBlock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SetBlockInput.parse(input))
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    assertAdmin(context.claims as Record<string, unknown>);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const key = normalizeName(data.name);
    if (data.blocked) {
      await supabaseAdmin
        .from("commentator_blocks")
        .upsert(
          { name_key: key, display_name: data.name, blocked_by: context.userId },
          { onConflict: "name_key" },
        );
    } else {
      await supabaseAdmin.from("commentator_blocks").delete().eq("name_key", key);
    }
    return { ok: true };
  });

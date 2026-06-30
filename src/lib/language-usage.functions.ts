
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ADMIN_EMAIL = "gilbertbg@gmail.com";

function assertAdmin(claims: Record<string, unknown> | undefined) {
  const email = typeof claims?.email === "string" ? (claims.email as string).toLowerCase() : "";
  if (email !== ADMIN_EMAIL) throw new Error("Not found");
}

export type LanguageUsageRow = {
  language: string;
  selectedCount: number;
  activeCount: number;
  lastUsed: string | null;
};

export type LanguageUsageReport = {
  totalUsers: number;
  totalWithPreference: number;
  rows: LanguageUsageRow[];
};

export const getLanguageUsage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<LanguageUsageReport> => {
    assertAdmin(context.claims as Record<string, unknown>);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Selected language counts + last updated_at per language.
    const { data: prefs } = await supabaseAdmin
      .from("user_preferences")
      .select("user_id, language, updated_at");

    const since = new Date();
    since.setUTCDate(since.getUTCDate() - 30);
    const sinceIso = since.toISOString().slice(0, 10);

    // Active users in last 30 days (distinct user_id per language via join).
    const { data: active } = await supabaseAdmin
      .from("daily_usage")
      .select("user_id")
      .gte("usage_date", sinceIso)
      .not("user_id", "is", null);

    const activeUserIds = new Set<string>((active ?? []).map((r) => r.user_id as string));

    // Total users via auth admin.
    let totalUsers = 0;
    try {
      const { data } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1 });
      // @ts-expect-error total is present on the response
      totalUsers = Number(data?.total ?? 0);
    } catch {
      totalUsers = 0;
    }

    const byLang = new Map<string, { selected: number; active: number; lastUsed: string | null }>();
    for (const p of prefs ?? []) {
      const lang = String(p.language);
      const entry = byLang.get(lang) ?? { selected: 0, active: 0, lastUsed: null };
      entry.selected += 1;
      if (activeUserIds.has(p.user_id as string)) entry.active += 1;
      const ts = p.updated_at as string | null;
      if (ts && (!entry.lastUsed || ts > entry.lastUsed)) entry.lastUsed = ts;
      byLang.set(lang, entry);
    }

    const rows: LanguageUsageRow[] = [...byLang.entries()].map(([language, v]) => ({
      language,
      selectedCount: v.selected,
      activeCount: v.active,
      lastUsed: v.lastUsed,
    }));

    return {
      totalUsers,
      totalWithPreference: prefs?.length ?? 0,
      rows,
    };
  });

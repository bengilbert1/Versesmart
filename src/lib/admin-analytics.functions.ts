import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Admin email is hardcoded server-side. It never ships to the client bundle.
const ADMIN_EMAIL = "gilbertbg@gmail.com";

function assertAdmin(claims: Record<string, unknown> | undefined) {
  const email = typeof claims?.email === "string" ? (claims.email as string).toLowerCase() : "";
  if (email !== ADMIN_EMAIL) {
    // Generic message — never reveal the admin email or the existence of an admin role.
    throw new Error("Not found");
  }
}

export type AdminAnalytics = {
  totals: { today: number; last7: number; last30: number; allTime: number };
  topVerses: { key: string; count: number }[];
  topThemes: { key: string; count: number }[];
  topSections: { type: string; key: string; count: number }[];
  daily: { day: string; count: number }[];
  rolling7: { day: string; avg: number }[];
  heatmap: { dow: number; hour: number; count: number }[];
  tierBreakdown: { tier: string; count: number }[];
  funnel: { stage: string; count: number }[];
  retention: { dayOffset: number; retained: number; cohortSize: number; pct: number }[];
  featureUsage: { feature: string; count: number }[];
};

export const getAdminAnalytics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminAnalytics> => {
    assertAdmin(context.claims as Record<string, unknown>);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Last 60 days of daily volume, sorted ascending for charts.
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - 59);
    const sinceDay = since.toISOString().slice(0, 10);

    const [verses, themes, sections, daily, heatmap, tier, funnel, retention, features] =
      await Promise.all([
        supabaseAdmin
          .from("analytics_verse_searches")
          .select("reference_key, count")
          .order("count", { ascending: false })
          .limit(25),
        supabaseAdmin
          .from("analytics_theme_searches")
          .select("theme_key, count")
          .order("count", { ascending: false })
          .limit(25),
        supabaseAdmin
          .from("analytics_section_opens")
          .select("section_type, section_key, count")
          .order("count", { ascending: false })
          .limit(40),
        supabaseAdmin
          .from("analytics_daily_searches")
          .select("day, count")
          .gte("day", sinceDay)
          .order("day", { ascending: true }),
        supabaseAdmin.rpc("admin_search_heatmap"),
        supabaseAdmin.rpc("admin_searches_by_tier"),
        supabaseAdmin.rpc("admin_funnel"),
        supabaseAdmin.rpc("admin_retention_curve"),
        supabaseAdmin.rpc("admin_feature_usage"),
      ]);

    const dailyRows = (daily.data ?? []).map((r) => ({
      day: String(r.day),
      count: Number(r.count ?? 0),
    }));

    // 7-day rolling average (right-aligned). Sparse days padded with 0.
    const byDay = new Map(dailyRows.map((r) => [r.day, r.count]));
    const padded: { day: string; count: number }[] = [];
    const start = new Date(sinceDay + "T00:00:00Z");
    const today = new Date();
    for (let d = new Date(start); d <= today; d.setUTCDate(d.getUTCDate() + 1)) {
      const key = d.toISOString().slice(0, 10);
      padded.push({ day: key, count: byDay.get(key) ?? 0 });
    }
    const rolling7 = padded.map((row, i) => {
      const window = padded.slice(Math.max(0, i - 6), i + 1);
      const avg = window.reduce((a, r) => a + r.count, 0) / window.length;
      return { day: row.day, avg: Math.round(avg * 100) / 100 };
    });

    const todayStr = new Date().toISOString().slice(0, 10);
    const sumSince = (n: number) => {
      const cutoff = new Date();
      cutoff.setUTCDate(cutoff.getUTCDate() - (n - 1));
      const c = cutoff.toISOString().slice(0, 10);
      return dailyRows.filter((r) => r.day >= c).reduce((a, r) => a + r.count, 0);
    };

    const allTime = (verses.data ?? []).reduce((a, r) => a + Number(r.count ?? 0), 0);

    const retentionRows = ((retention.data as { day_offset: number; retained: number; cohort_size: number }[] | null) ?? []).map(
      (r) => ({
        dayOffset: Number(r.day_offset),
        retained: Number(r.retained ?? 0),
        cohortSize: Number(r.cohort_size ?? 0),
        pct:
          Number(r.cohort_size) > 0
            ? Math.round((Number(r.retained) / Number(r.cohort_size)) * 1000) / 10
            : 0,
      }),
    );

    return {
      totals: {
        today: dailyRows.find((r) => r.day === todayStr)?.count ?? 0,
        last7: sumSince(7),
        last30: sumSince(30),
        allTime,
      },
      topVerses: (verses.data ?? []).map((r) => ({
        key: String(r.reference_key),
        count: Number(r.count ?? 0),
      })),
      topThemes: (themes.data ?? []).map((r) => ({
        key: String(r.theme_key),
        count: Number(r.count ?? 0),
      })),
      topSections: (sections.data ?? []).map((r) => ({
        type: String(r.section_type),
        key: String(r.section_key),
        count: Number(r.count ?? 0),
      })),
      daily: dailyRows,
      rolling7,
      heatmap: ((heatmap.data as { dow: number; hour: number; count: number }[] | null) ?? []).map(
        (r) => ({ dow: Number(r.dow), hour: Number(r.hour), count: Number(r.count ?? 0) }),
      ),
      tierBreakdown: ((tier.data as { tier: string; count: number }[] | null) ?? []).map((r) => ({
        tier: String(r.tier),
        count: Number(r.count ?? 0),
      })),
      funnel: ((funnel.data as { stage: string; count: number }[] | null) ?? []).map((r) => ({
        stage: String(r.stage),
        count: Number(r.count ?? 0),
      })),
      retention: retentionRows,
      featureUsage: ((features.data as { feature: string; count: number }[] | null) ?? []).map(
        (r) => ({ feature: String(r.feature), count: Number(r.count ?? 0) }),
      ),
    };
  });

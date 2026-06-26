import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { DEFAULT_VOTD, DEFAULT_SUMMARIES, getDayOfYearForDate, type VotdEntry, type VotdSummaries } from "./votd-defaults";

const ADMIN_EMAIL = "gilbertbg@gmail.com";

function assertAdmin(claims: Record<string, unknown> | undefined) {
  const email = typeof claims?.email === "string" ? (claims.email as string).toLowerCase() : "";
  if (email !== ADMIN_EMAIL) throw new Error("Not found");
}

function summariesFrom(
  row: { guilt_innocence_summary?: string | null; shame_honour_summary?: string | null; fear_power_summary?: string | null } | null | undefined,
): VotdSummaries {
  return {
    guiltInnocence: row?.guilt_innocence_summary?.trim() || DEFAULT_SUMMARIES.guiltInnocence,
    shameHonour: row?.shame_honour_summary?.trim() || DEFAULT_SUMMARIES.shameHonour,
    fearPower: row?.fear_power_summary?.trim() || DEFAULT_SUMMARIES.fearPower,
  };
}

export type VotdToday =
  | { enabled: true; reference: string; excerpt: string; summaries: VotdSummaries; dayOfYear: number }
  | { enabled: false };

function normalizeRef(r: string): string {
  return r.trim().toLowerCase().replace(/\s+/g, " ");
}

// Find the dayOfYear in DEFAULT_VOTD whose reference matches.
function dayForReference(ref: string): number | null {
  const target = normalizeRef(ref);
  if (!target) return null;
  const hit = DEFAULT_VOTD.find((e) => normalizeRef(e.reference) === target);
  return hit ? hit.dayOfYear : null;
}

// Public — anyone can fetch today's verse of the day.
export const getVerseOfTheDay = createServerFn({ method: "GET" }).handler(async (): Promise<VotdToday> => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [{ data: settings }, today] = await Promise.all([
    supabaseAdmin
      .from("votd_settings")
      .select(
        "enabled, override_reference, override_excerpt, override_date, override_guilt_innocence, override_shame_honour, override_fear_power",
      )
      .eq("id", 1)
      .maybeSingle(),
    Promise.resolve(new Date()),
  ]);

  if (!settings || settings.enabled === false) return { enabled: false };

  const todayStr = today.toISOString().slice(0, 10);
  const todayDay = getDayOfYearForDate(today);

  if (
    settings.override_reference &&
    settings.override_excerpt &&
    settings.override_date === todayStr
  ) {
    // Resolve the override reference back to its day in the 365-day cycle so
    // worldview summaries (static + localized) match the overridden verse.
    const matchedDay = dayForReference(settings.override_reference);
    const base = (matchedDay ? DEFAULT_VOTD[matchedDay - 1].summaries : null) ?? DEFAULT_SUMMARIES;
    return {
      enabled: true,
      reference: settings.override_reference,
      excerpt: settings.override_excerpt,
      summaries: {
        guiltInnocence: settings.override_guilt_innocence?.trim() || base.guiltInnocence,
        shameHonour: settings.override_shame_honour?.trim() || base.shameHonour,
        fearPower: settings.override_fear_power?.trim() || base.fearPower,
      },
      dayOfYear: matchedDay ?? todayDay,
    };
  }

  const { data: override } = await supabaseAdmin
    .from("votd_overrides")
    .select("reference, excerpt, guilt_innocence_summary, shame_honour_summary, fear_power_summary")
    .eq("day_of_year", todayDay)
    .maybeSingle();

  if (override) {
    const matchedDay = dayForReference(override.reference) ?? todayDay;
    return {
      enabled: true,
      reference: override.reference,
      excerpt: override.excerpt,
      summaries: summariesFrom(override),
      dayOfYear: matchedDay,
    };
  }
  const fallback = DEFAULT_VOTD[todayDay - 1];
  return {
    enabled: true,
    reference: fallback.reference,
    excerpt: fallback.excerpt,
    summaries: fallback.summaries ?? DEFAULT_SUMMARIES,
    dayOfYear: todayDay,
  };
});

export type VotdAdminPayload = {
  enabled: boolean;
  overrideReference: string | null;
  overrideExcerpt: string | null;
  overrideDate: string | null;
  overrideGuiltInnocence: string | null;
  overrideShameHonour: string | null;
  overrideFearPower: string | null;
  todayDayOfYear: number;
  todayResolvedDayOfYear: number;
  today: { reference: string; excerpt: string; summaries: VotdSummaries; dayOfYear: number };
  entries: VotdEntry[];
};

export const getVerseOfTheDayAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<VotdAdminPayload> => {
    assertAdmin(context.claims as Record<string, unknown>);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: settings }, { data: overrides }] = await Promise.all([
      supabaseAdmin
        .from("votd_settings")
        .select(
          "enabled, override_reference, override_excerpt, override_date, override_guilt_innocence, override_shame_honour, override_fear_power",
        )
        .eq("id", 1)
        .maybeSingle(),
      supabaseAdmin
        .from("votd_overrides")
        .select("day_of_year, reference, excerpt, guilt_innocence_summary, shame_honour_summary, fear_power_summary"),
    ]);

    const overrideMap = new Map<
      number,
      { reference: string; excerpt: string; summaries: VotdSummaries }
    >();
    for (const o of overrides ?? []) {
      overrideMap.set(o.day_of_year, {
        reference: o.reference,
        excerpt: o.excerpt,
        summaries: summariesFrom(o),
      });
    }

    const entries: VotdEntry[] = DEFAULT_VOTD.map((d) => {
      const o = overrideMap.get(d.dayOfYear);
      if (o) return { dayOfYear: d.dayOfYear, reference: o.reference, excerpt: o.excerpt, summaries: o.summaries };
      return { ...d, summaries: d.summaries ?? DEFAULT_SUMMARIES };
    });

    const todayDayOfYear = getDayOfYearForDate(new Date());
    const today = entries[todayDayOfYear - 1];

    // When today's verse is overridden via settings (one-off), resolve which
    // day in the static cycle its summaries should come from. Otherwise the
    // resolved day is just today.
    const todayStr = new Date().toISOString().slice(0, 10);
    const settingsOverrideActive =
      !!settings?.override_reference &&
      !!settings?.override_excerpt &&
      settings?.override_date === todayStr;
    const resolvedDay = settingsOverrideActive
      ? dayForReference(settings!.override_reference!) ?? todayDayOfYear
      : todayDayOfYear;

    return {
      enabled: settings?.enabled ?? true,
      overrideReference: settings?.override_reference ?? null,
      overrideExcerpt: settings?.override_excerpt ?? null,
      overrideDate: settings?.override_date ?? null,
      overrideGuiltInnocence: settings?.override_guilt_innocence ?? null,
      overrideShameHonour: settings?.override_shame_honour ?? null,
      overrideFearPower: settings?.override_fear_power ?? null,
      todayDayOfYear,
      todayResolvedDayOfYear: resolvedDay,
      today: {
        reference: today.reference,
        excerpt: today.excerpt,
        summaries: today.summaries ?? DEFAULT_SUMMARIES,
        dayOfYear: resolvedDay,
      },
      entries,
    };
  });

export const updateVerseOfTheDaySettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    enabled?: boolean;
    overrideReference?: string | null;
    overrideExcerpt?: string | null;
    overrideDate?: string | null;
    overrideGuiltInnocence?: string | null;
    overrideShameHonour?: string | null;
    overrideFearPower?: string | null;
  }) => input)
  .handler(async ({ data, context }) => {
    assertAdmin(context.claims as Record<string, unknown>);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: {
      updated_at: string;
      enabled?: boolean;
      override_reference?: string | null;
      override_excerpt?: string | null;
      override_date?: string | null;
      override_guilt_innocence?: string | null;
      override_shame_honour?: string | null;
      override_fear_power?: string | null;
    } = { updated_at: new Date().toISOString() };
    if (typeof data.enabled === "boolean") patch.enabled = data.enabled;
    if ("overrideReference" in data) patch.override_reference = data.overrideReference || null;
    if ("overrideExcerpt" in data) patch.override_excerpt = data.overrideExcerpt || null;
    if ("overrideDate" in data) patch.override_date = data.overrideDate || null;
    if ("overrideGuiltInnocence" in data) patch.override_guilt_innocence = data.overrideGuiltInnocence || null;
    if ("overrideShameHonour" in data) patch.override_shame_honour = data.overrideShameHonour || null;
    if ("overrideFearPower" in data) patch.override_fear_power = data.overrideFearPower || null;
    const { error } = await supabaseAdmin.from("votd_settings").update(patch).eq("id", 1);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateVerseOfTheDayEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    dayOfYear: number;
    reference: string;
    excerpt: string;
    guiltInnocenceSummary?: string | null;
    shameHonourSummary?: string | null;
    fearPowerSummary?: string | null;
  }) => {
    if (!Number.isInteger(input.dayOfYear) || input.dayOfYear < 1 || input.dayOfYear > 365) {
      throw new Error("Invalid dayOfYear");
    }
    if (!input.reference?.trim() || !input.excerpt?.trim()) throw new Error("Reference and excerpt required");
    if (input.reference.length > 200 || input.excerpt.length > 500) throw new Error("Too long");
    for (const f of [input.guiltInnocenceSummary, input.shameHonourSummary, input.fearPowerSummary]) {
      if (typeof f === "string" && f.length > 600) throw new Error("Summary too long");
    }
    return input;
  })
  .handler(async ({ data, context }) => {
    assertAdmin(context.claims as Record<string, unknown>);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("votd_overrides")
      .upsert({
        day_of_year: data.dayOfYear,
        reference: data.reference.trim(),
        excerpt: data.excerpt.trim(),
        guilt_innocence_summary: data.guiltInnocenceSummary?.trim() || null,
        shame_honour_summary: data.shameHonourSummary?.trim() || null,
        fear_power_summary: data.fearPowerSummary?.trim() || null,
        updated_at: new Date().toISOString(),
      });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const resetVerseOfTheDayEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { dayOfYear: number }) => input)
  .handler(async ({ data, context }) => {
    assertAdmin(context.claims as Record<string, unknown>);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("votd_overrides").delete().eq("day_of_year", data.dayOfYear);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

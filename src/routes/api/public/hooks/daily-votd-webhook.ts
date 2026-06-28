
import { DEFAULT_VOTD, DEFAULT_SUMMARIES, getDayOfYearForDate } from "@/lib/votd-defaults";
import votdEn from "@/locales/votd/en.json";

// Fixed daily template image sent to Make.com.
// Edit this constant to change the image used in every daily payload.
const VOTD_IMAGE_URL = "https://versesmart.org/og-image.jpg";

const MAKE_WEBHOOK_URL =
  "https://hook.eu1.make.com/ly6j6skclo2t2sj8otupbfnpx4aop76u";

type VotdBundleEntry = { gi: string; sh: string; fp: string };
const VOTD_EN = votdEn as Record<string, VotdBundleEntry>;

function normalizeRef(r: string): string {
  return r.trim().toLowerCase().replace(/\s+/g, " ");
}

function dayForReference(ref: string): number | null {
  const target = normalizeRef(ref);
  if (!target) return null;
  const hit = DEFAULT_VOTD.find((e) => normalizeRef(e.reference) === target);
  return hit ? hit.dayOfYear : null;
}

export const Route = createFileRoute("/api/public/hooks/daily-votd-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Auth: pg_cron sends the Supabase anon key as `apikey`.
        const apikey = request.headers.get("apikey");
        if (!apikey || apikey !== process.env.SUPABASE_PUBLISHABLE_KEY) {
          return new Response("Unauthorized", { status: 401 });
        }

        try {
          const { supabaseAdmin } = await import(
            "@/integrations/supabase/client.server"
          );

          const today = new Date();
          const todayStr = today.toISOString().slice(0, 10);
          const todayDay = getDayOfYearForDate(today);

          const { data: settings } = await supabaseAdmin
            .from("votd_settings")
            .select(
              "enabled, override_reference, override_excerpt, override_date, override_guilt_innocence, override_shame_honour, override_fear_power",
            )
            .eq("id", 1)
            .maybeSingle();

          if (settings && settings.enabled === false) {
            return Response.json({ ok: true, skipped: "disabled" });
          }

          let reference: string;
          let excerpt: string;
          let summaryDay = todayDay;
          let overrideGi: string | null = null;
          let overrideSh: string | null = null;
          let overrideFp: string | null = null;

          if (
            settings?.override_reference &&
            settings?.override_excerpt &&
            settings?.override_date === todayStr
          ) {
            reference = settings.override_reference;
            excerpt = settings.override_excerpt;
            summaryDay = dayForReference(settings.override_reference) ?? todayDay;
            overrideGi = settings.override_guilt_innocence ?? null;
            overrideSh = settings.override_shame_honour ?? null;
            overrideFp = settings.override_fear_power ?? null;
          } else {
            const { data: override } = await supabaseAdmin
              .from("votd_overrides")
              .select(
                "reference, excerpt, guilt_innocence_summary, shame_honour_summary, fear_power_summary",
              )
              .eq("day_of_year", todayDay)
              .maybeSingle();
            if (override) {
              reference = override.reference;
              excerpt = override.excerpt;
              summaryDay = dayForReference(override.reference) ?? todayDay;
              overrideGi = override.guilt_innocence_summary ?? null;
              overrideSh = override.shame_honour_summary ?? null;
              overrideFp = override.fear_power_summary ?? null;
            } else {
              const fallback = DEFAULT_VOTD[todayDay - 1];
              reference = fallback.reference;
              excerpt = fallback.excerpt;
            }
          }

          // Resolve the "voices agree" summaries shown on the homepage VOTD
          // dropdown (English). Priority: admin override → per-day en.json
          // bundle → DEFAULT_SUMMARIES.
          const bundleEntry = VOTD_EN[String(summaryDay)];
          const guiltInnocenceText =
            overrideGi?.trim() || bundleEntry?.gi || DEFAULT_SUMMARIES.guiltInnocence;
          const shameHonourText =
            overrideSh?.trim() || bundleEntry?.sh || DEFAULT_SUMMARIES.shameHonour;
          const fearPowerText =
            overrideFp?.trim() || bundleEntry?.fp || DEFAULT_SUMMARIES.fearPower;

          const payload = {
            date: todayStr,
            dayOfYear: todayDay,
            reference,
            excerpt,
            imageUrl: VOTD_IMAGE_URL,
            guiltInnocenceText,
            shameHonourText,
            fearPowerText,
          };

          console.log(JSON.stringify(payload, null, 2));

          const res = await fetch(MAKE_WEBHOOK_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

          if (!res.ok) {
            const text = await res.text().catch(() => "");
            return Response.json(
              { ok: false, status: res.status, body: text.slice(0, 500) },
              { status: 502 },
            );
          }

          return Response.json({ ok: true, sent: payload });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return Response.json({ ok: false, error: message }, { status: 500 });
        }
      },
    },
  },
});

// Silence unused-export warning for the helper import in some build modes.
void DEFAULT_SUMMARIES;

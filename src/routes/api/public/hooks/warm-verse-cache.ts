// Nightly verse-cache warmer.
//
// Walks the curated POPULAR_VERSES list and triggers getPublicCommentary for
// each slug. getPublicCommentary already returns the cached payload when one
// exists, and writes to verse_cache when it doesn't — so this is a safe,
// idempotent way to pre-warm the cache for the highest-traffic verses.
//
// Authenticated via the project's anon/publishable key in the `apikey` header,
// matching the existing commentator-audit hook.
//
// Safety:
//   - Caps how many verses are processed per invocation (Cloudflare Workers
//     have a wall-clock budget; AI calls can be slow).
//   - Runs serially to avoid hammering the AI gateway / hitting rate limits.
//   - Skips any verse that's already cached and "fresh" (default 7 days).
//   - Catches per-verse errors so one failure can't poison the whole run.
//
// Optional query params:
//   ?limit=N       — max verses to process this run (default 25, max 100)
//   ?offset=M      — start index into POPULAR_VERSES (default 0)
//   ?force=1       — re-warm even if a fresh cache entry exists
//   ?maxAgeDays=N  — treat entries older than N days as stale (default 7)
import { createFileRoute } from "@tanstack/react-router";
import { POPULAR_VERSES } from "@/lib/popular-verses";
import { referenceToSlug } from "@/lib/verse-slug";
import { getPublicCommentary } from "@/lib/verse-page.functions";

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;
const DEFAULT_MAX_AGE_DAYS = 7;

export const Route = createFileRoute("/api/public/hooks/warm-verse-cache")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const provided = request.headers.get("apikey") ?? "";
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY ?? "";
        if (!expected || provided !== expected) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        const url = new URL(request.url);
        const limit = Math.min(
          MAX_LIMIT,
          Math.max(1, Number(url.searchParams.get("limit")) || DEFAULT_LIMIT),
        );
        const offset = Math.max(0, Number(url.searchParams.get("offset")) || 0);
        const force = url.searchParams.get("force") === "1";
        const maxAgeDays = Math.max(
          1,
          Number(url.searchParams.get("maxAgeDays")) || DEFAULT_MAX_AGE_DAYS,
        );
        const freshCutoffMs = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;

        const slice = POPULAR_VERSES.slice(offset, offset + limit);

        // Pre-fetch which slugs are already fresh so we skip them entirely
        // (avoids unnecessary AI calls during nightly warming).
        const freshSlugs = new Set<string>();
        if (!force) {
          try {
            const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
            const slugs = slice.map((r) => referenceToSlug(r));
            const { data } = await supabaseAdmin
              .from("verse_cache")
              .select("slug, updated_at")
              .in("slug", slugs)
              .eq("translation", "WEB");
            for (const row of (data ?? []) as Array<{ slug: string; updated_at: string | null }>) {
              const updated = row.updated_at ? new Date(row.updated_at).getTime() : 0;
              if (updated >= freshCutoffMs) freshSlugs.add(row.slug);
            }
          } catch (e) {
            console.error("warm-verse-cache: fresh-check failed", e);
          }
        }

        const startedAt = Date.now();
        const results = {
          ran_at: new Date().toISOString(),
          total_candidates: slice.length,
          warmed: 0,
          skipped_fresh: 0,
          failed: 0,
          failures: [] as Array<{ reference: string; error: string }>,
        };

        for (const reference of slice) {
          const slug = referenceToSlug(reference);
          if (freshSlugs.has(slug)) {
            results.skipped_fresh += 1;
            continue;
          }
          try {
            await getPublicCommentary({ data: { slug, translation: "WEB" } });
            results.warmed += 1;
          } catch (e: unknown) {
            results.failed += 1;
            const message = e instanceof Error ? e.message : String(e);
            results.failures.push({ reference, error: message.slice(0, 200) });
            console.error(`warm-verse-cache: ${reference} failed:`, message);
          }
          // Gentle pacing — keeps us well under any AI gateway rate limits.
          await new Promise((r) => setTimeout(r, 150));
        }

        return new Response(
          JSON.stringify({
            ok: true,
            duration_ms: Date.now() - startedAt,
            next_offset: offset + slice.length,
            has_more: offset + slice.length < POPULAR_VERSES.length,
            ...results,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});

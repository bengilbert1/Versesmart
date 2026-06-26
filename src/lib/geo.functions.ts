import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";

function readCountryHeader(): string | null {
  try {
    const country =
      getRequestHeader("cf-ipcountry") ||
      getRequestHeader("x-vercel-ip-country") ||
      getRequestHeader("x-country-code") ||
      null;
    if (!country || country === "XX" || country === "T1") return null;
    return country.toUpperCase();
  } catch {
    return null;
  }
}

// Returns the visitor's ISO country code based on Cloudflare's `cf-ipcountry`
// header (available on Workers without any external geo-IP service).
// Returns null on local dev or anywhere the header is missing.
export const getVisitorCountry = createServerFn({ method: "GET" }).handler(async () => {
  return { country: readCountryHeader() };
});

// Records one visit per (client_id, day) per country. Idempotent — safe to
// call on every page load. Used by the admin "users by country" tracker.
export const recordCountryVisit = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        clientId: z.string().uuid(),
        country: z.string().min(2).max(4).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const country = (data.country ?? readCountryHeader())?.toUpperCase() ?? null;
    if (!country) return { ok: false, country: null };
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.rpc("record_country_visit", {
        p_client_id: data.clientId,
        p_country: country,
      });
      return { ok: true, country };
    } catch (e) {
      console.error("recordCountryVisit failed", e);
      return { ok: false, country };
    }
  });

// Client-side fire-and-forget analytics. All RPCs are SECURITY DEFINER in
// the database and only ever increment aggregated counters — no per-user
// data is ever sent or stored.
import { supabase } from "@/integrations/supabase/client";

function fire(p: PromiseLike<unknown>) {
  // Never throw out of a tracker; never block the UI.
  Promise.resolve(p).catch(() => {});
}

export function trackVerseSearch(reference: string) {
  if (!reference?.trim()) return;
  fire(supabase.rpc("track_verse_search", { p_reference: reference }));
}

export function trackThemeSearch(query: string) {
  if (!query?.trim()) return;
  fire(supabase.rpc("track_theme_search", { p_query: query }));
}

export function trackSectionOpen(type: string, key: string) {
  if (!type || !key) return;
  fire(supabase.rpc("track_section_open", { p_type: type, p_key: key }));
}

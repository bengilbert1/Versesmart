import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { normalizeName } from "./commentator-metadata";
import { KNOWN_COMMENTATORS } from "./known-commentators";

const ADMIN_EMAIL = "gilbertbg@gmail.com";

function assertAdmin(claims: Record<string, unknown> | undefined) {
  const email =
    typeof claims?.email === "string"
      ? (claims.email as string).toLowerCase()
      : "";
  if (email !== ADMIN_EMAIL) throw new Error("Not found");
}

export type BlockedCommentator = {
  name_key: string;
  display_name: string;
};

/* -------------------------
   API WRAPPERS (CLIENT SAFE)
-------------------------- */

export async function listBlockedCommentators(): Promise<
  BlockedCommentator[]
> {
  const res = await fetch("/api/commentators/blocked");
  if (!res.ok) return [];
  return res.json();
}

export type SeenCommentator = {
  name: string;
  blocked: boolean;
  count: number;
};

export async function listSeenCommentators(): Promise<SeenCommentator[]> {
  const res = await fetch("/api/commentators/seen");
  if (!res.ok) return [];
  return res.json();
}

export type LastLookupRoster = {
  authors: string[];
  updatedAt: string | null;
};

export async function getLastLookupRoster(): Promise<LastLookupRoster> {
  const res = await fetch("/api/commentators/last-lookup");
  if (!res.ok) return { authors: [], updatedAt: null };
  return res.json();
}

export type CountryAnalytics = {
  totals: { country: string; total: number; lastSeen: string | null }[];
  daily: { country: string; day: string; count: number }[];
};

export async function getCountryAnalytics(): Promise<CountryAnalytics> {
  const res = await fetch("/api/commentators/country-analytics");
  if (!res.ok) {
    return { totals: [], daily: [] };
  }
  return res.json();
}

const SetBlockInput = z.object({
  name: z.string().min(1).max(200),
  blocked: z.boolean(),
});

export async function setCommentatorBlock(input: unknown): Promise<{ ok: true }> {
  const data = SetBlockInput.parse(input);

  const res = await fetch("/api/commentators/block", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!res.ok) throw new Error("Failed to update block status");

  return { ok: true };
}
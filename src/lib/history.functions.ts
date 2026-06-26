import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { getUserTier } from "./tier-server";
import { TIER_LIMITS } from "./tiers";

async function getUser(): Promise<{ id: string; email: string | null } | null> {
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
    return data.user ? { id: data.user.id, email: data.user.email ?? null } : null;
  } catch {
    return null;
  }
}

function admin() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export type HistoryEntry = {
  id: string;
  reference: string;
  translation: string;
  created_at: string;
};

export const listSearchHistory = createServerFn({ method: "GET" })
  .handler(async (): Promise<{ entries: HistoryEntry[] }> => {
    const user = await getUser();
    if (!user) return { entries: [] };

    const tier = await getUserTier(user.id, user.email, "live");
    const limit = TIER_LIMITS[tier].historyLimit;

    const { data, error } = await admin()
      .from("search_history")
      .select("id, reference, translation, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) {
      console.error("listSearchHistory:", error);
      return { entries: [] };
    }
    return { entries: (data ?? []) as HistoryEntry[] };
  });

export const deleteSearchHistoryEntry = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const user = await getUser();
    if (!user) throw new Error("Not authenticated");
    const { error } = await admin()
      .from("search_history")
      .delete()
      .eq("id", data.id)
      .eq("user_id", user.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

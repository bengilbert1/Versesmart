import { createClient } from "@supabase/supabase-js";
import { tierFromPriceId, type Tier } from "./tiers";

export const ALWAYS_PRO_EMAILS = new Set([
  "gilbertbg@gmail.com",
  "shiyanirefuge@gmail.com",
  "dangi@mailglobex.com",
]);

export function isOwnerEmail(email: string | null | undefined): boolean {
  return !!email && ALWAYS_PRO_EMAILS.has(email.toLowerCase());
}

// Returns true if the user has an active, non-expired tester row.
// If the row is expired but is_tester is still true, flip it to false
// (lazy cleanup at next access).
export async function isActiveTester(userId: string | null): Promise<boolean> {
  if (!userId) return false;
  try {
    const { data } = await admin()
      .from("testers")
      .select("is_tester,expires_at")
      .eq("user_id", userId)
      .maybeSingle();
    if (!data) return false;
    const expired = !data.expires_at || new Date(data.expires_at).getTime() <= Date.now();
    if (expired) {
      if (data.is_tester) {
        await admin().from("testers").update({ is_tester: false }).eq("user_id", userId);
      }
      return false;
    }
    return !!data.is_tester;
  } catch {
    return false;
  }
}


let _admin: any = null;
function admin(): any {
  if (!_admin) {
    _admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  }
  return _admin;
}

// Resolve the effective tier for a user in a given Paddle env.
// Returns "free" if no active sub. Grandfathered "unlimited_*" plans → basic.
export async function getUserTier(
  userId: string | null,
  email: string | null,
  environment: "sandbox" | "live",
): Promise<Tier> {
  if (email && ALWAYS_PRO_EMAILS.has(email.toLowerCase())) return "explore";
  if (!userId) return "free";

  const { data } = await admin()
    .from("subscriptions")
    .select("status,price_id,current_period_end")
    .eq("user_id", userId)
    .eq("environment", environment)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return "free";

  const now = Date.now();
  const end = data.current_period_end ? new Date(data.current_period_end).getTime() : Infinity;
  const active =
    (["active", "trialing", "past_due"].includes(data.status) && (end === Infinity || end > now)) ||
    (data.status === "canceled" && end > now);

  if (!active) return "free";
  return tierFromPriceId(data.price_id);
}

export function firstOfMonthUtcISO(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

// Count distinct (reference_key) rows for a user this calendar month.
export async function getMonthlySearchCount(userId: string): Promise<number> {
  const since = firstOfMonthUtcISO();
  const { count } = await admin()
    .from("daily_usage")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", since);
  return count ?? 0;
}

// Count lookups today for a free user keyed by client_id (anon) or user_id.
export async function getDailySearchCount(
  userId: string | null,
  clientId: string | null,
): Promise<number> {
  if (!userId && !clientId) return 0;
  const today = new Date().toISOString().slice(0, 10);
  const q = admin()
    .from("daily_usage")
    .select("id", { count: "exact", head: true })
    .eq("usage_date", today);
  if (userId) q.eq("user_id", userId);
  else q.eq("client_id", clientId);
  const { count } = await q;
  return count ?? 0;
}

// Count distinct lookups this month for a free user keyed by client_id.
export async function getMonthlySearchCountByClient(clientId: string): Promise<number> {
  const since = firstOfMonthUtcISO();
  const { count } = await admin()
    .from("daily_usage")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId)
    .gte("created_at", since);
  return count ?? 0;
}


export async function logSearchUsage(
  userId: string | null,
  clientId: string | null,
  refKey: string,
) {
  if (!userId && !clientId) return;
  const today = new Date().toISOString().slice(0, 10);
  try {
    // Skip if this exact ref was already logged today for this user/client
    const q = admin().from("daily_usage").select("id").eq("usage_date", today).eq("reference_key", refKey).limit(1);
    if (userId) q.eq("user_id", userId);
    else q.eq("client_id", clientId);
    const { data: existing } = await q;
    if (existing && existing.length > 0) return;
    await admin().from("daily_usage").insert({
      user_id: userId,
      client_id: clientId ?? "00000000-0000-0000-0000-000000000000",
      usage_date: today,
      reference_key: refKey,
    });
  } catch (e) {
    console.error("daily_usage insert failed:", e);
  }
}


import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import {
  getDailySearchCount,
  getMonthlySearchCount,
  getMonthlySearchCountByClient,
  getUserTier,
  isOwnerEmail,
} from "./tier-server";
import { TIER_LIMITS, nextResetUtcISO, type Tier } from "./tiers";


async function getUserFromAuthHeader(): Promise<{ id: string; email: string | null } | null> {
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
    if (!data.user) return null;
    return { id: data.user.id, email: data.user.email ?? null };
  } catch {
    return null;
  }
}

export type UsageSummary = {
  tier: Tier;
  resetAt: string; // ISO; first of next month UTC
  searches: {
    used: number;
    limit: number | "unlimited";
    period: "month";
    dailyUsed?: number;
    dailyLimit?: number;
  };
};

export const getUsageSummary = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ environment: z.enum(["sandbox", "live"]).default("sandbox") }).parse(input),
  )
  .handler(async ({ data }): Promise<UsageSummary> => {
    const authUser = await getUserFromAuthHeader();
    const userId = authUser?.id ?? null;
    const tier = await getUserTier(userId, authUser?.email ?? null, data.environment);
    const limits = TIER_LIMITS[tier];
    const resetAt = nextResetUtcISO();

    if (isOwnerEmail(authUser?.email)) {
      const searchUsed = userId ? await getMonthlySearchCount(userId) : 0;
      return {
        tier,
        resetAt,
        searches: { used: searchUsed, limit: "unlimited", period: "month" },
      };
    }

    if (tier === "free") {

      const monthUsed = userId ? await getMonthlySearchCountByClient(userId) : 0;
      const dailyUsed = userId ? await getDailySearchCount(userId, null) : 0;
      return {
        tier,
        resetAt,
        searches: {
          used: monthUsed,
          limit: limits.monthlySearches,
          period: "month",
          dailyUsed,
          dailyLimit: limits.dailySearches ?? 3,
        },
      };
    }

    const searchUsed = userId ? await getMonthlySearchCount(userId) : 0;

    return {
      tier,
      resetAt,
      searches: {
        used: searchUsed,
        limit: limits.monthlySearches,
        period: "month",
      },
    };
  });

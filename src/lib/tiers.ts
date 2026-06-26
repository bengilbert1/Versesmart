// Single source of truth for plan tiers, limits, and priority.

export type Tier = "free" | "engage" | "explore";

export type TierLimits = {
  monthlySearches: number | "unlimited";
  dailySearches: number | null; // free-only extra cap
  historyLimit: number;
};

export const TIER_LIMITS: Record<Tier, TierLimits> = {
  free: {
    monthlySearches: "unlimited",
    dailySearches: 3,
    historyLimit: 10,
  },
  engage: {
    monthlySearches: 300,
    dailySearches: null,
    historyLimit: 50,
  },
  explore: {
    monthlySearches: 1000,
    dailySearches: null,
    historyLimit: 100,
  },
};

export const TIER_LABEL: Record<Tier, string> = {
  free: "Entry",
  engage: "Engage",
  explore: "Explore",
};

// Map a Paddle price_id to a tier. Legacy "unlimited_*" subscribers from the
// original $4.99 plan are grandfathered into Engage. Legacy "pro_monthly"
// subscribers (old £19.99 tier, now removed) are mapped up to Explore.
export function tierFromPriceId(priceId: string | null | undefined): Tier {
  if (!priceId) return "free";
  switch (priceId) {
    case "plus_monthly":
    case "pro_monthly":
      return "explore";
    case "basic_monthly":
    case "unlimited_monthly":
    case "unlimited_yearly":
      return "engage";
    default:
      return "free";
  }
}

export function firstOfMonthUtcISO(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

// First of next month UTC — when usage counters implicitly reset.
export function nextResetUtcISO(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString();
}

// Lower = higher priority. Used by selectPriority(); the runtime is stateless
// so this is mostly informational, but consumed where ordering matters.
export function tierPriority(tier: Tier): 1 | 2 | 3 {
  switch (tier) {
    case "explore":
      return 1;
    case "engage":
      return 2;
    default:
      return 3;
  }
}

// Hybrid model routing: GPT-5 Mini only for the modern voices comparison
// (premium differentiator). Everything else runs on the fastest/cheapest
// Gemini model to keep latency low and margins healthy.
export type TaskType =
  | "verse_lookup"
  | "commentary_retrieval"
  | "summarisation"
  | "keyword_extraction"
  | "classification"
  | "related_verses"
  | "theological_comparison"
  | "deep_analysis"
  | "multi_commentary_synthesis";

export function selectModel(_taskType: TaskType): string {
  // Standardised on a single low-cost model across all AI server fns.
  return "google/gemini-2.5-flash-lite";
}

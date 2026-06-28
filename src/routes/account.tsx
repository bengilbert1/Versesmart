
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { TIER_LABEL, TIER_LIMITS } from "@/lib/tiers";
import { supabase } from "@/integrations/supabase/client";
import { createPortalSession } from "@/utils/payments.functions";
import {
  listSearchHistory,
  deleteSearchHistoryEntry,
} from "@/lib/history.functions";
import { getUsageSummary } from "@/lib/usage.functions";
import { getPaddleEnvironment } from "@/lib/paddle";
import { toast } from "sonner";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useLanguage } from "@/lib/language-context";

export const Route = createFileRoute("/account")({
  head: () => ({
    meta: [
      { title: "Your Account — VerseSmart" },
      { name: "description", content: "Manage your VerseSmart subscription, search history, and account settings." },
      { property: "og:title", content: "Your Account — VerseSmart" },
      { property: "og:description", content: "Manage your VerseSmart subscription, search history, and account settings." },
      { property: "og:url", content: "https://versesmart.org/account" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "https://versesmart.org/account" }],
  }),
  component: AccountPage,
});

function AccountPage() {
  const { user, loading } = useAuth();
  const { subscription, isActive, tier, loading: subLoading } = useSubscription();
  const navigate = useNavigate();
  const portalFn = useServerFn(createPortalSession);
  const [portalLoading, setPortalLoading] = useState(false);
  const { t } = useLanguage();

  const fetchHistory = useServerFn(listSearchHistory);
  const deleteHistoryFn = useServerFn(deleteSearchHistoryEntry);
  const qc = useQueryClient();
  const { data: historyData } = useQuery({
    queryKey: ["search-history"],
    queryFn: () => fetchHistory(),
    enabled: !!user,
    staleTime: 30_000,
  });
  const history = historyData?.entries ?? [];
  const historyLimit = tier ? TIER_LIMITS[tier].historyLimit : 0;

  const fetchUsage = useServerFn(getUsageSummary);
  const { data: usage } = useQuery({
    queryKey: ["usage-summary"],
    queryFn: () => fetchUsage({ data: { environment: getPaddleEnvironment() } }),
    enabled: !!user,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  if (loading || !user) {
    return <main className="mx-auto max-w-2xl px-5 py-20 text-center text-muted-foreground">{t("accountPage.loading")}</main>;
  }

  const removeHistory = async (id: string) => {
    try {
      await deleteHistoryFn({ data: { id } });
      qc.invalidateQueries({ queryKey: ["search-history"] });
    } catch (e: any) {
      toast.error(e?.message ?? t("accountPage.couldNotDelete"));
    }
  };

  const openPortal = async () => {
    setPortalLoading(true);
    try {
      const { url } = await portalFn();
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e: any) {
      toast.error(e?.message ?? t("accountPage.couldNotOpenPortal"));
    } finally {
      setPortalLoading(false);
    }
  };

  const signOut = async () => {
    try {
      const { clearUserSelection } = await import("@/components/CommentatorCompareControl");
      clearUserSelection();
    } catch {}
    await supabase.auth.signOut();
    navigate({ to: "/" });
  };

  return (
    <main className="mx-auto max-w-2xl px-5 py-12 sm:py-16">
      <h1 className="font-display text-3xl font-semibold">{t("accountPage.title")}</h1>
      <div className="mt-6 rounded-2xl border border-border bg-card p-6">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{t("accountPage.signedInAs")}</div>
        <div className="mt-1 text-base font-medium">{user.email}</div>
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-card p-6">
        <h2 className="font-display text-xl font-semibold">{t("accountPage.subscription")}</h2>
        {subLoading ? (
          <p className="mt-3 text-sm text-muted-foreground">{t("accountPage.loading")}</p>
        ) : isActive && subscription ? (
          <div className="mt-3 space-y-2 text-sm">
            <div>{t("accountPage.plan")}: <span className="font-semibold">{TIER_LABEL[tier]}</span></div>
            <div>{t("accountPage.status")}: <span className="font-semibold capitalize">{subscription.status}</span>
              {subscription.cancel_at_period_end && <span className="ml-2 rounded-md bg-amber-100 px-2 py-0.5 text-xs text-amber-800">{t("accountPage.cancelsAtEnd")}</span>}
            </div>
            {subscription.current_period_end && (
              <div>{t("accountPage.nextBilling")}: <span className="font-semibold">{new Date(subscription.current_period_end).toLocaleDateString()}</span></div>
            )}
            <button
              onClick={openPortal}
              disabled={portalLoading}
              className="mt-4 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {portalLoading ? t("accountPage.opening") : t("accountPage.manageBilling")}
            </button>
          </div>
        ) : (
          <div className="mt-3">
            <p className="text-sm text-muted-foreground">{t("accountPage.entryNote")}</p>
            <Link to="/pricing" className="mt-4 inline-block rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
              {t("accountPage.seePlans")}
            </Link>
          </div>
        )}
      </div>

      {usage && usage.tier !== "explore" && (
        <div className="mt-6 rounded-2xl border border-border bg-card p-6">
          <p className="text-sm text-muted-foreground">{t("accountPage.nearingLimit")}</p>
          <Link
            to="/pricing"
            className="mt-4 inline-block rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            {t("accountPage.upgradePlan")}
          </Link>
        </div>
      )}

      {!!user && (
        <Collapsible defaultOpen={false} className="mt-6 rounded-2xl border border-border bg-card p-6">
          <CollapsibleTrigger className="group flex w-full items-center justify-between text-left">
            <div className="flex flex-1 items-baseline justify-between">
              <h2 className="font-display text-xl font-semibold">{t("accountPage.savedHistory")}</h2>
              <span className="text-xs text-muted-foreground">{history.length} / {historyLimit}</span>
            </div>
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            {history.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">{t("accountPage.historyEmpty")}</p>
            ) : (
              <ul className="mt-4 divide-y divide-border">
                {history.map((e) => (
                  <li key={e.id} className="group flex items-center gap-3 py-2.5">
                    <Link to="/" search={{ ref: e.reference }} className="flex-1">
                      <div className="text-sm font-medium hover:underline">{e.reference}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(e.created_at).toLocaleString()}
                      </div>
                    </Link>
                    <button
                      onClick={() => removeHistory(e.id)}
                      className="rounded-md p-1.5 text-muted-foreground opacity-0 transition hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                      aria-label={t("accountPage.deleteAria")}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CollapsibleContent>
        </Collapsible>
      )}

      <button onClick={signOut} className="mt-6 text-sm text-muted-foreground underline hover:text-foreground">
        {t("accountPage.signOut")}
      </button>
    </main>
  );
}

function UsageBar({
  label,
  used,
  limit,
  period,
}: {
  label: string;
  used: number;
  limit: number | "unlimited";
  period: "day" | "month";
}) {
  const { t } = useLanguage();
  const isUnlimited = limit === "unlimited";
  const denom = isUnlimited ? 0 : (limit as number);
  const pct = denom > 0 ? Math.min(100, Math.round((used / denom) * 100)) : 0;
  const near = !isUnlimited && pct >= 80;
  const full = !isUnlimited && used >= (limit as number);
  const periodLabel = period === "day" ? t("accountPage.day") : t("accountPage.month");
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className={`tabular-nums ${full ? "text-destructive" : near ? "text-amber-600" : "text-muted-foreground"}`}>
          {isUnlimited ? `${used} ${t("accountPage.usedSuffix")}` : `${used} / ${limit} ${t("accountPage.this")} ${periodLabel}`}
        </span>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-all ${full ? "bg-destructive" : near ? "bg-amber-500" : "bg-primary"}`}
          style={{ width: isUnlimited ? "100%" : `${pct}%`, opacity: isUnlimited ? 0.25 : 1 }}
        />
      </div>
    </div>
  );
}

function NearLimitBanner({ usage }: { usage: { tier: string; searches: { used: number; limit: number | "unlimited" } } }) {
  const { t } = useLanguage();
  const pctOf = (u: number, l: number | "unlimited") =>
    l === "unlimited" || l === 0 ? 0 : (u / l) * 100;
  const searchPct = pctOf(usage.searches.used, usage.searches.limit);
  const near = searchPct >= 80 && searchPct < 100;
  if (!near || usage.tier === "explore") return null;
  return (
    <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      {t("accountPage.nearingLimit")}{" "}
      <Link to="/pricing" className="font-semibold underline">
        {t("accountPage.nearingLimitCta")}
      </Link>
    </div>
  );
}

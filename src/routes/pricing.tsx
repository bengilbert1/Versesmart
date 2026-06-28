
import { useAuth } from "@/hooks/useAuth";
import { usePaddleCheckout } from "@/hooks/usePaddleCheckout";
import { useSubscription } from "@/hooks/useSubscription";
import { Check } from "lucide-react";
import { toast } from "sonner";
import type { Tier } from "@/lib/tiers";
import { useLanguage } from "@/lib/language-context";
import { ScholarSupport } from "@/components/ScholarSupport";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — Verse Smart" },
      {
        name: "description",
        content: "Entry, Engage and Explore plans for Bible commentary comparisons — from free to $9.99/mo.",
      },
      { property: "og:title", content: "Pricing — Verse Smart" },
      {
        property: "og:description",
        content: "Entry, Engage and Explore plans for Bible commentary comparisons — from free to $9.99/mo.",
      },
      { property: "og:url", content: "https://versesmart.org/pricing" },
    ],
    links: [{ rel: "canonical", href: "https://versesmart.org/pricing" }],
  }),
  component: PricingPage,
});

function PricingPage() {
  const { user, loading: authLoading } = useAuth();
  const { tier } = useSubscription();
  const { openCheckout, loading } = usePaddleCheckout();
  const navigate = useNavigate();
  const { t } = useLanguage();

  const onSubscribe = async (priceId: string) => {
    if (authLoading) return;
    if (!user) {
      navigate({ to: "/signup" });
      return;
    }
    try {
      await openCheckout(priceId);
    } catch (e: any) {
      console.error("[checkout]", e);
      toast.error(e?.message ?? t("toasts.checkoutError"));
    }
  };

  const ctaFor = (planTier: Tier, defaultLabel: string) => {
    if (tier === planTier) return t("pricingPage.currentPlan");
    if (!user) return t("pricingPage.signUpToSubscribe");
    return defaultLabel;
  };

  return (
    <main className="mx-auto max-w-5xl px-5 py-12 sm:py-20">
      <div className="text-center">
        <h1 className="font-display text-4xl font-semibold sm:text-5xl">{t("pricingPage.title")}</h1>
        <p className="mt-3 text-base text-muted-foreground">
          {t("pricingPage.subtitle1")}<br className="hidden sm:inline" />
          {t("pricingPage.subtitle2")}
        </p>
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-3 sm:grid-cols-2">
        <PlanCard
          title={t("pricingPage.entryTitle")}
          subtitle={t("pricingPage.entrySubtitle")}
          price="$0"
          period={t("pricingPage.entryPeriod")}
          features={[
            t("pricingPage.entryFeature1"),
            t("pricingPage.entryFeatureFull"),
          ]}
          cta={tier === "free" ? t("pricingPage.currentPlan") : t("pricingPage.entryCta")}
          disabled
        />

        <PlanCard
          title={t("pricingPage.engageTitle")}
          subtitle={t("pricingPage.engageSubtitle")}
          price="$4.99"
          period={t("pricingPage.engagePeriod")}
          features={[
            t("pricingPage.engageFeature2"),
            t("pricingPage.entryFeatureFull"),
            t("pricingPage.historySaved"),
            t("pricingPage.engageFeature1"),
            t("pricingPage.engageFeature3"),
          ]}
          cta={ctaFor("engage", t("pricingPage.subscribe"))}
          onClick={() => onSubscribe("basic_monthly")}
          disabled={tier === "engage" || loading}
          highlighted={tier === "engage"}
        />

        <PlanCard
          title={t("pricingPage.exploreTitle")}
          subtitle={t("pricingPage.exploreSubtitle")}
          price="$9.99"
          period={t("pricingPage.engagePeriod")}
          highlighted
          badge={tier === "explore" ? t("pricingPage.badgeYours") : t("pricingPage.badgeBest")}
          features={[
            t("pricingPage.exploreFeature1"),
            t("pricingPage.exploreFeature2"),
            t("pricingPage.exploreFeature5"),
            t("pricingPage.exploreFeature6"),
            t("pricingPage.exploreFeature3"),
            t("pricingPage.exploreFeature4"),
          ]}
          cta={ctaFor("explore", t("pricingPage.subscribe"))}
          onClick={() => onSubscribe("plus_monthly")}
          disabled={tier === "explore" || loading}
        />
      </div>

      <ScholarSupport />

      <p className="mt-10 text-center text-xs text-muted-foreground">
        {t("pricingPage.cancelLine")}{" "}
        <Link to="/refund" className="underline">
          {t("pricingPage.refundLink")}
        </Link>
        .
      </p>
    </main>
  );
}

function PlanCard({
  title,
  subtitle,
  price,
  period,
  features,
  cta,
  onClick,
  disabled,
  highlighted,
  badge,
}: {
  title: string;
  subtitle?: string;
  price: string;
  period: string;
  features: string[];
  cta: string;
  onClick?: () => void;
  disabled?: boolean;
  highlighted?: boolean;
  badge?: string;
}) {
  return (
    <div
      className={`relative flex flex-col rounded-3xl border p-7 ${highlighted ? "border-primary bg-primary/5" : "border-border bg-card"}`}
    >
      {badge && (
        <span className="absolute -top-3 right-6 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
          {badge}
        </span>
      )}
      <h3 className="font-display text-2xl font-semibold">{title}</h3>
      {subtitle && <div className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">{subtitle}</div>}
      <div className="mt-3 flex items-baseline gap-1">
        <span className="text-4xl font-bold">{price}</span>
        <span className="text-sm text-muted-foreground">/ {period}</span>
      </div>
      <ul className="mt-6 space-y-2 text-sm">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            {f}
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className="mt-7 w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {cta}
      </button>
    </div>
  );
}

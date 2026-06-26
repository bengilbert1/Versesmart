import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { compareCommentaries, type CommentaryResult } from "@/lib/commentary.functions";
import { getVerseText } from "@/lib/verse-text.functions";
import { getBonusDeepAnalysis, getBonusStatus, type BonusDeepAnalysisResult } from "@/lib/bonus.functions";
import type { ModernCommentaryResult } from "@/lib/modern-commentary.functions";
import { HistoryDropdownTrigger, HistoryDropdownPanel } from "@/components/HistoryDropdown";
import { saveLocalHistoryEntry } from "@/lib/local-history";
import { useClientId } from "@/hooks/useClientId";
import { useSubscription } from "@/hooks/useSubscription";

import { OriginalSources } from "@/components/OriginalSources";
import { isCommentatorAllowed, normalizeName, denominationKeyFromTradition } from "@/lib/commentator-metadata";
import { listBlockedCommentators } from "@/lib/commentator-blocks.functions";
import {
  listCommentatorOverrides,
  type CommentatorOverrideRow,
} from "@/lib/commentator-overrides.functions";

import { ModernVoicesLockedTeaser, useModernCommentaries, MODERN_AUTHOR_SET } from "@/components/ModernVoices";
import { HistoricalAnonymousTeaser, useHistoricalGroups } from "@/components/HistoricalVoices";
import { AUTHOR_COUNTRIES, resolveCountryName } from "@/lib/regions";
import { WORLDVIEWS, primaryWorldview, type Worldview } from "@/lib/worldview";
import { HISTORICAL_GROUPS, type HistoricalCommentaryResult } from "@/lib/historical-commentary.functions";
import { synthesizeUnifiedComparison } from "@/lib/unified-commentary.functions";
import { RelatedVerses } from "@/components/RelatedVerses";
import { PassageDisplay } from "@/components/PassageDisplay";
import { ThemeSearch } from "@/components/ThemeSearch";
import { getPaddleEnvironment } from "@/lib/paddle";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage, useT } from "@/lib/language-context";
import { highlightPosition } from "@/lib/highlight-contrasts";
import { CommentatorCompareControl, useUserSelection } from "@/components/CommentatorCompareControl";
import { trackVerseSearch, trackSectionOpen } from "@/lib/track-analytics";
import heroSunriseUrl from "@/assets/hero-sunrise.jpg";
import {
  BookOpen,
  Sparkles,
  GitCompare,
  Loader2,
  Share2,
  Check,
  RotateCcw,
  Copy,
  Gift,
  ArrowRight,
  Info,
  Hand,
  ArrowLeftRight,
  ArrowUp,
  ChevronDown,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { AuthorThumbnail } from "@/components/AuthorThumbnail";
import { authorThumbQueryOptions } from "@/lib/author-wiki";
import { toast } from "sonner";
import { CopyCardButton } from "@/components/CopyCardButton";
import { NewsletterFooter } from "@/components/NewsletterFooter";
import { UnifiedVersePicker } from "@/components/UnifiedVersePicker";
import { VerseOfTheDayBar } from "@/components/VerseOfTheDayBar";
import { useHonourSpelling, localizeHonour } from "@/lib/honour";

type Search = { ref?: string; translation?: string };

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    ref: typeof search.ref === "string" ? search.ref : undefined,
    translation: typeof search.translation === "string" ? search.translation : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Any Bible verse, Global perspectives — VerseSmart" },
      {
        name: "description",
        content:
          "Compare how theologians from different cultures, traditions, and worldviews interpret any Bible verse — all in one place on VerseSmart.",
      },
      { property: "og:title", content: "Any Bible verse, Global perspectives — VerseSmart" },
      {
        property: "og:description",
        content:
          "Compare how theologians from different cultures, traditions, and worldviews interpret any Bible verse — all in one place on VerseSmart.",
      },
      { property: "og:url", content: "https://versesmart.org/" },
    ],
    links: [{ rel: "canonical", href: "https://versesmart.org/" }],
  }),
  component: Index,
});

const DEFAULT_TRANSLATION = "WEB";
const ANON_DAILY_LIMIT = 1;
const FREE_DAILY_LIMIT = 3;

function Index() {
  const fetchFn = useServerFn(compareCommentaries);
  const bonusFn = useServerFn(getBonusDeepAnalysis);
  const bonusStatusFn = useServerFn(getBonusStatus);
  const navigate = useNavigate({ from: "/" });
  const [reference, setReference] = useState("");
  const [inputValue, setInputValue] = useState("");

  const translation = DEFAULT_TRANSLATION;
  const [copied, setCopied] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [showSignupWall, setShowSignupWall] = useState(false);
  const [usedToday, setUsedToday] = useState<number>(0);
  const [bonus, setBonus] = useState<BonusDeepAnalysisResult | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const themeSearchAnchorRef = useRef<HTMLDivElement>(null);
  const [lookupLanguage, setLookupLanguage] = useState<string | null>(null);
  const [showLanguageReloadPrompt, setShowLanguageReloadPrompt] = useState(false);

  const clientId = useClientId();
  const { user } = useAuth();
  const { language, t } = useLanguage();
  const { isActive, tier } = useSubscription();
  const qc = useQueryClient();

  const isAnonymous = !user;

  // Track usage count for the badge.
  // Anonymous: lifetime distinct refs by client_id (cap = 3 before signup wall).
  // Signed-in free: today's distinct refs.
  useEffect(() => {
    if (!clientId || isActive) return;
    let q = supabase
      .from("daily_usage")
      .select("reference_key", { count: "exact", head: true })
      .eq("client_id", clientId);
    if (user) {
      const today = new Date().toISOString().slice(0, 10);
      q = q.eq("user_id", user.id).eq("usage_date", today);
    } else {
      q = q.is("user_id", null);
    }
    q.then(({ count }) => setUsedToday(count ?? 0));
  }, [clientId, isActive, user]);

  // Bonus eligibility (signed-in free users only)
  const bonusStatus = useQuery({
    queryKey: ["bonus-status", user?.id ?? null],
    queryFn: () => bonusStatusFn(),
    enabled: !!user && !isActive,
    staleTime: 1000 * 60,
  });

  const bonusMutation = useMutation({
    mutationFn: async (ref: string) =>
      bonusFn({ data: { reference: ref, translation: DEFAULT_TRANSLATION, environment: getPaddleEnvironment() } }),
    onSuccess: (res) => {
      setBonus(res);
      setShowUpgrade(false);
      qc.invalidateQueries({ queryKey: ["bonus-status"] });
    },
  });

  // When the user taps the cancel "×" mid-search we cannot truly abort the
  // in-flight server call, but we can flag the run as cancelled so onSuccess /
  // onError discard the response and no partial UI ever renders.
  const cancelledRef = useRef(false);

  const [userSelection, setUserSelection] = useUserSelection();

  const mutation = useMutation({
    mutationFn: async (vars: { reference: string; clientId: string; userSelection?: string[] }) => {
      if (!vars.clientId) throw new Error("Initializing…");
      return fetchFn({
        data: {
          reference: vars.reference,
          translation: DEFAULT_TRANSLATION,
          clientId: vars.clientId,
          environment: getPaddleEnvironment(),
          language,
          ...(vars.userSelection && vars.userSelection.length >= 2
            ? { userSelection: vars.userSelection }
            : {}),
        },
      });
    },
    onSuccess: (res) => {
      if (cancelledRef.current) {
        cancelledRef.current = false;
        return;
      }
      if (res?.signupRequired) {
        setShowSignupWall(true);
        clearSearchState();
        return;
      }
      if (res?.upgradeRequired) {
        setShowUpgrade(true);
        clearSearchState();
        return;
      }
      if (!isActive) setUsedToday((n) => n + 1);
      setBonus(null);
      if (res?.contrastsLocked) setShowUpgrade(true);
      qc.invalidateQueries({ queryKey: ["search-history"] });
      setLookupLanguage(language);
      setShowLanguageReloadPrompt(false);

      // Save to localStorage for anonymous users
      if (!user && res?.verseReference) {
        saveLocalHistoryEntry(res.verseReference, res.translation);
      }
    },
    onError: () => {
      if (cancelledRef.current) {
        cancelledRef.current = false;
      }
    },
  });

  // Clear all search-related state so the UI returns to its pre-search state.
  // Used when a limit modal is shown so no partial verse header / cards render
  // and the cached sentinel response is discarded.
  const clearSearchState = () => {
    setReference("");
    setInputValue("");
    setBonus(null);
    navigate({ search: {}, replace: true });
    queueMicrotask(() => mutation.reset());
  };

  // Auto-trigger a lookup when arriving with a ?ref= URL param (e.g. shared link).
  // Runs once per unique ref value, only after clientId is ready.
  const initialRef = Route.useSearch().ref;
  const autoTriggeredRef = useRef<string | null>(null);
  useEffect(() => {
    if (!initialRef || !clientId) return;
    if (autoTriggeredRef.current === initialRef) return;
    if (mutation.isPending) return;
    if (reference === initialRef) return;
    autoTriggeredRef.current = initialRef;
    setReference(initialRef);
    setInputValue(initialRef);
    setBonus(null);
    cancelledRef.current = false;
    mutation.mutate({ reference: initialRef, clientId, userSelection });
  }, [initialRef, clientId]);

  const runSubmit = (ref: string) => {
    const trimmed = ref.trim();
    if (!trimmed) return;
    setReference(trimmed);
    setInputValue(trimmed);
    setBonus(null);

    trackVerseSearch(trimmed);
    navigate({ search: { ref: trimmed }, replace: false });
    if (!clientId) return;
    cancelledRef.current = false;
    mutation.mutate({ reference: trimmed, clientId, userSelection });
  };

  const submit = (ref: string, _trans?: string) => {
    runSubmit(ref);
  };

  const handleReset = () => {
    // If a lookup is currently running, flag it so its eventual resolution is
    // discarded — no partial verse / cards ever render after cancel.
    if (mutation.isPending) {
      cancelledRef.current = true;
    }
    setReference("");
    setInputValue("");
    setBonus(null);

    mutation.reset();
    navigate({ search: {}, replace: false });
  };

  // Detect language change while a verse lookup is displayed.
  // Do NOT auto-translate; ask the user how to proceed.
  useEffect(() => {
    if (!mutation.data?.verseReference) return;
    if (mutation.isPending) return;
    if (!lookupLanguage) return;
    if (language !== lookupLanguage) {
      setShowLanguageReloadPrompt(true);
    }
  }, [language, lookupLanguage, mutation.data?.verseReference, mutation.isPending]);

  const handleKeepVerseLanguage = () => {
    // Keep verse as-is; only the UI language changes.
    setLookupLanguage(language);
    setShowLanguageReloadPrompt(false);
  };

  const handleReloadInNewLanguage = () => {
    setShowLanguageReloadPrompt(false);
    const ref = mutation.data?.verseReference || reference;
    if (!ref) return;
    runSubmit(ref);
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/?ref=${encodeURIComponent(reference)}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast(t("toasts.linkCopied"));
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  };

  const dailyLimit = isAnonymous ? ANON_DAILY_LIMIT : FREE_DAILY_LIMIT;
  // Counter intentionally hidden from UI; dailyLimit retained for internal gating only.
  void dailyLimit;
  void usedToday;

  return (
    <main className="min-h-[70vh] bg-background text-foreground">
      <section className="mx-auto max-w-3xl px-5 pt-10 pb-10 text-center sm:px-6 sm:pt-16">
        <VerseOfTheDayBar onPick={(r) => submit(r)} disabled={mutation.isPending || !clientId} />
        <div className="vs-hero mt-5 mx-auto max-w-3xl rounded-2xl px-6 py-10 sm:py-14 md:py-16" style={{ backgroundImage: `url(${heroSunriseUrl})` }}>
          <h1 className="font-display relative text-[1.75rem] font-semibold leading-[1.15] tracking-tight text-foreground [overflow-wrap:normal] [word-break:keep-all] sm:text-5xl md:text-6xl">
            {t("home.heroTitle")
              .split(/[,\uFF0C]\s*/)
              .map((line, i) => (
                <span key={i} className="block">
                  {line}
                </span>
              ))}
          </h1>
        </div>

        <p className="mx-auto mt-6 max-w-lg text-base text-muted-foreground sm:text-lg">{t("home.heroSubtitle")}</p>

        <div className="mt-8 mx-auto w-full max-w-2xl text-left">
          <UnifiedVersePicker
            value={inputValue}
            onChange={setInputValue}
            onSubmit={(ref) => submit(ref)}
            onCancel={handleReset}
            disabled={mutation.isPending || !clientId}
            pending={mutation.isPending}
            submitLabel={t("home.compare")}
            placeholder={t("home.versePickerBar.label")}
            leftAccessory={
              <HistoryDropdownTrigger
                open={historyOpen}
                onToggle={() => setHistoryOpen((o) => !o)}
              />
            }
          />
          <HistoryDropdownPanel
            open={historyOpen}
            onClose={() => setHistoryOpen(false)}
            onPick={(ref, trans) => {
              setHistoryOpen(false);
              submit(ref, trans);
            }}
          />
        </div>

        <div ref={themeSearchAnchorRef} className="mt-4 mx-auto w-full max-w-2xl text-left">
          <ThemeSearch onPick={(r) => submit(r)} disabled={mutation.isPending || !clientId} />
        </div>

        {!mutation.data && !mutation.isPending && (
          <div className="mt-6 mx-auto w-full max-w-2xl text-center">
            <div className="hidden sm:block">
              <HowItWorksToggle />
              <WhyChooseToggle />
            </div>
            <div className="sm:hidden flex justify-center">
              <MobileInfoButton />
            </div>
            <div className="mt-6 flex justify-center">
              <Link
                to="/blog"
                className="inline-flex items-center justify-center rounded-2xl border border-border bg-background px-5 py-2.5 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-accent"
              >
                {t("blog.readTheBlog")}
              </Link>
            </div>
          </div>
        )}



      </section>
      <div data-hero-sentinel aria-hidden className="h-px w-full" />

      <section className="mx-auto max-w-6xl px-5 pb-20 sm:px-6">
        {mutation.isError &&
          !showUpgrade &&
          !showSignupWall &&
          !(mutation.error as Error)?.message?.includes("SIGNUP_REQUIRED") &&
          !/^COMPARE_(OVERLOAD|INSUFFICIENT):/.test((mutation.error as Error)?.message ?? "") && (
            <div className="mx-auto max-w-xl rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              {(mutation.error as Error).message}
            </div>
          )}

        {mutation.isError &&
          /^COMPARE_(OVERLOAD|INSUFFICIENT):/.test((mutation.error as Error)?.message ?? "") && (
            <RecoveryModal
              kind={/^COMPARE_OVERLOAD/.test((mutation.error as Error).message) ? "overload" : "insufficient"}
              tier={tier}
              userSelection={userSelection}
              onClose={() => mutation.reset()}
              onApplySelection={(names: string[]) => {
                setUserSelection(names);
                mutation.reset();
                if (reference && clientId) {
                  cancelledRef.current = false;
                  mutation.mutate({ reference, clientId, userSelection: names });
                }
              }}
              onResetToAuto={() => {
                setUserSelection([]);
                mutation.reset();
                if (reference && clientId) {
                  cancelledRef.current = false;
                  mutation.mutate({ reference, clientId, userSelection: [] });
                }
              }}
              onChangePassage={() => {
                handleReset();
              }}
            />
          )}


        {mutation.isPending && (
          <>
            <InstantVerseHeader reference={reference} translation={translation} />
            <LoadingState reference={reference} />
          </>
        )}

        {mutation.data && !mutation.data.signupRequired && !mutation.data.upgradeRequired && (
          <>
            <div className="mb-4 flex items-start justify-between gap-2">
              <div className="hidden sm:flex sm:flex-wrap sm:items-start sm:gap-2 min-w-0">
                <HowItWorksToggle />
                <WhyChooseToggle />
              </div>
              <div className="sm:hidden">
                <MobileInfoButton />
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleReset}
                  aria-label={t("share.reset")}
                  title={t("share.reset")}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition hover:bg-accent hover:text-foreground"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
                <button
                  onClick={handleShare}
                  aria-label={t("share.shareThis")}
                  title={t("share.shareThis")}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-foreground transition hover:bg-accent"
                >
                  {copied ? <Check className="h-4 w-4 text-agree" /> : <Share2 className="h-4 w-4" />}
                </button>
              </div>
            </div>
            {
              <>
                {bonus && (
                  <div className="mb-6 rounded-2xl border border-primary/30 bg-primary/5 p-4 text-center">
                    <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-background px-3 py-1 text-xs font-semibold text-primary">
                      <Gift className="h-3.5 w-3.5" /> {t("bonus.previewBadge")}
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{t("bonus.previewBody")}</p>
                  </div>
                )}
                <Results
                  data={bonus ? bonus.classic : mutation.data}
                  isActive={isActive}
                  tier={tier}
                  isAnonymous={isAnonymous}
                  onPick={(r) => submit(r)}
                  bonusModern={bonus?.modern ?? null}
                  bonusHistorical={bonus?.historical ?? null}
                  user={user}
                  onApplyUserSelection={(names) => {
                    setUserSelection(names);
                    const ref = reference || (bonus ? bonus.classic.verseReference : mutation.data?.verseReference);
                    if (ref && clientId) {
                      cancelledRef.current = false;
                      mutation.mutate({ reference: ref, clientId, userSelection: names });
                    }
                  }}
                  headerControls={{
                    pickerValue: inputValue,
                    setPickerValue: setInputValue,
                    pickerSubmit: (ref: string) => submit(ref),
                    pickerCancel: handleReset,
                    pickerPending: mutation.isPending,
                    pickerDisabled: mutation.isPending || !clientId,
                    pickerSubmitLabel: t("home.compare"),
                    onOpenThemes: () => {
                      themeSearchAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
                    },
                  }}
                />


                {bonus && (
                  <div className="mt-10 rounded-3xl border border-primary/40 bg-gradient-to-br from-primary/10 to-primary/5 p-8 text-center">
                    <Sparkles className="mx-auto h-10 w-10 text-primary" />
                    {bonus.useCount >= 2 ? (
                      <>
                        <h3 className="font-display mt-3 text-2xl font-semibold">{t("bonus.reallyEnjoyingTitle")}</h3>
                        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                          {t("bonus.reallyEnjoyingBody", { count: bonus.useCount })}
                        </p>
                      </>
                    ) : (
                      <>
                        <h3 className="font-display mt-3 text-2xl font-semibold">{t("bonus.wantThisTitle")}</h3>
                        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{t("bonus.wantThisBody")}</p>
                      </>
                    )}
                    <Link
                      to="/pricing"
                      className="mt-5 inline-flex items-center justify-center rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
                    >
                      {bonus.useCount >= 2 ? t("bonus.ctaUnlimited") : t("bonus.ctaExplorer")}
                    </Link>
                  </div>
                )}
              </>
            }
          </>
        )}

        {!mutation.data && !mutation.isPending && !mutation.isError && <EmptyState />}
      </section>

      {showUpgrade && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-sm p-4"
          onClick={() => setShowUpgrade(false)}
        >
          <div className="max-w-md rounded-3xl bg-background text-foreground p-8 text-center shadow-xl" onClick={(e) => e.stopPropagation()}>
            <Sparkles className="mx-auto h-10 w-10 text-primary" />
            <h2 className="font-display mt-4 text-2xl font-semibold">{t("upgrade.usedToday")}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{t("upgrade.hiddenBody")}</p>
            <div className="mt-6 flex flex-col gap-2">
              <Link
                to="/pricing"
                className="rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
              >
                {t("upgrade.seePlans")}
              </Link>
            </div>
          </div>
        </div>
      )}

      {showSignupWall && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-sm p-4"
          onClick={() => setShowSignupWall(false)}
        >
          <div className="max-w-md rounded-3xl bg-background text-foreground p-8 text-center shadow-xl" onClick={(e) => e.stopPropagation()}>
            <Sparkles className="mx-auto h-10 w-10 text-primary" />
            <h2 className="font-display mt-4 text-2xl font-semibold">{t("home.usedAllTitle")}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{t("home.usedAllBody")}</p>

            <div className="mt-6 flex flex-col gap-2">
              <Link
                to="/login"
                className="rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
              >
                {t("signupWall.signUpFree")}
              </Link>
              <Link
                to="/login"
                className="rounded-xl border border-border px-4 py-3 text-sm font-medium hover:bg-accent"
              >
                {t("signupWall.haveAccount")}
              </Link>
              <Link to="/pricing" className="text-xs text-muted-foreground hover:underline">
                {t("signupWall.seePaid")}
              </Link>
            </div>
          </div>
        </div>
      )}

      {isAnonymous && (
        <Link
          to="/login"
          className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2 whitespace-nowrap rounded-full bg-primary px-4 py-2 text-base font-semibold text-primary-foreground shadow-lg shadow-primary/30 hover:bg-primary/90"
          style={{ maxWidth: "100%", lineHeight: 1 }}
        >
          Sign in to make VerseSmart your own
        </Link>
      )}
      <AlertDialog
        open={showLanguageReloadPrompt}
        onOpenChange={(open) => {
          if (!open) setShowLanguageReloadPrompt(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Language changed</AlertDialogTitle>
            <AlertDialogDescription>
              You changed your language. To translate this verse and its summaries, we need to reload it in your selected language.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleKeepVerseLanguage}>Keep this verse as is</AlertDialogCancel>
            <AlertDialogAction onClick={handleReloadInNewLanguage}>Reload in new language</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}

function Header() {
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-6">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <BookOpen className="h-5 w-5" />
          </div>
          <span className="font-display text-xl font-semibold">Verse Smart</span>
        </div>
        <nav className="text-xs font-medium text-muted-foreground sm:text-sm">
          <span className="sm:hidden">Public-domain</span>
          <span className="hidden sm:inline">Public-domain commentaries</span>
        </nav>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto max-w-6xl px-5 py-8 text-sm text-muted-foreground sm:px-6">
        <p>
          Summaries are AI-rendered overviews of public-domain commentaries (Henry, Calvin, Spurgeon, Barnes, Wesley).
          Always consult primary sources for study.
        </p>
      </div>
    </footer>
  );
}

function EmptyState() {
  return null;
}

const LOADING_QUIPS = [
  "Taming strong opinions",
  "Calming heated debates",
  "Negotiating with theologians",
  "Sorting spicy footnotes",
  "Mediating scholar drama",
  "Untangling dense arguments",
  "Hushing opinionated experts",
  "Refereeing commentary clashes",
  "Cooling theological tempers",
  "Weighing rival readings",
  "Sorting scholar squabbles",
  "Cross-examining commentaries",
  "Refereeing rival theologians",
  "Balancing bold beliefs",
  "Comparing centuries' opinions",
  "Untangling textual tangles",
  "Debating dusty doctrines",
  "Reconciling rival readings",
  "Checking commentary clashes",
  "Testing theologian theories",
  "Consulting commentary council",
  "Negotiating nuance notes",
  "Parsing prophetic prose",
  "Reviewing rival reasoning",
  "Hushing heated hermeneutics",
  "Reconciling radical readings",
  "Sorting scripture squabbles",
  "Comparing commentary chaos",
  "Polishing paradox points",
];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function InstantVerseHeader({ reference, translation }: { reference: string; translation: string }) {
  const verseTextFn = useServerFn(getVerseText);
  const { data } = useQuery({
    queryKey: ["instant-verse-text", reference, translation],
    queryFn: () => verseTextFn({ data: { reference, translation: translation.toLowerCase() } }),
    enabled: !!reference,
    staleTime: 1000 * 60 * 60 * 24,
    retry: 0,
  });
  if (!data?.text) return null;
  return (
    <div className="mx-auto mb-4 max-w-3xl rounded-3xl border border-border bg-card p-6 text-center sm:p-8">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {data.reference} · {data.translation}
      </p>
      <PassageDisplay text={data.text} />
    </div>
  );
}

function LoadingState({ reference }: { reference: string }) {
  const { t } = useLanguage();
  const [order, setOrder] = useState<string[]>(() => shuffle(LOADING_QUIPS));
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setIdx((prev) => {
        const next = prev + 1;
        if (next >= order.length) {
          setOrder(shuffle(LOADING_QUIPS));
          return 0;
        }
        return next;
      });
    }, 3000);
    return () => clearInterval(id);
  }, [order]);

  return (
    <div className="mx-auto max-w-xl rounded-3xl border border-border bg-card p-10 text-center">
      <Loader2 className="mx-auto h-7 w-7 animate-spin text-muted-foreground" />
      <p key={`${order.join("|")}-${idx}`} className="font-display mt-5 animate-fade-in text-2xl font-semibold">
        {order[idx]}…
      </p>
      <p className="mt-1 text-base text-muted-foreground">{t("loading.consulting", { ref: reference })}</p>
    </div>
  );
}

function Results({
  data,
  isActive,
  tier,
  isAnonymous,
  onPick,
  bonusModern,
  bonusHistorical,
  user,
  onApplyUserSelection,
  headerControls,
}: {
  data: CommentaryResult;
  isActive: boolean;
  tier: import("@/lib/tiers").Tier;
  isAnonymous: boolean;
  onPick: (reference: string) => void;
  bonusModern?: ModernCommentaryResult | null;
  bonusHistorical?: import("@/lib/historical-commentary.functions").HistoricalCommentaryResult[] | null;
  user: import("@supabase/supabase-js").User | null;
  onApplyUserSelection: (names: string[]) => void;
  headerControls: {
    pickerValue: string;
    setPickerValue: (v: string) => void;
    pickerSubmit: (ref: string) => void;
    pickerCancel?: () => void;
    pickerPending: boolean;
    pickerDisabled: boolean;
    pickerSubmitLabel: string;
    onOpenThemes: () => void;
  };
}) {
  const hasModern = true;
  const { language, t } = useLanguage();
  const honour = useHonourSpelling();
  const [userSelection] = useUserSelection();
  const hasManualSelection = userSelection.length >= 2;
  const userSelectionKeys = useMemo(
    () => new Set(userSelection.map((n) => normalizeName(n))),
    [userSelection],
  );
  // When the user has a manual selection active, ALL auto-selection logic is
  // hard-disabled: no Modern fetch, no Historical fetches, no manual-stubs,
  // no balancing / fallback / "new voices" injection. The server already used
  // ONLY the user's list for the Classic call (manualOverride bypasses the
  // selection engine). The user's list is the sole source of truth.
  const modern = useModernCommentaries({
    reference: data.verseReference,
    translation: data.translation,
    enabled: hasModern && !bonusModern && !hasManualSelection,
    language,
  });
  const modernDataLive = bonusModern ? bonusModern : modern.data && !modern.data.locked ? modern.data : null;

  const locked = !!data.contrastsLocked;

  // Historical groups (Foundational, Fathers, Reformation) — free for signed-in users.
  // We fetch these regardless of contrast lock so the unified synthesis always has
  // cross-tradition material to work with. Disabled entirely under manual selection.
  const historicalQueries = useHistoricalGroups({
    reference: data.verseReference,
    translation: data.translation,
    enabled: !bonusHistorical && !hasManualSelection,
    language,
  });
  const historicalResultsLive: HistoricalCommentaryResult[] = bonusHistorical
    ? bonusHistorical
    : historicalQueries.map((q) => q.data).filter((d): d is HistoricalCommentaryResult => !!d && !d.locked);
  const historicalLoading = !bonusHistorical && !hasManualSelection && historicalQueries.some((q) => q.isLoading);

  // Build a flat list of all available commentaries tagged with their source group.
  type SourcedCommentary = {
    author: string;
    era: string;
    tradition: string;
    summary: string;
    keyInsight: string;
    sourceGroup: string;
    countryCode?: string;
    country?: string;
    region?: string;
    denomination?: string;
    sourceUrl?: string;
    traditionKey?: string;
    worldviewKey?: string;
  };

  const allSourcedLive: SourcedCommentary[] = [
    ...data.commentaries.map((c) => ({ ...c, sourceGroup: "Classic" })),
    ...(modernDataLive?.commentaries ?? []).map((c) => ({ ...c, sourceGroup: "Contemporary" })),
    ...historicalResultsLive.flatMap((g) =>
      g.commentaries.map((c) => ({ ...c, sourceGroup: HISTORICAL_GROUPS[g.group].label })),
    ),
  ];

  // Run cross-tradition synthesis whenever there are 2+ voices in play. Even Classic-only
  // benefits from the unified pass, but the real value shows up once historical / modern
  // groups have loaded.
  const hasExtraGroups = (modernDataLive?.commentaries.length ?? 0) > 0 || historicalResultsLive.length > 0;
  const unifiedFn = useServerFn(synthesizeUnifiedComparison);
  const unifiedQuery = useQuery({
    queryKey: [
      "unified-comparison",
      data.verseReference,
      data.translation,
      language,
      allSourcedLive
        .map((c) => `${c.sourceGroup}:${c.author}`)
        .sort()
        .join("|"),
    ],
    queryFn: () =>
      unifiedFn({
        data: {
          reference: data.verseReference,
          translation: data.translation,
          verseText: data.verseText,
          language,
          commentaries: allSourcedLive.map((c) => ({
            author: c.author,
            era: c.era,
            tradition: c.tradition,
            sourceGroup: c.sourceGroup,
            summary: c.summary,
            keyInsight: c.keyInsight,
          })),
        },
      }),
    enabled: hasExtraGroups && allSourcedLive.length >= 2,
    staleTime: 1000 * 60 * 30,
    retry: 1,
  });

  // --- Tap-to-Update gating ----------------------------------------------------
  // The Author and Worldview tabs must not silently update mid-read when fresh
  // commentary data arrives. Instead we freeze the displayed snapshot and show
  // a non-intrusive pill that commits the new data only on user tap. The
  // Region / Tradition / Denomination tabs read from the same committed
  // snapshot but never show the pill.
  const resultsRootRef = useRef<HTMLDivElement>(null);

  const liveBundle = useMemo(() => {
    const sig = [
      `m:${modernDataLive?.commentaries.length ?? 0}`,
      `h:${historicalResultsLive
        .map((g) => `${g.group}:${g.commentaries.length}`)
        .sort()
        .join(",")}`,
      `u:${unifiedQuery.data?.authorAssignments.length ?? 0}:${unifiedQuery.data?.contrasts.length ?? 0}`,
    ].join("|");
    return {
      modernData: modernDataLive,
      historicalResults: historicalResultsLive,
      unified: unifiedQuery.data ?? null,
      sig,
    };
  }, [modernDataLive, historicalResultsLive, unifiedQuery.data]);

  const [displayed, setDisplayed] = useState(liveBundle);
  const lastRefRef = useRef(data.verseReference);
  useEffect(() => {
    // New verse lookup: always commit immediately, no pill on first load.
    if (lastRefRef.current !== data.verseReference) {
      lastRefRef.current = data.verseReference;
      setDisplayed(liveBundle);
    }
  }, [data.verseReference, liveBundle]);
  useEffect(() => {
    // First load for the current verse (displayed bundle is empty): commit
    // immediately so the user never sees an empty view with a pill.
    if (
      displayed.sig !== liveBundle.sig &&
      (displayed.modernData?.commentaries.length ?? 0) === 0 &&
      displayed.historicalResults.length === 0 &&
      !displayed.unified
    ) {
      setDisplayed(liveBundle);
    }
  }, [liveBundle, displayed]);
  const hasPending = displayed.sig !== liveBundle.sig;
  const applyRefresh = () => setDisplayed(liveBundle);

  const modernData = displayed.modernData;
  const historicalResults = displayed.historicalResults;
  const unified = displayed.unified;
  const allSourcedRaw: SourcedCommentary[] = [
    ...data.commentaries.map((c) => ({ ...c, sourceGroup: "Classic" })),
    ...(modernData?.commentaries ?? []).map((c) => ({ ...c, sourceGroup: "Contemporary" })),
    ...historicalResults.flatMap((g) =>
      g.commentaries.map((c) => ({ ...c, sourceGroup: HISTORICAL_GROUPS[g.group].label })),
    ),
  ];

  // Admin allow/block list. Fetched once; long staleTime so swiping tabs
  // never re-fetches and never triggers AI calls. Anonymous-readable.
  const blocksFetch = useServerFn(listBlockedCommentators);
  const blocksQuery = useQuery({
    queryKey: ["commentator-blocks"],
    queryFn: () => blocksFetch(),
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
  });
  const blockedSet = useMemo(
    () => new Set((blocksQuery.data ?? []).map((b) => b.name_key)),
    [blocksQuery.data],
  );

  // Admin metadata overrides. Public-readable so every tab reflects edits.
  const overridesFetch = useServerFn(listCommentatorOverrides);
  const overridesQuery = useQuery({
    queryKey: ["commentator-overrides"],
    queryFn: () => overridesFetch(),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  });
  // Build a lookup: name_key -> chosen override row (prefer is_primary, else first non-hidden).
  const overridesByKey = useMemo(() => {
    const map = new Map<string, CommentatorOverrideRow>();
    const all = overridesQuery.data ?? [];
    const groups = new Map<string, CommentatorOverrideRow[]>();
    for (const r of all) {
      const arr = groups.get(r.name_key) ?? [];
      arr.push(r);
      groups.set(r.name_key, arr);
    }
    for (const [key, rows] of groups) {
      const primary = rows.find((r) => r.is_primary && !r.is_hidden)
        ?? rows.find((r) => !r.is_hidden)
        ?? rows[0];
      if (primary) map.set(key, primary);
    }
    return map;
  }, [overridesQuery.data]);
  // Build a set of display_names hidden by the admin (specific variant hidden).
  const hiddenDisplayNames = useMemo(() => {
    const s = new Set<string>();
    for (const r of overridesQuery.data ?? []) {
      if (r.is_hidden) s.add(r.display_name);
    }
    return s;
  }, [overridesQuery.data]);

  // Apply admin overrides to each commentary's metadata. Override fields win
  // over payload values; payload values remain when the admin hasn't set one.
  // We also rewrite `author` to the primary display_name so downstream dedupe
  // collapses "N.T. Wright" + "N. T. Wright" into a single rendered card.
  function applyOverride(c: SourcedCommentary): SourcedCommentary {
    const o = overridesByKey.get(normalizeName(c.author));
    if (!o) return c;
    const overrideCountry = (o.country ?? "").trim();
    const overrideIsCode = /^[A-Za-z]{2}$/.test(overrideCountry);
    return {
      ...c,
      author: o.display_name || c.author,
      region: o.region ?? c.region,
      country: o.country ?? c.country,
      countryCode: overrideIsCode ? overrideCountry.toUpperCase() : c.countryCode,
      tradition: o.tradition ?? c.tradition,
      denomination: o.denomination ?? c.denomination,
      traditionKey: o.tradition ?? c.traditionKey,
      worldviewKey: o.worldview ?? c.worldviewKey,
    };
  }

  // Manual commentators (admin-added) that haven't yet been returned by the
  // AI payload. Synthesize stub entries so they appear in every tab while we
  // wait for the next lookup to fetch real commentary text.
  const manualStubCommentaries: SourcedCommentary[] = useMemo(() => {
    // Hard override: manual user selection disables every form of auto
    // commentator injection, including admin-added "manual" commentators.
    if (hasManualSelection) return [];
    const presentKeys = new Set(allSourcedRaw.map((c) => normalizeName(c.author)));
    const stubs: SourcedCommentary[] = [];
    for (const o of overridesQuery.data ?? []) {
      if (!o.is_manual) continue;
      if (o.is_hidden) continue;
      if (presentKeys.has(o.name_key)) continue;
      // Only stub the primary variant per name_key.
      const primary = overridesByKey.get(o.name_key);
      if (primary && primary.id !== o.id) continue;
      const country = (o.country ?? "").trim();
      const countryCode = /^[A-Za-z]{2}$/.test(country) ? country.toUpperCase() : undefined;
      stubs.push({
        author: o.display_name,
        era: "",
        tradition: o.tradition ?? "",
        summary: t("commentary.manualAwaiting"),
        keyInsight: "",
        sourceGroup: t("results.contemporaryVoices"),
        country: o.country ?? undefined,
        countryCode,
        region: o.region ?? undefined,
        denomination: o.denomination ?? undefined,
        traditionKey: o.tradition ?? undefined,
        worldviewKey: o.worldview ?? undefined,
      });
    }
    return stubs;
  }, [allSourcedRaw, overridesQuery.data, overridesByKey, t, hasManualSelection]);


  // Filter out commentators blocked by the admin allow/block toggle. Also
  // drop any commentary whose specific display_name has been hidden via an
  // override row. Then apply metadata overrides so every downstream tab sees
  // admin-edited region/country/tradition/denomination. Finally dedupe by
  // normalized name so duplicate display variants only render once (the
  // primary variant after applyOverride rewrites the author).
  const allSourced: SourcedCommentary[] = useMemo(
    () => {
      const mapped = [...allSourcedRaw, ...manualStubCommentaries]
        .filter((c) => !hiddenDisplayNames.has(c.author))
        .filter((c) =>
          isCommentatorAllowed({
            author: c.author,
            tradition: c.tradition,
            blocked: blockedSet,
          }),
        )
        .map(applyOverride)
        // HARD OVERRIDE: when manual selection is active, only the user-picked
        // commentators may surface — applied after override-rewriting so the
        // canonical primary display_name matches the stored selection keys.
        .filter((c) => !hasManualSelection || userSelectionKeys.has(normalizeName(c.author)));
      const seen = new Map<string, SourcedCommentary>();
      for (const c of mapped) {
        const key = normalizeName(c.author);
        if (!seen.has(key)) seen.set(key, c);
      }
      return Array.from(seen.values());
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allSourcedRaw.length, manualStubCommentaries, blockedSet, hiddenDisplayNames, overridesByKey, hasManualSelection, userSelectionKeys],
  );

  const allowedAuthorSet = useMemo(
    () => new Set(allSourced.map((c) => normalizeName(c.author))),
    [allSourced],
  );
  const isAllowedAuthor = (a: string) => allowedAuthorSet.has(normalizeName(a));

  // Prefetch portrait thumbnails for every author currently surfaced so they
  // render instantly when the user swipes between tabs. The query layer caches
  // each result for 24h, so this is a one-time warm-up per verse lookup.
  const thumbQueryClient = useQueryClient();
  useEffect(() => {
    if (allSourced.length === 0) return;
    const seen = new Set<string>();
    for (const c of allSourced) {
      if (seen.has(c.author)) continue;
      seen.add(c.author);
      void thumbQueryClient.prefetchQuery(authorThumbQueryOptions(c.author));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allSourced.length]);

  // Map author -> source group, used to badge each author position in unified contrasts.
  const authorGroup = new Map<string, string>();
  for (const c of allSourced) authorGroup.set(c.author, c.sourceGroup);

  // Map author -> era (writing dates), shown on contrast cards instead of category badges.
  const authorEra = new Map<string, string>();
  for (const c of allSourced) authorEra.set(c.author, c.era);
  const cleanEra = (era?: string) => era?.replace(/^c\.\s*/i, "") ?? "";

  // Map author -> displayed country label. Prefer the curated ISO-code map
  // (which gives localised, canonical names); fall back to the country name
  // provided by the AI payload so newly-added global voices still surface.
  const authorCountry = new Map<string, string>();
  for (const c of allSourced) {
    const code = c.countryCode ?? AUTHOR_COUNTRIES[c.author];
    const display = code ? resolveCountryName(code) : (c.country?.trim() || null);
    if (display) authorCountry.set(c.author, display);
  }

  type TaggedPoint = { text: string };
  type TaggedContrast = {
    topic: string;
    positions: { author: string; view: string }[];
    severity: "slight" | "strong";
    worldview?: Worldview;
  };

  // Local merge of every visible group — used when unified synthesis hasn't returned yet
  // (or errored). Guarantees the UI never falls back to a single-tradition view once
  // additional groups have loaded.
  const mergedAgree: TaggedPoint[] = [
    ...data.commonGround.map((t) => ({ text: t })),
    ...(modernData?.commonGround ?? []).map((t) => ({ text: t })),
    ...historicalResults.flatMap((g) => g.commonGround.map((t) => ({ text: t }))),
  ];
  const mergedContrasts: TaggedContrast[] = [
    ...data.contrasts,
    ...(modernData?.contrasts ?? []),
    ...historicalResults.flatMap((g) => g.contrasts),
  ];

  // Unified output (when available) gives us worldview-tagged content.
  // unified.commonGround: { worldview, text }[]
  // unified.contrasts:    { topic, severity, worldview, positions }[]
  // unified.authorAssignments: each author placed in EXACTLY one worldview.
  const unifiedAgreeByWorldview = new Map<Worldview, TaggedPoint[]>();
  if (unified) {
    for (const item of unified.commonGround) {
      const w = item.worldview as Worldview;
      const list = unifiedAgreeByWorldview.get(w) ?? [];
      list.push({ text: item.text });
      unifiedAgreeByWorldview.set(w, list);
    }
  }

  // Build the per-author single-worldview assignment map.
  // Priority: AI assignment from unified synthesis, else static primary lens.
  const authorAssignment = new Map<string, Worldview>();
  if (unified) {
    for (const a of unified.authorAssignments) {
      authorAssignment.set(a.author, a.worldview as Worldview);
    }
  }
  // Admin worldview override takes priority over AI assignment and the static
  // primary lens fallback.
  const WORLDVIEW_KEYS = ["guilt-innocence", "shame-honour", "fear-power"] as const;
  for (const c of allSourced) {
    const wk = (c.worldviewKey ?? "").toString().toLowerCase().trim();
    if ((WORLDVIEW_KEYS as readonly string[]).includes(wk)) {
      authorAssignment.set(c.author, wk as Worldview);
    } else if (!authorAssignment.has(c.author)) {
      authorAssignment.set(c.author, primaryWorldview(c.author, authorCountry.get(c.author)));
    }
  }


  // Filter contrast positions to only allowed authors. Drop contrasts that
  // end up with fewer than 2 positions (no longer a "contrast").
  const filterContrastPositions = (list: TaggedContrast[]): TaggedContrast[] =>
    list
      .map((c) => ({ ...c, positions: c.positions.filter((p) => isAllowedAuthor(p.author)) }))
      .filter((c) => c.positions.length >= 2);
  const taggedContrasts: TaggedContrast[] = filterContrastPositions(
    unified ? unified.contrasts : mergedContrasts,
  );
  const slightContrasts = taggedContrasts.filter((c) => c.severity === "slight");
  const strongContrasts = taggedContrasts.filter((c) => c.severity === "strong");
  const synthesizing = hasExtraGroups && unifiedQuery.isLoading && !unified;

  // Commentators grouped by source so signed-in users can scan per category
  const commentatorGroups: { label: string; items: typeof data.commentaries }[] = [
    { label: t("results.classicCommentators"), items: data.commentaries },
    ...(modernData ? [{ label: t("results.contemporaryVoices"), items: modernData.commentaries }] : []),
    ...historicalResults.map((g) => ({
      label: HISTORICAL_GROUPS[g.group].label,
      items: g.commentaries,
    })),
  ];

  // Persist open/closed state for each worldview's Agree/Differ/Disagree
  // subsection across re-renders and re-mounts (e.g. when new data arrives
  // and a previously-empty subsection appears for the first time). Keyed by
  // `${worldview}:${section}`. Default false (closed).
  const [openSubs, setOpenSubs] = useState<Record<string, boolean>>({});
  const setSubOpen = (key: string, open: boolean) =>
    setOpenSubs((prev) => (prev[key] === open ? prev : { ...prev, [key]: open }));
  // Reset collapsible state on every new verse lookup so each verse starts
  // with all sections collapsed. State persists across tab switches within
  // the same verse.
  useEffect(() => {
    setOpenSubs({});
    setVerseOpen(true);
  }, [data.verseReference]);

  // Collapsible verse display at the top of the tabs. Open by default after a
  // new lookup; auto-collapses on tab switch so every tab shares the same
  // vertical baseline. Only the user's explicit tap re-expands it.
  const [verseOpen, setVerseOpen] = useState(true);

  // Fixed lookup header — appears after the hero scrolls out of view.
  // Contains a compact picker, the collapsed verse pill (with overlay
  // dropdown for the expanded verse), explore quick-links, and the
  // tab-title bar that anchors the swipable content area.
  const [headerVisible, setHeaderVisible] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(0);
  const fixedHeaderRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sentinel = document.querySelector("[data-hero-sentinel]") as HTMLElement | null;
    if (!sentinel) return;
    let pastHero = false;
    const update = () => {
      // Keep the sticky picker hidden at the very top of the page so the
      // top app bar (upgrade / sign-in / language) is never overlapped.
      const nearTop = window.scrollY < 120;
      setHeaderVisible(pastHero && !nearTop);
    };
    const io = new IntersectionObserver(
      ([entry]) => {
        pastHero = !entry.isIntersecting;
        update();
      },
      { threshold: 0 },
    );
    io.observe(sentinel);
    window.addEventListener("scroll", update, { passive: true });
    update();
    return () => {
      io.disconnect();
      window.removeEventListener("scroll", update);
    };
  }, []);
  useEffect(() => {
    if (!headerVisible) { setHeaderHeight(0); return; }
    const el = fixedHeaderRef.current;
    if (!el) return;
    const measure = () => setHeaderHeight(el.offsetHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [headerVisible]);

  // --- Commentary view modes (Author / Worldview / Region) -------------------
  const VIEW_KEYS = ["author", "worldview", "region", "tradition", "denomination"] as const;
  type ViewMode = (typeof VIEW_KEYS)[number];
  
  const readStoredView = (): ViewMode => "author";
  const [view, setView] = useState<ViewMode>(readStoredView);

  // Horizontal swipe between tab panels is enabled at all viewport widths.
  // Mobile/tablet use native touch swipe; desktop uses native trackpad
  // horizontal scroll / shift+wheel plus a click-and-drag gesture layer
  // wired up below.
  const isCompactTabs = true;
  const tabScrollerRef = useRef<HTMLDivElement | null>(null);
  const tabBarRef = useRef<HTMLDivElement | null>(null);
  const tabPanelRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const tabButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const programmaticScrollRef = useRef(false);
  const scrollSettleTimerRef = useRef<number | null>(null);
  // When the user clicks a tab, smoothly scroll its panel into view.
  useEffect(() => {
    if (!isCompactTabs) return;
    const scroller = tabScrollerRef.current;
    const panel = tabPanelRefs.current[view];
    if (!scroller || !panel) return;
    const target = panel.offsetLeft - (scroller.clientWidth - panel.clientWidth) / 2;
    if (Math.abs(scroller.scrollLeft - target) > 4) {
      programmaticScrollRef.current = true;
      scroller.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
      if (scrollSettleTimerRef.current) window.clearTimeout(scrollSettleTimerRef.current);
      scrollSettleTimerRef.current = window.setTimeout(() => {
        programmaticScrollRef.current = false;
      }, 600);
    }
  }, [view, isCompactTabs]);

  // Keep the active tab pill visible in the horizontally-scrollable tab bar.
  useEffect(() => {
    const bar = tabBarRef.current;
    const btn = tabButtonRefs.current[view];
    if (!bar || !btn) return;
    const target = btn.offsetLeft - (bar.clientWidth - btn.clientWidth) / 2;
    bar.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
  }, [view]);


  // Per-tab vertical scroll memory. Saves the window's scrollY for each tab
  // and restores it when the tab becomes active. Uses the existing page
  // scroll container — no new wrappers or layout changes.
  const viewScrollYRef = useRef<Record<string, number>>({
    author: 0, worldview: 0, region: 0, tradition: 0, denomination: 0,
  });
  const viewVisitedRef = useRef<Set<string>>(new Set([view]));
  const prevViewRef = useRef<ViewMode>(view);
  const restoringScrollRef = useRef(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onScroll = () => {
      if (restoringScrollRef.current) return;
      viewScrollYRef.current[view] = window.scrollY;
      viewVisitedRef.current.add(view);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [view]);
  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    const prev = prevViewRef.current;
    if (prev !== view) {
      // Snapshot the outgoing tab's current scroll before switching.
      viewScrollYRef.current[prev] = window.scrollY;
      viewVisitedRef.current.add(prev);
      // Note: do NOT reset openSubs here. Per-section open/closed state
      // must persist across tab swipes within the same verse lookup, and
      // is only cleared on a new verse (see the useEffect above keyed on
      // data.verseReference).
    }
    // Compute the minimum scrollY required so that the in-flow verse
    // display has fully scrolled under the fixed picker (which causes
    // the collapsed reference pill to snap in). Re-anchoring to at least
    // this value on every tab entry guarantees the sticky verse bar +
    // reference pill are visible at the top of the viewport, while any
    // commentary scroll position beyond that point is preserved.
    let minY = 0;
    const display = verseDisplayRef.current;
    const picker = pickerBarRef.current;
    if (display) {
      const verseBottomDoc = display.getBoundingClientRect().bottom + window.scrollY;
      const pickerH = picker?.getBoundingClientRect().height ?? 0;
      minY = Math.max(0, Math.ceil(verseBottomDoc - pickerH));
    }
    let y: number;
    if (viewVisitedRef.current.has(view)) {
      y = viewScrollYRef.current[view] ?? 0;
    } else {
      y = window.scrollY;
    }
    // Clamp so the verse display is always collapsed above the picker.
    if (y < minY) y = minY;
    viewScrollYRef.current[view] = y;
    restoringScrollRef.current = true;
    window.scrollTo(0, y);
    prevViewRef.current = view;
    const t = window.setTimeout(() => { restoringScrollRef.current = false; }, 50);
    return () => window.clearTimeout(t);
  }, [view]);


  // While the user drags the scroller, update the active tab highlight
  // to whichever panel is closest to the centre of the viewport.
  const onTabScroll = () => {
    if (!isCompactTabs || programmaticScrollRef.current) return;
    const scroller = tabScrollerRef.current;
    if (!scroller) return;
    const center = scroller.scrollLeft + scroller.clientWidth / 2;
    let best: ViewMode | null = null;
    let bestDist = Infinity;
    for (const k of VIEW_KEYS) {
      const p = tabPanelRefs.current[k];
      if (!p) continue;
      const pc = p.offsetLeft + p.clientWidth / 2;
      const d = Math.abs(pc - center);
      if (d < bestDist) { bestDist = d; best = k; }
    }
    if (best && best !== view) setView(best);
  };

  // Desktop click-and-drag gesture layer on the tab scroller. Only engages
  // for mouse pointers when horizontal intent is clear (|dx| > |dy| and
  // |dx| > threshold) so vertical page scroll remains primary. Touch and
  // pen input are left to native swipe; trackpad horizontal scroll, Magic
  // Mouse, and shift+wheel work natively via the overflow-x scroller.
  useEffect(() => {
    const scroller = tabScrollerRef.current;
    if (!scroller) return;
    let startX = 0;
    let startY = 0;
    let startScrollLeft = 0;
    let pointerId: number | null = null;
    let dragging = false;
    let armed = false;
    const THRESHOLD = 6;

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      if (e.button !== 0) return;
      // Don't intercept clicks on interactive controls inside panels.
      const target = e.target as HTMLElement | null;
      if (target && target.closest("a, button, input, textarea, select, [role='button'], [contenteditable='true']")) return;
      armed = true;
      dragging = false;
      pointerId = e.pointerId;
      startX = e.clientX;
      startY = e.clientY;
      startScrollLeft = scroller.scrollLeft;
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!armed || pointerId !== e.pointerId) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (!dragging) {
        if (Math.abs(dx) < THRESHOLD || Math.abs(dx) <= Math.abs(dy)) return;
        dragging = true;
        scroller.classList.add("vs-tab-dragging");
        try { scroller.setPointerCapture(e.pointerId); } catch {}
      }
      scroller.scrollLeft = startScrollLeft - dx;
      e.preventDefault();
    };
    const endDrag = (e: PointerEvent) => {
      if (pointerId !== e.pointerId) return;
      const wasDragging = dragging;
      armed = false;
      dragging = false;
      pointerId = null;
      if (wasDragging) {
        scroller.classList.remove("vs-tab-dragging");
        try { scroller.releasePointerCapture(e.pointerId); } catch {}
        // Re-enable snap; smoothly settle to the nearest panel.
        const center = scroller.scrollLeft + scroller.clientWidth / 2;
        let best: HTMLDivElement | null = null;
        let bestDist = Infinity;
        for (const k of VIEW_KEYS) {
          const p = tabPanelRefs.current[k];
          if (!p) continue;
          const pc = p.offsetLeft + p.clientWidth / 2;
          const d = Math.abs(pc - center);
          if (d < bestDist) { bestDist = d; best = p; }
        }
        if (best) {
          const target = best.offsetLeft - (scroller.clientWidth - best.clientWidth) / 2;
          scroller.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
        }
      }
    };
    const onClickCapture = (e: MouseEvent) => {
      // Suppress click that follows a real drag.
      if ((e as any)._vsFromDrag) return;
    };

    scroller.addEventListener("pointerdown", onPointerDown);
    scroller.addEventListener("pointermove", onPointerMove);
    scroller.addEventListener("pointerup", endDrag);
    scroller.addEventListener("pointercancel", endDrag);
    scroller.addEventListener("click", onClickCapture, true);
    return () => {
      scroller.removeEventListener("pointerdown", onPointerDown);
      scroller.removeEventListener("pointermove", onPointerMove);
      scroller.removeEventListener("pointerup", endDrag);
      scroller.removeEventListener("pointercancel", endDrag);
      scroller.removeEventListener("click", onClickCapture, true);
    };
  }, []);

  // Show a gentle "Scroll up to view content" hint when a horizontal swipe
  // lands the viewport on an empty area because the new tab's content lies
  // above the current scroll position. Fades in then auto-fades out.
  const [scrollHintVisible, setScrollHintVisible] = useState(false);
  useEffect(() => {
    if (!isCompactTabs || typeof window === "undefined") {
      setScrollHintVisible(false);
      return;
    }
    let hideTimer: number | null = null;
    // Wait until the per-tab scroll restoration settles (see effect above, ~50ms).
    const checkTimer = window.setTimeout(() => {
      const panel = tabPanelRefs.current[view];
      if (!panel) return;
      const rect = panel.getBoundingClientRect();
      const vh = window.innerHeight;
      // Conditions: content extends above viewport (top < threshold) AND a
      // meaningful blank area is visible below the content (bottom < ~60% vh).
      const hasContentAbove = rect.top < -40;
      const hasBlankBelow = rect.bottom < vh * 0.6;
      if (hasContentAbove && hasBlankBelow) {
        setScrollHintVisible(true);
        hideTimer = window.setTimeout(() => setScrollHintVisible(false), 2800);
      }
    }, 140);
    const onScroll = () => {
      setScrollHintVisible(false);
      if (hideTimer) { window.clearTimeout(hideTimer); hideTimer = null; }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.clearTimeout(checkTimer);
      if (hideTimer) window.clearTimeout(hideTimer);
      window.removeEventListener("scroll", onScroll);
    };
  }, [view, isCompactTabs]);


  // Region grouping (used by "By Region" view).
  const REGION_KEYS = [
    "europe", "north_america", "latin_america", "africa", "asia", "middle_east", "oceania", "other",
  ] as const;
  type RegionKey = (typeof REGION_KEYS)[number];
  const REGION_COUNTRIES: Record<Exclude<RegionKey, "other">, Set<string>> = {
    europe: new Set(["GB","DE","FR","CH","NL","IT","ES","GR","RU","IE","SE","NO","DK","HR","BE","AT","PT","FI","PL","CZ","HU","RO","UA"]),
    north_america: new Set(["US","CA"]),
    latin_america: new Set(["BR","MX","AR","PE","EC","PR","CR","CO","CL","VE","UY","BO","PY","GT","HN","SV","NI","DO","CU"]),
    africa: new Set(["EG","ET","ZA","KE","NG","GH","DZ","TN","UG","ZW","CM","AO","MZ","TZ","RW","BJ","SN","ML","CI","CD","MG"]),
    asia: new Set(["KR","JP","CN","IN","PH","TW","LK","TH","VN","ID","MY","SG","PK","BD","NP","MM"]),
    middle_east: new Set(["IL","TR","IR","SA","AE","JO","LB","SY","IQ","QA","KW","BH","OM","YE","PS"]),
    oceania: new Set(["AU","NZ","PG","FJ"]),
  };
  // Map a region string from payload metadata (e.g. "Africa", "Latin America")
  // to one of our region keys. Falls back to null so the country-based lookup
  // can take over.
  const regionKeyFromLabel = (label?: string | null): RegionKey | null => {
    if (!label) return null;
    // Normalize: lowercase, swap underscores/hyphens for spaces, collapse whitespace.
    // This lets canonical keys ("north_america") and human labels ("North America")
    // both resolve to the same region key. Admin overrides always reach here first
    // via `c.region`, so a stored override key always wins over auto-classification.
    const s = label.toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
    if (s === "europe" || s.includes("europe")) return "europe";
    if (s === "north america" || s.includes("north america") || s === "usa" || s === "us" || s === "canada") return "north_america";
    if (s === "latin america" || s.includes("latin") || s.includes("south america") || s.includes("central america") || s.includes("caribbean")) return "latin_america";
    if (s === "africa" || s.includes("africa")) return "africa";
    if (s === "middle east" || s.includes("middle east") || s.includes("near east")) return "middle_east";
    if (s === "oceania" || s.includes("oceania") || s.includes("pacific") || s.includes("australasia")) return "oceania";
    if (s === "asia" || s.includes("asia")) return "asia";
    if (s === "other") return "other";
    return null;
  };

  const regionForCountry = (code?: string | null): Exclude<RegionKey, "other"> | null => {
    if (!code) return null;
    const u = code.toUpperCase();
    for (const k of REGION_KEYS) {
      if (k === "other") continue;
      if (REGION_COUNTRIES[k as Exclude<RegionKey, "other">].has(u)) return k as Exclude<RegionKey, "other">;
    }
    return null;
  };
  // Resolve a commentator's region from the unified metadata object.
  // Admin overrides flow through `region` / `country` / `countryCode`. We try
  // an explicit region label first, then a country code (override or static
  // author map), then a country string interpreted either as a 2-letter code
  // or a country name. Only fall back to "other" when nothing matches.
  const regionForCommentator = (c: SourcedCommentary): RegionKey => {
    const rawCountry = (c.country ?? "").trim();
    const countryAsCode = /^[A-Za-z]{2}$/.test(rawCountry) ? rawCountry.toUpperCase() : null;
    return (
      regionKeyFromLabel(c.region) ??
      regionForCountry(c.countryCode ?? countryAsCode ?? AUTHOR_COUNTRIES[c.author] ?? null) ??
      regionKeyFromLabel(c.country) ??
      "other"
    );
  };

  // Tradition grouping (used by "By Tradition" view). Maps sourceGroup -> locale key.
  const TRADITION_KEYS = ["classic", "contemporary", "foundational", "fathers", "reformation"] as const;
  type TraditionKey = (typeof TRADITION_KEYS)[number];
  const traditionForSourceGroup = (sg: string): TraditionKey | null => {
    if (sg === "Classic") return "classic";
    if (sg === "Contemporary") return "contemporary";
    if (sg === "Foundational Theologians") return "foundational";
    if (sg === "Historic Church Fathers") return "fathers";
    if (sg === "Reformation Voices") return "reformation";
    return null;
  };
  // Honor admin override (stored as a TRADITION_KEYS value) before falling back
  // to the source-group mapping. Ensures every tradition category appears for
  // admin-classified commentators, not just the two sourceGroup defaults.
  const traditionForCommentary = (c: SourcedCommentary): TraditionKey | null => {
    const k = (c.traditionKey ?? "").toString().toLowerCase().trim();
    if ((TRADITION_KEYS as readonly string[]).includes(k)) return k as TraditionKey;
    return traditionForSourceGroup(c.sourceGroup);
  };


  // Denomination grouping (used by "By Denomination" view). Uses the shared
  // canonical mapper so equivalent values ("Anglican", "anglican",
  // "Church of England") collapse to a single bucket. Unmatched denominations
  // fall into "otherChristian" so no commentator is silently dropped.
  const DENOMINATION_KEYS = [
    "catholic", "orthodox", "anglican", "reformed", "baptist",
    "pentecostal", "methodist", "lutheran", "nondenominational", "otherChristian",
  ] as const;
  type DenominationKey = (typeof DENOMINATION_KEYS)[number];
  const canonicalDenomination = (raw?: string | null): string =>
    (raw ?? "").toString().toLowerCase().replace(/[._-]+/g, " ").replace(/\s+/g, " ").trim();
  const denominationForCommentator = (c: SourcedCommentary): DenominationKey => {
    return (
      denominationKeyFromTradition(canonicalDenomination(c.denomination)) ??
      denominationKeyFromTradition(canonicalDenomination(c.tradition)) ??
      "otherChristian"
    );
  };

  const worldviewLabelFor = (w: Worldview): string => {
    const meta = WORLDVIEWS.find((x) => x.key === w);
    return localizeHonour(meta ? t(meta.labelKey) : "", honour);
  };



  // Track when the in-flow verse display has scrolled above the fixed picker
  // bar; when it has, a sticky collapsed pill appears beneath the picker so
  // the user can always see + tap the current reference.
  const verseDisplayRef = useRef<HTMLDivElement>(null);
  const pickerBarRef = useRef<HTMLDivElement>(null);
  const [pillStuck, setPillStuck] = useState(false);
  useEffect(() => {
    if (!headerVisible) { setPillStuck(false); return; }
    const onScroll = () => {
      const display = verseDisplayRef.current;
      const picker = pickerBarRef.current;
      if (!display || !picker) return;
      const pickerBottom = picker.getBoundingClientRect().bottom;
      const displayBottom = display.getBoundingClientRect().bottom;
      setPillStuck(displayBottom < pickerBottom);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [headerVisible]);

  // Floating swipe-hint visibility: only show when the user has scrolled
  // past the in-flow verse display into the commentary tab area.
  const [showSwipeHint, setShowSwipeHint] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const display = verseDisplayRef.current;
    if (!display) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        const isPast = !entry.isIntersecting && entry.boundingClientRect.top < 0;
        setShowSwipeHint(isPast);
      },
      { threshold: 0 },
    );
    observer.observe(display);
    return () => observer.disconnect();
  }, []);

  const pullVerseBack = () => {
    setVerseOpen(true);
    requestAnimationFrame(() => {
      const display = verseDisplayRef.current;
      const picker = pickerBarRef.current;
      if (!display) return;
      const offset = picker?.getBoundingClientRect().height ?? 0;
      const top = display.getBoundingClientRect().top + window.scrollY - offset - 8;
      window.scrollTo({ top, behavior: "smooth" });
    });
  };

  return (
    <div ref={resultsRootRef} className="space-y-10">
      {/* Fixed picker bar — the primary sticky anchor. Appears after the
          hero scrolls out of view and stays pinned at the top. The verse
          display and Explore bar live in normal flow below it. A slim
          collapsed pill snaps under the picker when the in-flow verse
          display has scrolled out of view. */}
      {headerVisible && (
        <>
          <div aria-hidden style={{ height: headerHeight }} />
          <div
            ref={fixedHeaderRef}
            className="fixed inset-x-0 top-0 z-40 border-b border-border bg-background shadow-[0_2px_10px_-4px_rgba(0,0,0,0.18)]"
          >
            <div ref={pickerBarRef} className="mx-auto max-w-3xl px-3 py-2 sm:px-5">
              <UnifiedVersePicker
                value={headerControls.pickerValue}
                onChange={headerControls.setPickerValue}
                onSubmit={headerControls.pickerSubmit}
                onCancel={headerControls.pickerCancel}
                disabled={headerControls.pickerDisabled}
                pending={headerControls.pickerPending}
                submitLabel={headerControls.pickerSubmitLabel}
                placeholder={t("home.versePickerBar.label")}
              />
            </div>
            {pillStuck && (
              <div className="border-t border-border bg-background px-3 py-1.5 sm:px-5">
                <button
                  type="button"
                  onClick={pullVerseBack}
                  aria-label={t("home.tapToShowVerse")}
                  className="mx-auto flex w-full max-w-3xl items-center justify-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-xs font-medium text-foreground/80 transition hover:bg-accent/40"
                >
                  <span className="truncate">
                    {t("home.tapToShowVerse")}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* In-flow verse display (solid, non-collapsible). Always rendered
          fully expanded directly beneath the picker; pushes commentary
          downward. Scrolls under the fixed picker on upward scroll and a
          compact pill takes its place. */}
      <div
        ref={verseDisplayRef}
        className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
      >
        <div className="flex w-full items-center gap-3 border-b border-border px-5 py-3">
          <span className="truncate text-sm font-semibold text-foreground">
            {data.verseReference} · {data.translation}
          </span>
        </div>
        <div className="px-5 pb-5">
          <PassageDisplay text={data.verseText} />
        </div>
      </div>





      {((hasModern && modern.isLoading) || historicalLoading || synthesizing) && (
        <div className="rounded-2xl border border-dashed border-border bg-card/40 p-4 text-center text-sm text-muted-foreground">
          <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
          {synthesizing
            ? t("loading.comparingAll")
            : hasModern && modern.isLoading
              ? t("loading.contemporary")
              : t("loading.historical")}
        </div>
      )}

      {hasPending && !hasManualSelection && (
        <div
          onClick={applyRefresh}
          className="fixed bottom-6 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 cursor-pointer items-center justify-between gap-3 rounded-full border border-primary/40 bg-primary/15 px-4 py-2.5 text-sm shadow-lg backdrop-blur-md"
        >
          <span className="flex items-center gap-2 text-foreground">
            <Sparkles className="h-4 w-4 text-primary" />
            {t("commentary.tapToUpdateHint")}
          </span>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); applyRefresh(); }}
            className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
          >
            {t("commentary.tapToUpdate")}
          </button>
        </div>
      )}


      {/* Floating swipe-hint indicator — purely informational, shows active tab
          via a dot and an icon hinting horizontal swipe. Non-interactive.
          Only visible when the user has scrolled past the verse display into
          the commentary tab area; fades in/out smoothly. */}
      {isCompactTabs && (mergedAgree.length > 0 ||
        unifiedAgreeByWorldview.size > 0 ||
        slightContrasts.length > 0 ||
        strongContrasts.length > 0 ||
        allSourced.length > 0) && (
        <div
          aria-hidden="true"
          className={`pointer-events-none fixed left-1/2 z-40 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-border bg-background/90 px-3 py-1.5 shadow-md backdrop-blur transition-opacity duration-200 ease-out ${hasPending ? "bottom-20" : "bottom-3"} ${showSwipeHint ? "opacity-100" : "opacity-0"}`}
        >
          <ArrowLeftRight className="h-3 w-3 text-muted-foreground" strokeWidth={1.75} />
          <div className="flex items-center gap-1">
            {VIEW_KEYS.map((k) => (
              <span
                key={k}
                className={`h-1.5 rounded-full transition-all ${view === k ? "w-3 bg-primary" : "w-1.5 bg-muted-foreground/35"}`}
              />
            ))}
          </div>
        </div>
      )}

      {/* View tabs — swipe-only navigation; the highlight tab bar and
          floating indicator have been removed. Each tab's section header
          (rendered inside the panel) acts as the visual identifier. */}
      {(mergedAgree.length > 0 ||
        unifiedAgreeByWorldview.size > 0 ||
        slightContrasts.length > 0 ||
        strongContrasts.length > 0 ||
        allSourced.length > 0) && (
        <div className="space-y-6">


          {/* Blank-area hint: shown when a horizontal swipe lands the user on
              an empty area because the new tab's content sits above the
              current scroll position. Fades in then out automatically. */}
          {isCompactTabs && (
            <button
              type="button"
              aria-hidden={!scrollHintVisible}
              tabIndex={scrollHintVisible ? 0 : -1}
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              style={{ top: (headerVisible ? headerHeight : 64) + 12 }}
              className={`fixed left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 rounded-full border border-border bg-background/95 px-4 py-2 text-xs font-medium text-foreground shadow-lg backdrop-blur transition-opacity duration-300 ease-out ${scrollHintVisible ? "opacity-100" : "pointer-events-none opacity-0"}`}
            >
              <ArrowUp className="h-3.5 w-3.5 text-primary" strokeWidth={1.75} />
              {t("home.scrollUpHint")}
            </button>
          )}

          <div className="mb-4 flex justify-center">
            <CommentatorCompareControl
              tier={tier}
              currentlyDisplayed={allSourced.map((c) => c.author)}
              onApply={onApplyUserSelection}
              label={t("home.selectCommentatorsToCompare")}
            />
          </div>

          <div ref={tabScrollerRef} onScroll={onTabScroll} className="vs-tab-scroller">

      {/* Layered worldview comparison */}
      {(isCompactTabs || view === "worldview") && (mergedAgree.length > 0 ||
        unifiedAgreeByWorldview.size > 0 ||
        slightContrasts.length > 0 ||
        strongContrasts.length > 0) && (
        <div ref={(el) => { tabPanelRefs.current["worldview"] = el; }} data-view-key="worldview" className="vs-tab-panel relative">
          <div className={locked ? "mt-3 space-y-6 blur-md select-none pointer-events-none" : "mt-3 space-y-6"}>
            <div className="w-full rounded-xl bg-primary px-4 py-3 shadow-sm">
              <h2 className="text-center font-display text-[15px] font-bold text-primary-foreground whitespace-nowrap sm:text-2xl">Comparisons grouped by worldview</h2>
            </div>

            {WORLDVIEWS.map((w) => {
              // Authors assigned to THIS worldview (unique — no author appears twice).
              // When the unified synthesis is available, use the AI's per-verse
              // assignment; otherwise fall back to each author's static primary lens.
              const eligibleAuthors = new Set<string>(
                allSourced.map((c) => c.author).filter((a) => authorAssignment.get(a) === w.key),
              );

              const filterContrast = (c: TaggedContrast): TaggedContrast | null => {
                // When unified provides worldview tags, only show this contrast
                // in its own worldview section.
                if (unified && c.worldview && c.worldview !== w.key) return null;
                const positions = c.positions.filter((p) => eligibleAuthors.has(p.author));
                if (positions.length === 0) return null;
                return { ...c, positions };
              };
              const wSlight = slightContrasts.map(filterContrast).filter((c): c is TaggedContrast => !!c);
              const wStrong = strongContrasts.map(filterContrast).filter((c): c is TaggedContrast => !!c);

              // Common-ground for this worldview.
              // - Unified: only the bullets the AI tagged with this worldview.
              // - Fallback (pre-unified): show the merged list in every section so
              //   the user still sees agreement points.
              const wAgree: TaggedPoint[] = unified ? (unifiedAgreeByWorldview.get(w.key) ?? []) : mergedAgree;
              const showAgree = eligibleAuthors.size > 0 && wAgree.length > 0;

              return (
                <WorldviewSection
                  key={w.key}
                  worldviewKey={w.key}
                  title={localizeHonour(t(w.labelKey), honour)}
                  reference={data.verseReference}
                  loading={synthesizing}
                  tint={w.key === "guilt-innocence" ? "#C5D3E2" : w.key === "shame-honour" ? "#E2D2CC" : "#C9DDD3"}
                  empty={!showAgree && wSlight.length === 0 && wStrong.length === 0}
                  emptyLabel={t("results.noVoicesInWorldview")}
                  open={!!openSubs[`worldview:${w.key}`]}
                  onOpenChange={(o) => { setSubOpen(`worldview:${w.key}`, o); if (o) trackSectionOpen("worldview", w.key); }}
                >
                  {showAgree && (
                    <AgreeGroup
                      icon={<Sparkles className="h-4 w-4 text-agree" />}
                      label={t("results.agree")}
                      points={wAgree.slice(0, 6).map((p) => p.text)}
                      allVoicesLabel={t("results.allVoices")}
                      verseRef={data.verseReference}
                      open={!!openSubs[`${w.key}:agree`]}
                      onOpenChange={(o) => { setSubOpen(`${w.key}:agree`, o); if (o) trackSectionOpen("agree", w.key); }}
                    />
                  )}

                  {wSlight.length > 0 && (
                    <ContrastGroup
                      tone="slight"
                      icon={<GitCompare className="h-4 w-4 text-slight-diff" />}
                      label={t("results.differ")}
                      open={!!openSubs[`${w.key}:differ`]}
                      onOpenChange={(o) => { setSubOpen(`${w.key}:differ`, o); if (o) trackSectionOpen("differ", w.key); }}
                      cards={wSlight.map((c, i) => ({
                        key: `slight-${i}`,
                        title: c.topic,
                        copyNode: (
                          <CopyAllBlockButton
                            verseRef={data.verseReference}
                            voices={c.positions.map((p) => ({
                              author: p.author,
                              country: resolveCountryName(authorCountry.get(p.author)),
                              era: authorEra.get(p.author),
                              summary: p.view,
                            }))}
                          />
                        ),
                        body: (
                          <div className="space-y-3">
                            {c.positions.map((p, j) => (
                              <div
                                key={j}
                                className="rounded-xl border border-white/45 border-l-[3px] border-l-slight-diff bg-slight-diff/5 px-5 py-4 shadow-[0_10px_28px_-20px_rgba(47,72,88,0.28)] backdrop-blur-[10px]"
                              >
                                <div>
                                  <div className="flex flex-wrap items-baseline gap-x-2">
                                    <span className="text-base font-semibold text-slight-diff">{p.author}</span>
                                    <CountryLabel code={authorCountry.get(p.author)} />
                                  </div>
                                  {authorEra.get(p.author) && (
                                    <div className="mt-0.5 text-xs text-muted-foreground">
                                      {cleanEra(authorEra.get(p.author)!)}
                                    </div>
                                  )}
                                </div>
                                <p className="mt-2 text-base leading-relaxed">{highlightPosition(p.view, c.positions.filter((_, k) => k !== j).map((s) => s.view))}</p>
                              </div>
                            ))}
                          </div>
                        ),
                      }))}
                    />
                  )}

                  {wStrong.length > 0 && (
                    <ContrastGroup
                      tone="strong"
                      icon={<GitCompare className="h-4 w-4 text-strong-diff" />}
                      label={t("results.disagree")}
                      open={!!openSubs[`${w.key}:disagree`]}
                      onOpenChange={(o) => { setSubOpen(`${w.key}:disagree`, o); if (o) trackSectionOpen("disagree", w.key); }}
                      cards={wStrong.map((c, i) => ({
                        key: `strong-${i}`,
                        title: c.topic,
                        copyNode: (
                          <CopyAllBlockButton
                            verseRef={data.verseReference}
                            voices={c.positions.map((p) => ({
                              author: p.author,
                              country: resolveCountryName(authorCountry.get(p.author)),
                              era: authorEra.get(p.author),
                              summary: p.view,
                            }))}
                          />
                        ),
                        body: (
                          <div className="space-y-3">
                            {c.positions.map((p, j) => (
                              <div
                                key={j}
                                className="rounded-xl border border-white/45 border-l-[3px] border-l-strong-diff bg-strong-diff/5 px-5 py-4 shadow-[0_10px_28px_-20px_rgba(47,72,88,0.28)] backdrop-blur-[10px]"
                              >
                                <div>
                                  <div className="flex flex-wrap items-baseline gap-x-2">
                                    <span className="text-base font-semibold text-strong-diff">{p.author}</span>
                                    <CountryLabel code={authorCountry.get(p.author)} />
                                  </div>
                                  {authorEra.get(p.author) && (
                                    <div className="mt-0.5 text-xs text-muted-foreground">
                                      {cleanEra(authorEra.get(p.author)!)}
                                    </div>
                                  )}
                                </div>
                                <p className="mt-2 text-base leading-relaxed">{highlightPosition(p.view, c.positions.filter((_, k) => k !== j).map((s) => s.view))}</p>
                              </div>
                            ))}
                          </div>
                        ),
                      }))}
                    />
                  )}
                </WorldviewSection>
              );
            })}
          </div>

          {locked && (
            <div className="absolute inset-0 flex items-center justify-center p-4">
              <div className="max-w-sm rounded-2xl border border-border bg-card/95 p-6 text-center shadow-xl backdrop-blur">
                <Sparkles className="mx-auto h-8 w-8 text-primary" />
                <h3 className="font-display mt-3 text-xl font-semibold">{t("locked.title")}</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {t("locked.bodyPre")}
                  <span className="mx-1 inline-block rounded bg-slight-diff/20 px-1.5 font-medium text-foreground">
                    {t("locked.slight")}
                  </span>
                  {t("locked.and")}
                  <span className="mx-1 inline-block rounded bg-strong-diff/20 px-1.5 font-medium text-foreground">
                    {t("locked.strong")}
                  </span>
                  {t("locked.bodyPost")}
                </p>
                <Link
                  to="/pricing"
                  className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
                >
                  {t("locked.seePlans")}
                </Link>
              </div>
            </div>
          )}
        </div>
      )}

      {/* By Author view — single set of Agree/Differ/Disagree, independently collapsible */}
      {(isCompactTabs || view === "author") && (
        <div ref={(el) => { tabPanelRefs.current["author"] = el; }} data-view-key="author" className="vs-tab-panel mt-3 space-y-6">
          <div className="w-full rounded-xl bg-primary px-4 py-3 shadow-sm">
            <h2 className="text-center font-display text-[15px] font-bold text-primary-foreground whitespace-nowrap sm:text-2xl">Commentators grouped by perspective</h2>
          </div>

          {mergedAgree.length > 0 && (() => {
            const key = "author:agree";
            const open = !!openSubs[key];
            const topAgree = mergedAgree.slice(0, 6);
            return (
              <section>
                <div className="flex w-full items-center gap-3 rounded-2xl border-2 border-agree/60 bg-agree/10 px-4 py-3 sm:px-5 sm:py-4">
                  <button
                    type="button"
                    onClick={() => setSubOpen(key, !open)}
                    aria-expanded={open}
                    className="flex flex-1 items-center gap-3 text-left"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-agree/20 text-agree">
                      <Sparkles className="h-5 w-5" />
                    </span>
                    <h3 className="flex-1 font-display text-lg font-bold text-agree sm:text-xl">{t("results.agree")}</h3>
                  </button>
                  <CopyAllAgreeButton
                    points={topAgree.map((p) => p.text)}
                    verseRef={data.verseReference}
                  />
                  <button
                    type="button"
                    onClick={() => setSubOpen(key, !open)}
                    aria-label={t("results.agree")}
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-agree/20 text-agree transition ${open ? "rotate-180" : ""}`}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>
                </div>
                {open && (
                  <ul className="mt-3 grid gap-2 px-1 sm:grid-cols-2">
                    {topAgree.map((p, i) => (
                      <li key={i} className="flex gap-2 rounded-xl border border-border bg-card p-3 text-sm">
                        <span className="mt-1.5 h-1.5 w-4 shrink-0 rounded-full bg-agree" />
                        <span className="leading-relaxed">{p.text}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })()}
          {(["slight", "strong"] as const).map((sev) => {
            const items = (sev === "slight" ? slightContrasts : strongContrasts);
            if (items.length === 0) return null;
            const tone = sev === "slight" ? "slight" : "strong";
            const label = sev === "slight" ? t("results.differ") : t("results.disagree");
            const borderC = sev === "slight" ? "border-slight-diff" : "border-strong-diff";
            const bgC = sev === "slight" ? "bg-slight-diff/5" : "bg-strong-diff/5";
            const textC = sev === "slight" ? "text-slight-diff" : "text-strong-diff";
            const headerBorder = sev === "slight" ? "border-slight-diff/60" : "border-strong-diff/60";
            const headerBg = sev === "slight" ? "bg-slight-diff/10" : "bg-strong-diff/10";
            const iconBg = sev === "slight" ? "bg-slight-diff/20" : "bg-strong-diff/20";
            void tone;
            const key = `author:${sev}`;
            const open = !!openSubs[key];
            return (
              <section key={sev}>
                <button
                  type="button"
                  onClick={() => setSubOpen(key, !open)}
                  aria-expanded={open}
                  className={`flex w-full items-center gap-3 rounded-2xl border-2 ${headerBorder} ${headerBg} px-4 py-3 text-left sm:px-5 sm:py-4`}
                >
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${iconBg} ${textC}`}>
                    <GitCompare className="h-5 w-5" />
                  </span>
                  <h3 className={`flex-1 font-display text-lg font-bold sm:text-xl ${textC}`}>{label}</h3>
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${iconBg} ${textC} transition ${open ? "rotate-180" : ""}`}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </span>
                </button>
                {open && (
                  <div className="mt-4 space-y-3">
                    {items.map((c, i) => {
                      const cardKey = `author:${sev}:${i}`;
                      const cardOpen = !!openSubs[cardKey];
                      return (
                        <div key={i} className="rounded-xl border border-border bg-card p-4">
                          <button
                            type="button"
                            onClick={() => setSubOpen(cardKey, !cardOpen)}
                            aria-expanded={cardOpen}
                            className="flex w-full items-center justify-between gap-3 text-left"
                          >
                            <h4 className="font-display text-base font-semibold">{c.topic}</h4>
                            <div className="flex items-center gap-2">
                              <CopyAllBlockButton
                                verseRef={data.verseReference}
                                voices={c.positions.map((p) => ({
                                  author: p.author,
                                  country: resolveCountryName(authorCountry.get(p.author)),
                                  era: authorEra.get(p.author),
                                  summary: p.view,
                                }))}
                              />
                              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition ${cardOpen ? "rotate-180 bg-accent text-foreground" : ""}`}>
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="6 9 12 15 18 9" />
                                </svg>
                              </span>
                            </div>
                          </button>
                          {cardOpen && (
                            <div className="mt-3 space-y-2">
                              {c.positions.map((p, j) => (
                                <div key={j} className={`rounded-xl border-l-[3px] ${borderC} ${bgC} px-5 py-4`}>
                                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                                    <span className={`text-base font-semibold ${textC}`}>{p.author}</span>
                                    <CountryLabel code={authorCountry.get(p.author)} />
                                    {authorEra.get(p.author) && (
                                      <span className="text-xs font-medium text-muted-foreground">{cleanEra(authorEra.get(p.author)!)}</span>
                                    )}
                                  </div>
                                  <p className="mt-2 text-base leading-relaxed">{highlightPosition(p.view, c.positions.filter((_, k) => k !== j).map((s) => s.view))}</p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      {/* By Region view — each region independently collapsible */}
      {(isCompactTabs || view === "region") && (
        <div ref={(el) => { tabPanelRefs.current["region"] = el; }} data-view-key="region" className="vs-tab-panel mt-3 space-y-6">
          <div className="w-full rounded-xl bg-primary px-4 py-3 shadow-sm">
            <h2 className="text-center font-display text-[15px] font-bold text-primary-foreground whitespace-nowrap sm:text-2xl">{t("views.byRegionHelp")}</h2>
          </div>
          {REGION_KEYS.map((rk) => {
            const items = allSourced.filter((c) => regionForCommentator(c) === rk);
            if (items.length === 0) return null;
            const key = `region:${rk}`;
            const open = !!openSubs[key];
            return (
              <section key={rk} className="rounded-3xl border border-border bg-card/40 p-5 sm:p-7">
                <button
                  type="button"
                  onClick={() => setSubOpen(key, !open)}
                  aria-expanded={open}
                  className="flex w-full items-center justify-between gap-3 text-left"
                >
                  <div className="flex items-center gap-2">
                    <h2 className="font-display text-xl font-semibold sm:text-2xl">{t(`regions.${rk}`)}</h2>
                    <span className="inline-flex items-center rounded-full border border-border bg-background px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {items.length}
                    </span>
                  </div>
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition ${open ? "rotate-180 bg-accent text-foreground" : ""}`}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </span>
                </button>
                {open && (
                  <div className="mt-4 space-y-2">
                    {items.map((c) => {
                      return (
                        <details
                          key={`${rk}-${c.author}`}
                          className="group rounded-xl border border-border bg-background/60 [&_summary::-webkit-details-marker]:hidden"
                        >
                          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
                            <AuthorThumbnail name={c.author} size={40} />
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                                <h4 className="font-display truncate text-base font-semibold">{c.author}</h4>
                                <CountryLabel code={authorCountry.get(c.author)} />
                              </div>
                              <p className="mt-0.5 text-xs font-medium text-muted-foreground">{c.era}</p>
                            </div>
                            <CopyCardButton
                              author={c.author}
                              country={resolveCountryName(authorCountry.get(c.author)) ?? c.country}
                              era={c.era}
                              summary={c.summary}
                              keyInsight={c.keyInsight}
                              verseRef={data.verseReference}
                            />
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition group-open:rotate-180 group-open:bg-accent group-open:text-foreground">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="6 9 12 15 18 9" />
                              </svg>
                            </span>
                          </summary>
                          <div className="border-t border-border px-4 py-4">
                            <p className="text-base leading-relaxed text-foreground/80">{c.summary}</p>
                            {c.keyInsight && (
                              <p className="mt-3 border-t border-border pt-3 text-sm italic leading-relaxed text-muted-foreground">
                                <span className="not-italic font-semibold text-foreground/70">{t("results.keyInsight")} · </span>
                                {c.keyInsight}
                              </p>
                            )}
                          </div>
                        </details>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      {/* By Tradition view — each tradition independently collapsible */}
      {(isCompactTabs || view === "tradition") && (
        <div ref={(el) => { tabPanelRefs.current["tradition"] = el; }} data-view-key="tradition" className="vs-tab-panel mt-3 space-y-6">
          <div className="w-full rounded-xl bg-primary px-4 py-3 shadow-sm">
            <h2 className="text-center font-display text-[15px] font-bold text-primary-foreground whitespace-nowrap sm:text-2xl">{t("views.byTraditionHelp")}</h2>
          </div>
          {TRADITION_KEYS.map((tk) => {
            const items = allSourced.filter((c) => traditionForCommentary(c) === tk);
            if (items.length === 0) return null;
            const key = `tradition:${tk}`;
            const open = !!openSubs[key];
            return (
              <section key={tk} className="rounded-3xl border border-border bg-card/40 p-5 sm:p-7">
                <button
                  type="button"
                  onClick={() => setSubOpen(key, !open)}
                  aria-expanded={open}
                  className="flex w-full items-center justify-between gap-3 text-left"
                >
                  <div className="flex items-center gap-2">
                    <h2 className="font-display text-xl font-semibold sm:text-2xl">{t(`traditions.${tk}`)}</h2>
                    <span className="inline-flex items-center rounded-full border border-border bg-background px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {items.length}
                    </span>
                  </div>
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition ${open ? "rotate-180 bg-accent text-foreground" : ""}`}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </span>
                </button>
                {open && (
                  <div className="mt-4 space-y-2">
                    {items.map((c) => {
                      return (
                        <details
                          key={`${tk}-${c.author}`}
                          className="group rounded-xl border border-border bg-background/60 [&_summary::-webkit-details-marker]:hidden"
                        >
                          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
                            <AuthorThumbnail name={c.author} size={40} />
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                                <h4 className="font-display truncate text-base font-semibold">{c.author}</h4>
                                <CountryLabel code={authorCountry.get(c.author)} />
                              </div>
                              <p className="mt-0.5 text-xs font-medium text-muted-foreground">{c.era}</p>
                            </div>
                            <CopyCardButton
                              author={c.author}
                              country={resolveCountryName(authorCountry.get(c.author)) ?? c.country}
                              era={c.era}
                              summary={c.summary}
                              keyInsight={c.keyInsight}
                              verseRef={data.verseReference}
                            />
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition group-open:rotate-180 group-open:bg-accent group-open:text-foreground">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="6 9 12 15 18 9" />
                              </svg>
                            </span>
                          </summary>
                          <div className="border-t border-border px-4 py-4">
                            <p className="text-base leading-relaxed text-foreground/80">{c.summary}</p>
                            {c.keyInsight && (
                              <p className="mt-3 border-t border-border pt-3 text-sm italic leading-relaxed text-muted-foreground">
                                <span className="not-italic font-semibold text-foreground/70">{t("results.keyInsight")} · </span>
                                {c.keyInsight}
                              </p>
                            )}
                          </div>
                        </details>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      {/* By Denomination view — each denomination independently collapsible */}
      {(isCompactTabs || view === "denomination") && (
        <div ref={(el) => { tabPanelRefs.current["denomination"] = el; }} data-view-key="denomination" className="vs-tab-panel mt-3 space-y-6">
          <div className="w-full rounded-xl bg-primary px-4 py-3 shadow-sm">
            <h2 className="text-center font-display text-[15px] font-bold text-primary-foreground whitespace-nowrap sm:text-2xl">{t("views.byDenominationHelp")}</h2>
          </div>
          {DENOMINATION_KEYS.map((dk) => {
            const items = allSourced.filter((c) => denominationForCommentator(c) === dk);

            if (items.length === 0) return null;
            const key = `denomination:${dk}`;
            const open = !!openSubs[key];
            return (
              <section key={dk} className="rounded-3xl border border-border bg-card/40 p-5 sm:p-7">
                <button
                  type="button"
                  onClick={() => setSubOpen(key, !open)}
                  aria-expanded={open}
                  className="flex w-full items-center justify-between gap-3 text-left"
                >
                  <div className="flex items-center gap-2">
                    <h2 className="font-display text-xl font-semibold sm:text-2xl">{t(`denominations.${dk}`)}</h2>
                    <span className="inline-flex items-center rounded-full border border-border bg-background px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {items.length}
                    </span>
                  </div>
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition ${open ? "rotate-180 bg-accent text-foreground" : ""}`}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </span>
                </button>
                {open && (
                  <div className="mt-4 space-y-2">
                    {items.map((c) => {
                      return (
                        <details
                          key={`${dk}-${c.author}`}
                          className="group rounded-xl border border-border bg-background/60 [&_summary::-webkit-details-marker]:hidden"
                        >
                          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
                            <AuthorThumbnail name={c.author} size={40} />
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                                <h4 className="font-display truncate text-base font-semibold">{c.author}</h4>
                                <CountryLabel code={authorCountry.get(c.author)} />
                              </div>
                              <p className="mt-0.5 text-xs font-medium text-muted-foreground">{c.era}</p>
                            </div>
                            <CopyCardButton
                              author={c.author}
                              country={resolveCountryName(authorCountry.get(c.author)) ?? c.country}
                              era={c.era}
                              summary={c.summary}
                              keyInsight={c.keyInsight}
                              verseRef={data.verseReference}
                            />
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition group-open:rotate-180 group-open:bg-accent group-open:text-foreground">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="6 9 12 15 18 9" />
                              </svg>
                            </span>
                          </summary>
                          <div className="border-t border-border px-4 py-4">
                            <p className="text-base leading-relaxed text-foreground/80">{c.summary}</p>
                            {c.keyInsight && (
                              <p className="mt-3 border-t border-border pt-3 text-sm italic leading-relaxed text-muted-foreground">
                                <span className="not-italic font-semibold text-foreground/70">{t("results.keyInsight")} · </span>
                                {c.keyInsight}
                              </p>
                            )}
                          </div>
                        </details>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
          </div>
        </div>
      )}


      {/* All voices are available to every user — no gating on modern voices. */}



      <div className="-mt-6">
        <OriginalSources
          reference={data.verseReference}
          authors={allSourced.map((c) => c.author)}
        />
      </div>


      <NewsletterFooter user={user} seed={data.verseReference} />

      <p className="mt-10 border-t border-border pt-6 text-xs leading-relaxed text-muted-foreground">
        {(() => {
          const tmpl = t("sourcesDisclaimer");
          const parts = tmpl.split("{link}");
          return (
            <>
              {parts[0]}
              <Link
                to="/copyright"
                className="underline decoration-muted-foreground/40 underline-offset-4 hover:text-foreground"
              >
                {t("sourcesLinkLabel")}
              </Link>
              {parts[1] ?? ""}
            </>
          );
        })()}
      </p>
    </div>
  );
}

function GroupBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-border bg-background/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
      {label}
    </span>
  );
}

function CountryLabel({ code }: { code?: string | null }) {
  if (!code) return null;
  // `authorCountry` already stores the resolved display name (either from the
  // curated ISO-code map or directly from the AI payload), so render as-is.
  const name = code;
  return (
    <span className="text-xs font-normal text-muted-foreground/80" title={name}>
      · {name}
    </span>
  );
}

function RegionalPill() {
  return (
    <span
      title="From a region you selected"
      className="inline-flex items-center rounded-full border border-primary/40 bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary"
    >
      Your region
    </span>
  );
}

function ModernBadge() {
  const { t } = useLanguage();
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/5 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
      <Sparkles className="h-2.5 w-2.5" /> {t("results.contemporaryBadge")}
    </span>
  );
}

function CopyButton({ text, className }: { text: string; className?: string }) {
  const { t } = useLanguage();
  const [copied, setCopied] = useState(false);
  const onCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };
  return (
    <button
      type="button"
      onClick={onCopy}
      aria-label={copied ? t("home.copied") : t("home.copyAria")}
      title={copied ? t("home.copied") : t("home.copy")}
      className={`inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground transition hover:bg-accent hover:text-foreground ${className ?? ""}`}
    >
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5 text-agree" /> {t("home.copied")}
        </>
      ) : (
        <>
          <Copy className="h-3.5 w-3.5" /> {t("home.copy")}
        </>
      )}
    </button>
  );
}

function SectionHeading({
  icon,
  label,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  tone?: "agree" | "slight" | "strong";
}) {
  const toneClass =
    tone === "agree"
      ? "border-agree text-agree"
      : tone === "slight"
        ? "border-slight-diff text-slight-diff"
        : tone === "strong"
          ? "border-strong-diff text-strong-diff"
          : "border-border text-foreground";
  return (
    <div className="flex items-center gap-3">
      <h2
        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-semibold ${toneClass}`}
      >
        {icon}
        {label}
      </h2>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

function WorldviewSection({
  title,
  children,
  empty,
  emptyLabel,
  tint,
  reference,
  loading,
  open,
  onOpenChange,
  worldviewKey,
}: {
  title: string;
  children: React.ReactNode;
  empty: boolean;
  emptyLabel: string;
  tint?: string;
  reference?: string;
  loading?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  worldviewKey?: Worldview;
}) {
  const { t } = useLanguage();
  const [infoOpen, setInfoOpen] = useState(false);
  const display = children;

  const descKey =
    worldviewKey === "guilt-innocence"
      ? "worldview.descGuiltInnocence"
      : worldviewKey === "shame-honour"
        ? "worldview.descShameHonour"
        : worldviewKey === "fear-power"
          ? "worldview.descFearPower"
          : null;

  return (
    <details
      open={open}
      onToggle={(e) => {
        if (e.target !== e.currentTarget) return;
        const nextOpen = (e.currentTarget as HTMLDetailsElement).open;
        onOpenChange?.(nextOpen);
      }}
      className="group rounded-3xl border border-border transition [&_summary::-webkit-details-marker]:hidden"
    >
      <summary
        className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-3xl bg-card px-5 py-5 sm:px-7 sm:py-6 group-open:rounded-b-none"
      >
        <div className="min-w-0">
          <h2 className="font-display text-2xl font-semibold sm:text-3xl">{title}</h2>
          {reference && <p className="mt-0.5 text-xs font-medium text-foreground/60 sm:text-sm">{reference} {t("worldview.subtitleSuffix")}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {descKey && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                // If the section itself is fully collapsed, expand it one level
                // (open the details) AND reveal the description, so the user
                // sees the info immediately without manually opening the section.
                if (!open) {
                  onOpenChange?.(true);
                  setInfoOpen(true);
                  return;
                }
                setInfoOpen((v) => !v);
              }}
              aria-expanded={infoOpen}
              aria-label={t("worldview.infoAriaLabel", { name: title })}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background/60 text-muted-foreground transition hover:bg-accent hover:text-foreground data-[active=true]:bg-accent data-[active=true]:text-foreground"
              data-active={infoOpen}
            >
              <Info className="h-4 w-4" />
            </button>
          )}
          <span className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background/60 text-muted-foreground transition group-open:rotate-180 group-open:bg-accent group-open:text-foreground">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </span>
        </div>
      </summary>
      {descKey && (
        <div
          role="region"
          aria-live="polite"
          aria-label={
            infoOpen
              ? t("worldview.infoExpanded", { name: title })
              : t("worldview.infoCollapsed", { name: title })
          }
          className={`grid overflow-hidden border-t border-border bg-background/40 transition-[grid-template-rows] duration-300 ease-in-out ${
            infoOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
          }`}
        >
          <div className="min-h-0 overflow-hidden">
            <p className="px-5 py-4 text-sm leading-relaxed text-foreground/80 sm:px-7 sm:text-base">
              {t(descKey)}
            </p>
          </div>
        </div>
      )}
      <div className="space-y-5 border-t border-border bg-card px-5 py-5 sm:px-7 sm:py-6">
        {empty ? (
          loading ? (
            <div className="flex items-start gap-3 text-sm text-muted-foreground">
              <span className="mt-1 inline-block h-3 w-3 shrink-0 animate-pulse rounded-full bg-primary/60" />
              <p>{t("worldview.loading")}</p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{emptyLabel}</p>
          )
        ) : (
          display
        )}
      </div>
    </details>
  );
}

function ContrastGroup({
  tone,
  icon,
  label,
  cards,
  open,
  onOpenChange,
}: {
  tone: "agree" | "slight" | "strong";
  icon: React.ReactNode;
  label: string;
  cards: { key: string; title: string; body: React.ReactNode; copyNode?: React.ReactNode }[];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  if (cards.length === 0) return null;
  const headerClass =
    tone === "agree"
      ? "border-agree/60 bg-agree/10"
      : tone === "slight"
        ? "border-slight-diff/60 bg-slight-diff/10"
        : "border-strong-diff/60 bg-strong-diff/10";
  const iconBgClass =
    tone === "agree"
      ? "bg-agree/20 text-agree"
      : tone === "slight"
        ? "bg-slight-diff/20 text-slight-diff"
        : "bg-strong-diff/20 text-strong-diff";
  const titleColor =
    tone === "agree"
      ? "text-agree"
      : tone === "slight"
        ? "text-slight-diff"
        : "text-strong-diff";
  return (
    <details
      open={open}
      onToggle={(e) => {
        if (e.target !== e.currentTarget) return;
        onOpenChange?.((e.currentTarget as HTMLDetailsElement).open);
      }}
      className="group/contrast [&_summary::-webkit-details-marker]:hidden"
    >
      <summary className={`flex cursor-pointer list-none items-center gap-3 rounded-2xl border-2 ${headerClass} px-4 py-3 sm:px-5 sm:py-4`}>
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${iconBgClass}`}>
          {icon}
        </span>
        <h3 className={`flex-1 font-display text-lg font-bold sm:text-xl ${titleColor}`}>
          {label}
        </h3>
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${iconBgClass} transition group-open/contrast:rotate-180`}>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
      </summary>
      <div className="mt-3 space-y-3 px-1">
        {cards.slice(0, 6).map((card) => (
          <details
            key={card.key}
            className="group/card rounded-2xl border border-border bg-card [&_summary::-webkit-details-marker]:hidden"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4">
              <h4 className="font-display text-base font-semibold sm:text-lg">{card.title}</h4>
              <div className="flex items-center gap-2">
                {card.copyNode}
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition group-open/card:rotate-180 group-open/card:bg-accent group-open/card:text-foreground">
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </span>
              </div>
            </summary>
            <div className="border-t border-border px-5 py-5">{card.body}</div>
          </details>
        ))}
      </div>
    </details>
  );
}

function CopyAllAgreeButton({
  points,
  verseRef,
  className,
}: {
  points: string[];
  verseRef?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const t = useT();
  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (points.length === 0) return;
    const lines: string[] = [];
    if (verseRef) lines.push(`📖 ${verseRef}`);
    points.forEach((text) => {
      lines.push("", text);
    });
    const payload = lines.join("\n") + "\n\n— via VerseSmart";
    try {
      await navigator.clipboard.writeText(payload);
      setCopied(true);
      toast(t("toasts.copiedToClipboard"));
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };
  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={t("copy.allAgree")}
      title={t("copy.allAgree")}
      className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition hover:bg-accent hover:text-foreground ${className ?? ""}`}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-agree" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}


function CopyAllBlockButton({
  verseRef,
  voices,
  className,
}: {
  verseRef?: string;
  voices: { author: string; country?: string | null; era?: string | null; summary: string }[];
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const t = useT();
  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (voices.length === 0) return;
    const lines: string[] = [];
    if (verseRef) lines.push(`📖 ${verseRef}`);
    voices.forEach((v) => {
      lines.push("");
      lines.push(`✍️ ${v.author}`);
      if (v.era) lines.push(`🗓 ${v.era}`);
      if (v.country) lines.push(`🌍 ${v.country}`);
      lines.push("", v.summary);
    });
    const payload = lines.join("\n") + "\n\n— via VerseSmart";
    try {
      await navigator.clipboard.writeText(payload);
      setCopied(true);
      toast(t("toasts.copiedToClipboard"));
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };
  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={t("copy.allSummaries")}
      title={t("copy.allSummaries")}

      className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition hover:bg-accent hover:text-foreground ${className ?? ""}`}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-agree" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

function AgreeGroup({
  icon,
  label,
  points,
  allVoicesLabel,
  verseRef,
  open,
  onOpenChange,
}: {
  icon: React.ReactNode;
  label: string;
  points: string[];
  allVoicesLabel: string;
  verseRef?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  if (points.length === 0) return null;
  return (
    <details
      open={open}
      onToggle={(e) => {
        if (e.target !== e.currentTarget) return;
        onOpenChange?.((e.currentTarget as HTMLDetailsElement).open);
      }}
      className="group/contrast [&_summary::-webkit-details-marker]:hidden"
    >
      <summary className="flex cursor-pointer list-none items-center gap-3 rounded-2xl border-2 border-agree/60 bg-agree/10 px-4 py-3 sm:px-5 sm:py-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-agree/20 text-agree">
          {icon}
        </span>
        <h3 className="flex-1 font-display text-lg font-bold text-agree sm:text-xl">
          {label}
        </h3>
        <CopyAllAgreeButton points={points} verseRef={verseRef} />
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-agree/20 text-agree transition group-open/contrast:rotate-180">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
      </summary>
      <div className="mt-3 grid gap-4 px-1 sm:grid-cols-2">
        {points.map((text, i) => (
          <div key={i} className="flex gap-3 rounded-2xl border border-border bg-card px-5 py-4">
            <span className="mt-2 h-1.5 w-6 shrink-0 rounded-full bg-agree" />
            <div className="min-w-0 flex-1">
              <span className="inline-flex items-center rounded-full border border-border bg-muted/40 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {allVoicesLabel}
              </span>
              <p className="mt-2 text-base leading-relaxed">{text}</p>
            </div>
          </div>
        ))}
      </div>
    </details>
  );
}

function HowItWorksToggle() {
  const honour = useHonourSpelling();
  const { t } = useLanguage();
  return (
    <details className="group/hiw mb-4 inline-block w-auto max-w-2xl rounded-2xl border border-border bg-card/60 text-left [&[open]]:block [&[open]]:w-full [&_summary::-webkit-details-marker]:hidden">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-1.5 text-sm font-semibold text-foreground transition hover:bg-accent/40 rounded-2xl group-open/hiw:rounded-b-none group-open/hiw:px-4 group-open/hiw:py-2.5">
        <span className="flex h-6 w-6 items-center justify-center rounded-full border border-border text-[12px] font-semibold">
          i
        </span>
        {t("howItWorks.toggle")}
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="ml-auto transition group-open/hiw:rotate-180"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </summary>
      <div className="animate-fade-in space-y-4 border-t border-border px-5 py-4 text-base leading-relaxed">
        <p>{t("howItWorks.intro")}</p>
        <div>
          <p className="font-semibold text-foreground">{t("howItWorks.forEachVerse")}</p>
          <ul className="mt-1.5 list-disc space-y-1 pl-5 text-muted-foreground">
            <li>{t("howItWorks.bullet1")}</li>
            <li>{t("howItWorks.bullet2")}</li>
            <li>
              {t("howItWorks.bullet3_pre")}{" "}
              <span className="inline-block rounded bg-agree/20 px-1.5 py-0.5 font-medium text-foreground">
                {t("howItWorks.labelAgree")}
              </span>
              ,{" "}
              <span className="inline-block rounded bg-slight-diff/20 px-1.5 py-0.5 font-medium text-foreground">
                {t("howItWorks.labelDiffer")}
              </span>
              ,{" "}
              <span className="inline-block rounded bg-strong-diff/20 px-1.5 py-0.5 font-medium text-foreground">
                {t("howItWorks.labelDisagree")}
              </span>
            </li>
            <li>{t("howItWorks.bullet4")}</li>
            <li>{t("howItWorks.bullet5")}</li>
            <li>{t("howItWorks.bullet6")}</li>
          </ul>
        </div>
        <div>
          <p className="font-semibold text-foreground">{t("howItWorks.tabsHeading")}</p>
          <ul className="mt-1.5 list-disc space-y-1 pl-5 text-muted-foreground">
            <li><span className="font-semibold text-foreground">{t("howItWorks.tabAuthor")}</span> — {t("howItWorks.tabAuthorDesc")}</li>
            <li><span className="font-semibold text-foreground">{t("howItWorks.tabWorldview")}</span> — {t("howItWorks.tabWorldviewDesc", { honour })}</li>
            <li><span className="font-semibold text-foreground">{t("howItWorks.tabRegion")}</span> — {t("howItWorks.tabRegionDesc")}</li>
            <li><span className="font-semibold text-foreground">{t("howItWorks.tabTradition")}</span> — {t("howItWorks.tabTraditionDesc")}</li>
            <li><span className="font-semibold text-foreground">{t("howItWorks.tabDenomination")}</span> — {t("howItWorks.tabDenominationDesc")}</li>
          </ul>
        </div>
        <div>
          <p className="font-semibold text-foreground">{t("howItWorks.coloursHelp")}</p>
          <div className="mt-1.5 space-y-1 text-muted-foreground">
            <p>
              <span className="font-semibold text-agree">{t("howItWorks.green")}</span>{" "}
              <span>{t("howItWorks.greenDesc")}</span>
            </p>
            <p>
              <span className="font-semibold text-slight-diff">{t("howItWorks.orange")}</span>{" "}
              <span>{t("howItWorks.orangeDesc")}</span>
            </p>
            <p>
              <span className="font-semibold text-strong-diff">{t("howItWorks.red")}</span>{" "}
              <span>{t("howItWorks.redDesc")}</span>
            </p>
          </div>
        </div>
        <p className="text-muted-foreground">{t("howItWorks.closing")}</p>
      </div>
    </details>
  );
}

function WhyChooseToggle() {
  const { t } = useLanguage();
  return (
    <details className="group/wc mb-4 inline-block w-auto max-w-2xl rounded-2xl border border-border bg-card/60 text-left [&[open]]:block [&[open]]:w-full [&_summary::-webkit-details-marker]:hidden">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-1.5 text-sm font-semibold text-foreground transition hover:bg-accent/40 rounded-2xl group-open/wc:rounded-b-none group-open/wc:px-4 group-open/wc:py-2.5">
        <span className="flex h-6 w-6 items-center justify-center rounded-full border border-border text-[12px] font-semibold">
          i
        </span>
        {t("whyChoose.toggle")}
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="ml-auto transition group-open/wc:rotate-180"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </summary>
      <div className="animate-fade-in border-t border-border px-5 py-4 text-base leading-relaxed space-y-3">
        <p className="text-muted-foreground">{t("whyChoose.body1")}</p>
        <p className="text-muted-foreground">{t("whyChoose.body2")}</p>
        <p className="text-muted-foreground">{t("whyChoose.body3")}</p>
      </div>
    </details>
  );
}

function MobileInfoButton() {
  const { t } = useLanguage();
  const honour = useHonourSpelling();
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label={t("howItWorks.toggle")}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-foreground transition hover:bg-accent"
        >
          <Info className="h-4 w-4" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] w-[calc(100vw-2rem)] max-w-lg overflow-y-auto rounded-2xl p-0">
        <DialogTitle className="sr-only">{t("howItWorks.toggle")}</DialogTitle>
        <div className="space-y-6 px-5 py-5">
          <section className="space-y-4 text-base leading-relaxed">
            <h2 className="text-base font-semibold text-foreground">{t("howItWorks.toggle")}</h2>
            <p>{t("howItWorks.intro")}</p>
            <div>
              <p className="font-semibold text-foreground">{t("howItWorks.forEachVerse")}</p>
              <ul className="mt-1.5 list-disc space-y-1 pl-5 text-muted-foreground">
                <li>{t("howItWorks.bullet1")}</li>
                <li>{t("howItWorks.bullet2")}</li>
                <li>
                  {t("howItWorks.bullet3_pre")}{" "}
                  <span className="inline-block rounded bg-agree/20 px-1.5 py-0.5 font-medium text-foreground">{t("howItWorks.labelAgree")}</span>,{" "}
                  <span className="inline-block rounded bg-slight-diff/20 px-1.5 py-0.5 font-medium text-foreground">{t("howItWorks.labelDiffer")}</span>,{" "}
                  <span className="inline-block rounded bg-strong-diff/20 px-1.5 py-0.5 font-medium text-foreground">{t("howItWorks.labelDisagree")}</span>
                </li>
                <li>{t("howItWorks.bullet4")}</li>
                <li>{t("howItWorks.bullet5")}</li>
                <li>{t("howItWorks.bullet6")}</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-foreground">{t("howItWorks.tabsHeading")}</p>
              <ul className="mt-1.5 list-disc space-y-1 pl-5 text-muted-foreground">
                <li><span className="font-semibold text-foreground">{t("howItWorks.tabAuthor")}</span> — {t("howItWorks.tabAuthorDesc")}</li>
                <li><span className="font-semibold text-foreground">{t("howItWorks.tabWorldview")}</span> — {t("howItWorks.tabWorldviewDesc", { honour })}</li>
                <li><span className="font-semibold text-foreground">{t("howItWorks.tabRegion")}</span> — {t("howItWorks.tabRegionDesc")}</li>
                <li><span className="font-semibold text-foreground">{t("howItWorks.tabTradition")}</span> — {t("howItWorks.tabTraditionDesc")}</li>
                <li><span className="font-semibold text-foreground">{t("howItWorks.tabDenomination")}</span> — {t("howItWorks.tabDenominationDesc")}</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-foreground">{t("howItWorks.coloursHelp")}</p>
              <div className="mt-1.5 space-y-1 text-muted-foreground">
                <p>
                  <span className="font-semibold text-agree">{t("howItWorks.green")}</span>{" "}
                  <span>{t("howItWorks.greenDesc")}</span>
                </p>
                <p>
                  <span className="font-semibold text-slight-diff">{t("howItWorks.orange")}</span>{" "}
                  <span>{t("howItWorks.orangeDesc")}</span>
                </p>
                <p>
                  <span className="font-semibold text-strong-diff">{t("howItWorks.red")}</span>{" "}
                  <span>{t("howItWorks.redDesc")}</span>
                </p>
              </div>
            </div>
            <p className="text-muted-foreground">{t("howItWorks.closing")}</p>
          </section>
          <section className="space-y-3 border-t border-border pt-5 text-base leading-relaxed">
            <h2 className="text-base font-semibold text-foreground">{t("whyChoose.toggle")}</h2>
            <p className="text-muted-foreground">{t("whyChoose.body1")}</p>
            <p className="text-muted-foreground">{t("whyChoose.body2")}</p>
            <p className="text-muted-foreground">{t("whyChoose.body3")}</p>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RecoveryModal({
  kind,
  tier,
  userSelection,
  onClose,
  onApplySelection,
  onResetToAuto,
  onChangePassage,
}: {
  kind: "overload" | "insufficient";
  tier: import("@/lib/tiers").Tier;
  userSelection: string[];
  onClose: () => void;
  onApplySelection: (names: string[]) => void;
  onResetToAuto: () => void;
  onChangePassage: () => void;
}) {
  const isOverload = kind === "overload";
  const title = isOverload
    ? "We couldn’t complete your comparison"
    : "Not enough commentary available";
  const message = isOverload
    ? "Your selected commentators may be too many or too detailed for this verse. What would you like to do?"
    : "We couldn’t find enough commentary from your selected authors to create a balanced comparison. What would you like to do?";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-3xl bg-background text-foreground p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-display text-xl font-semibold text-foreground">{title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>

        <div className="mt-5 flex flex-col gap-2">
          <div className="flex justify-center">
            <CommentatorCompareControl
              tier={tier}
              currentlyDisplayed={userSelection}
              onApply={onApplySelection}
              label={isOverload ? "Reduce selection" : "Add more commentators"}
            />
          </div>

          {isOverload ? (
            <button
              type="button"
              onClick={onResetToAuto}
              className="rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Let VerseSmart adjust
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={onChangePassage}
                className="rounded-xl border border-border px-4 py-3 text-sm font-medium hover:bg-accent"
              >
                Try a different passage
              </button>
              <button
                type="button"
                onClick={onResetToAuto}
                className="rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
              >
                Reset to VerseSmart’s recommended voices
              </button>
            </>
          )}

          <button
            type="button"
            onClick={onClose}
            className="mt-1 rounded-xl px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

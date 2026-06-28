
import { useServerFn } from "@tanstack/react-start";
import { useQueries, useQuery } from "@tanstack/react-query";
import { BookOpen, GitCompare, Sparkles, Loader2, Lock } from "lucide-react";
import {
  compareHistoricalCommentaries,
  HISTORICAL_GROUPS,
  type HistoricalCommentaryResult,
  type HistoricalGroupKey,
} from "@/lib/historical-commentary.functions";
import { listDeletedCommentators } from "@/lib/commentator-overrides.functions";
import { normalizeName } from "@/lib/commentator-metadata";
import { getPaddleEnvironment } from "@/lib/paddle";
import { AuthorThumbnail } from "@/components/AuthorThumbnail";
import { CopyCardButton } from "@/components/CopyCardButton";

const GROUP_KEYS: HistoricalGroupKey[] = ["foundational", "fathers", "reformation"];

export function useHistoricalGroups({
  reference,
  translation,
  enabled,
  language = "en",
}: {
  reference: string;
  translation: string;
  enabled: boolean;
  language?: "en" | "es" | "fr" | "de" | "zh-Hans" | "zh-Hant" | "hi" | "ar";
}) {
  const fetchFn = useServerFn(compareHistoricalCommentaries);
  return useQueries({
    queries: GROUP_KEYS.map((group) => ({
      queryKey: ["historical-commentary", group, reference, translation, language],
      queryFn: () =>
        fetchFn({
          data: {
            reference,
            group,
            translation: translation as any,
            environment: getPaddleEnvironment(),
            language,
          },
        }),
      enabled: enabled && !!reference,
      staleTime: 1000 * 60 * 30,
    })),
  });
}

export function HistoricalGroupSection({ data }: { data: HistoricalCommentaryResult }) {
  const meta = HISTORICAL_GROUPS[data.group];
  const slight = data.contrasts.filter((c) => c.severity === "slight");
  const strong = data.contrasts.filter((c) => c.severity === "strong");
  const authorEra = new Map(data.commentaries.map((c) => [c.author, c.era]));
  const cleanEra = (era?: string) => era?.replace(/^c\.\s*/i, "") ?? "";

  return (
    <section className="rounded-3xl border border-border bg-card/40 p-5 sm:p-7">
      <header className="border-b border-border pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-display text-xl font-semibold sm:text-2xl">{meta.label}</h2>
          <span className="rounded-full border border-border bg-background px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Group
          </span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{meta.blurb}</p>
      </header>

      {data.commonGround.length > 0 && (
        <div className="mt-5">
          <Pill icon={<Sparkles className="h-3.5 w-3.5 text-agree" />} tone="agree">
            They agree
          </Pill>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {data.commonGround.map((p, i) => (
              <li key={i} className="flex gap-2 rounded-xl border border-border bg-card p-3 text-sm">
                <span className="mt-1.5 h-1.5 w-4 shrink-0 rounded-full bg-agree" />
                <span className="leading-relaxed">{p}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {(slight.length > 0 || strong.length > 0) && (
        <div className="mt-5 space-y-4">
          {slight.length > 0 && (
            <ContrastBlock title="They differ" tone="slight" items={slight} authorEra={authorEra} />
          )}
          {strong.length > 0 && (
            <ContrastBlock title="They disagree" tone="strong" items={strong} authorEra={authorEra} />
          )}
        </div>
      )}

      <div className="mt-5">
        <Pill icon={<BookOpen className="h-3.5 w-3.5" />}>The theologians</Pill>
        <div className="mt-3 space-y-2">
          {data.commentaries.map((c) => (
            <details
              key={c.author}
              className="group rounded-xl border border-border bg-card [&_summary::-webkit-details-marker]:hidden"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4">
                <AuthorThumbnail name={c.author} size={40} />
                <div className="min-w-0 flex-1">
                  <h3 className="font-display truncate text-base font-semibold">{c.author}</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {c.era}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <CopyCardButton
                    author={c.author}
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
                </div>
              </summary>
              <div className="border-t border-border px-4 py-3 text-sm">
                <p className="leading-relaxed text-foreground/80">{c.summary}</p>
                <p className="mt-3 border-t border-border pt-2 text-xs italic leading-relaxed text-muted-foreground">
                  <span className="not-italic font-semibold text-foreground/70">Key insight · </span>
                  {c.keyInsight}
                </p>
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function ContrastBlock({
  title,
  tone,
  items,
  authorEra,
}: {
  title: string;
  tone: "slight" | "strong";
  items: { topic: string; positions: { author: string; view: string }[] }[];
  authorEra: Map<string, string>;
}) {
  const border = tone === "slight" ? "border-slight-diff" : "border-strong-diff";
  const bg = tone === "slight" ? "bg-slight-diff/5" : "bg-strong-diff/5";
  const text = tone === "slight" ? "text-slight-diff" : "text-strong-diff";
  const cleanEra = (era?: string) => era?.replace(/^c\.\s*/i, "") ?? "";
  return (
    <div>
      <Pill
        icon={<GitCompare className={`h-3.5 w-3.5 ${text}`} />}
        tone={tone}
      >
        {title}
      </Pill>
      <div className="mt-3 space-y-3">
        {items.map((c, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-4">
            <h4 className="font-display text-base font-semibold">{c.topic}</h4>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {c.positions.map((p, j) => (
                <div key={j} className={`rounded-lg border-l-[3px] ${border} ${bg} p-3`}>
                  <div className={`text-xs font-semibold ${text}`}>{p.author}</div>
                  {authorEra.get(p.author) && (
                    <div className="text-[10px] text-muted-foreground">{cleanEra(authorEra.get(p.author)!)}</div>
                  )}
                  <p className="mt-1 text-sm leading-relaxed">{p.view}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Pill({
  icon,
  tone,
  children,
}: {
  icon: React.ReactNode;
  tone?: "agree" | "slight" | "strong";
  children: React.ReactNode;
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
    <h3 className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${toneClass}`}>
      {icon}
      {children}
    </h3>
  );
}

export function HistoricalAnonymousTeaser() {
  const fetchDeleted = useServerFn(listDeletedCommentators);
  const { data: deleted } = useQuery({
    queryKey: ["commentator-deleted"],
    queryFn: () => fetchDeleted(),
    staleTime: 60_000,
  });
  const deletedSet = new Set(deleted ?? []);
  return (
    <section className="rounded-3xl border border-border bg-card p-6 sm:p-8">
      <div className="flex flex-col items-center text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
          <Lock className="h-6 w-6 text-primary" />
        </div>
        <div className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-xs font-semibold text-primary">
          <Sparkles className="h-3.5 w-3.5" /> Free with sign‑up
        </div>
        <h3 className="font-display mt-3 text-2xl font-semibold">
          Unlock 3 more groups of theologians — free
        </h3>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground sm:text-base">
          Create a free account to compare how the <strong>Foundational Theologians</strong>,
          <strong> Historic Church Fathers</strong>, and <strong>Reformation Voices</strong> read this
          same passage — alongside the classic commentators above.
        </p>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {GROUP_KEYS.map((key) => {
          const g = HISTORICAL_GROUPS[key];
          return (
            <div key={key} className="rounded-2xl border border-border bg-background/50 p-4">
              <h4 className="font-display text-sm font-semibold">{g.label}</h4>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {g.authors
                  .filter((a) => !deletedSet.has(normalizeName(a)))
                  .map((a) => (
                    <li
                      key={a}
                      className="rounded-full border border-border bg-card px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
                    >
                      {a}
                    </li>
                  ))}
              </ul>
            </div>
          );
        })}
      </div>

      <div className="mt-6 flex flex-col items-center gap-2">
        <Link
          to="/signup"
          className="inline-flex items-center justify-center rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          Sign up free — unlock all 4 groups
        </Link>
        <p className="text-xs text-muted-foreground">
          Paid plans add contemporary theologians (N. T. Wright, Keller, Piper, Moltmann…) — from $9.99/mo.
        </p>
      </div>
    </section>
  );
}

export function HistoricalVoices({
  reference,
  translation,
  enabled,
  bonusHistorical,
}: {
  reference: string;
  translation: string;
  enabled: boolean;
  bonusHistorical?: HistoricalCommentaryResult[] | null;
}) {
  const queries = useHistoricalGroups({ reference, translation, enabled: enabled && !bonusHistorical });

  const results: HistoricalCommentaryResult[] = bonusHistorical
    ? bonusHistorical
    : queries
        .map((q) => q.data)
        .filter((d): d is HistoricalCommentaryResult => !!d && !d.locked);

  const anyLoading = !bonusHistorical && queries.some((q) => q.isLoading);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h2 className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-sm font-semibold">
          <BookOpen className="h-4 w-4" />
          More theologians on this passage
        </h2>
        <span className="h-px flex-1 bg-border" />
      </div>

      {anyLoading && (
        <div className="rounded-2xl border border-dashed border-border bg-card/40 p-4 text-center text-sm text-muted-foreground">
          <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
          Bringing in Foundational, Patristic, and Reformation voices…
        </div>
      )}

      <div className="grid gap-6">
        {results.map((g) => (
          <HistoricalGroupSection key={g.group} data={g} />
        ))}
      </div>
    </div>
  );
}

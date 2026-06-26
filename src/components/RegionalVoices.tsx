import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueries, useQuery } from "@tanstack/react-query";
import { BookOpen, GitCompare, Globe, Loader2, Sparkles, X } from "lucide-react";
import {
  compareRegionalCommentaries,
  countryHasTheologians,
  countryName as resolveCountryName,
  REGIONAL_COUNTRIES,
  type RegionalCommentaryResult,
} from "@/lib/regional-commentary.functions";
import { getVisitorCountry } from "@/lib/geo.functions";
import { AuthorThumbnail } from "@/components/AuthorThumbnail";
import { CopyCardButton } from "@/components/CopyCardButton";
import type { LanguageCode } from "@/lib/languages";

function sessionKey(reference: string) {
  return `vs.regional.dismissed:${reference}`;
}

function dismissed(reference: string): boolean {
  try {
    return sessionStorage.getItem(sessionKey(reference)) === "1";
  } catch {
    return false;
  }
}

function setDismissed(reference: string) {
  try {
    sessionStorage.setItem(sessionKey(reference), "1");
  } catch {}
}

export function RegionalVoices({
  reference,
  translation,
  language,
  enabled,
}: {
  reference: string;
  translation: string;
  language: LanguageCode;
  enabled: boolean;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [promptDismissed, setPromptDismissedState] = useState<boolean>(() =>
    typeof window !== "undefined" ? dismissed(reference) : true,
  );
  const [showPicker, setShowPicker] = useState(false);

  // Reset prompt state when verse changes.
  useEffect(() => {
    setSelected([]);
    setPromptDismissedState(typeof window !== "undefined" ? dismissed(reference) : true);
    setShowPicker(false);
  }, [reference]);

  // Detect visitor country.
  const geoFn = useServerFn(getVisitorCountry);
  const geo = useQuery({
    queryKey: ["visitor-country"],
    queryFn: () => geoFn(),
    enabled,
    staleTime: 1000 * 60 * 60,
  });

  const detectedCode = geo.data?.country ?? null;
  const showAutoPrompt =
    enabled &&
    !promptDismissed &&
    !!detectedCode &&
    countryHasTheologians(detectedCode) &&
    !selected.includes(detectedCode.toUpperCase());

  const detectedName = detectedCode ? resolveCountryName(detectedCode) : "";

  // Fetch all selected countries in parallel.
  const fetchFn = useServerFn(compareRegionalCommentaries);
  const queries = useQueries({
    queries: selected.map((code) => ({
      queryKey: ["regional-commentary", reference, translation, language, code],
      queryFn: () =>
        fetchFn({
          data: {
            reference,
            countryCode: code,
            translation: translation as any,
            language,
          },
        }),
      enabled: enabled && !!reference,
      staleTime: 1000 * 60 * 30,
    })),
  });

  const results = queries
    .map((q) => q.data)
    .filter((d): d is RegionalCommentaryResult => !!d && !d.locked);
  const anyLoading = queries.some((q) => q.isLoading);

  const addCountry = (code: string) => {
    const upper = code.toUpperCase();
    setSelected((prev) => (prev.includes(upper) ? prev : [...prev, upper]));
  };

  const dismissPrompt = () => {
    setDismissed(reference);
    setPromptDismissedState(true);
  };

  const includeRegional = () => {
    if (detectedCode) addCountry(detectedCode);
    dismissPrompt();
  };

  if (!enabled) return null;

  return (
    <div className="space-y-6">
      {/* Auto prompt */}
      {showAutoPrompt && (
        <div className="relative rounded-2xl border border-primary/30 bg-primary/5 p-5">
          <button
            type="button"
            aria-label="Dismiss"
            onClick={dismissPrompt}
            className="absolute right-3 top-3 rounded-full p-1 text-muted-foreground hover:bg-background hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="flex items-start gap-3">
            <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Globe className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1 pr-6">
              <h3 className="font-display text-base font-semibold sm:text-lg">
                Voices from Your Region
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                We found theologians from {detectedName} who have written on themes related to this verse.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={includeRegional}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
                >
                  <Sparkles className="h-3.5 w-3.5" /> Include Regional Voices
                </button>
                <button
                  type="button"
                  onClick={dismissPrompt}
                  className="rounded-xl border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-accent"
                >
                  Not Now
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manual add control — always available */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-border bg-card/40 px-4 py-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Globe className="h-4 w-4" />
          <span>Explore regional theology from any country.</span>
        </div>
        <button
          type="button"
          onClick={() => setShowPicker((v) => !v)}
          className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold hover:bg-accent"
        >
          {showPicker ? "Close" : "Add Regional Voices"}
        </button>
      </div>

      {showPicker && (
        <CountryPicker
          excluded={selected}
          onPick={(code) => {
            addCountry(code);
            setShowPicker(false);
          }}
        />
      )}

      {anyLoading && (
        <div className="rounded-2xl border border-dashed border-border bg-card/40 p-4 text-center text-sm text-muted-foreground">
          <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
          Gathering regional voices…
        </div>
      )}

      <div className="grid gap-6">
        {results.map((g) =>
          g.commentaries.length === 0 ? (
            <EmptyRegional key={g.countryCode} data={g} />
          ) : (
            <RegionalGroupSection key={g.countryCode} data={g} reference={reference} />
          ),
        )}
      </div>
    </div>
  );
}

function CountryPicker({
  excluded,
  onPick,
}: {
  excluded: string[];
  onPick: (code: string) => void;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const all = REGIONAL_COUNTRIES.filter((c) => !excluded.includes(c.code));
    if (!q) return all;
    return all.filter(
      (c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q),
    );
  }, [query, excluded]);

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <input
        type="text"
        autoFocus
        placeholder="Search countries…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
      />
      <div className="mt-3 grid max-h-64 gap-1 overflow-y-auto sm:grid-cols-2">
        {filtered.map((c) => (
          <button
            key={c.code}
            type="button"
            onClick={() => onPick(c.code)}
            className="flex items-center justify-between rounded-lg border border-transparent px-3 py-2 text-left text-sm hover:border-border hover:bg-accent"
          >
            <span>{c.name}</span>
            <span className="text-xs text-muted-foreground">{c.code}</span>
          </button>
        ))}
        {filtered.length === 0 && (
          <p className="col-span-full px-2 py-4 text-center text-sm text-muted-foreground">
            No matches.
          </p>
        )}
      </div>
    </div>
  );
}

function EmptyRegional({ data }: { data: RegionalCommentaryResult }) {
  return (
    <section className="rounded-3xl border border-dashed border-border bg-card/40 p-5 text-sm text-muted-foreground sm:p-7">
      <h2 className="font-display text-lg font-semibold text-foreground">
        Regional Voices — {data.countryName}
      </h2>
      <p className="mt-1">
        We couldn't find well-attested regional theologians from {data.countryName} on this specific passage.
      </p>
    </section>
  );
}

function RegionalGroupSection({ data, reference }: { data: RegionalCommentaryResult; reference: string }) {
  const slight = data.contrasts.filter((c) => c.severity === "slight");
  const strong = data.contrasts.filter((c) => c.severity === "strong");
  const authorEra = new Map(data.commentaries.map((c) => [c.author, c.era]));
  const cleanEra = (era?: string) => era?.replace(/^c\.\s*/i, "") ?? "";

  return (
    <section className="rounded-3xl border border-border bg-card/40 p-5 sm:p-7">
      <header className="border-b border-border pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-display text-xl font-semibold sm:text-2xl">
            Regional Voices — {data.countryName}
          </h2>
          <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            <Globe className="h-3 w-3" /> Region
          </span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Theologians and commentators rooted in {data.countryName}.
        </p>
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
              className="group rounded-xl border border-border bg-card border-l-[3px] border-l-primary/30 [&_summary::-webkit-details-marker]:hidden"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4">
                <AuthorThumbnail name={c.author} size={40} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-display truncate text-base font-semibold">{c.author}</h3>
                    <span className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary/80">
                      <Globe className="h-2.5 w-2.5" /> Regional
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {c.era} · {c.tradition}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <CopyCardButton
                    author={c.author}
                    era={c.era}
                    country={data.countryName}
                    summary={c.summary}
                    keyInsight={c.keyInsight}
                    verseRef={reference}
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
      <Pill icon={<GitCompare className={`h-3.5 w-3.5 ${text}`} />} tone={tone}>
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
                    <div className="text-[10px] text-muted-foreground">
                      {cleanEra(authorEra.get(p.author)!)}
                    </div>
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
    <h3
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${toneClass}`}
    >
      {icon}
      {children}
    </h3>
  );
}

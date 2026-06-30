import { useEffect, useRef, useState } from "react";
import { ChevronDown, Sun } from "lucide-react";
import { useLanguage } from "@/lib/language-context";
import { loadVotdLocale, getCachedVotdSummaries } from "@/lib/votd-summaries";

const SUN_COLOR = "#F7D34A";

export function VerseOfTheDayBar({
  onPick,
  disabled,
}: {
  onPick: (ref: string) => void;
  disabled?: boolean;
}) {
  const { language, t } = useLanguage();

  // -----------------------------
  // 1. Replace TanStack useQuery + useServerFn
  // -----------------------------
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadVotd() {
      try {
        setLoading(true);
        const res = await fetch("/api/votd", { method: "GET" });
        if (!res.ok) throw new Error("Failed to load VOTD");

        const json = await res.json();
        if (!cancelled) setData(json);
      } catch (err) {
        console.error("VOTD fetch failed:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadVotd();
    return () => {
      cancelled = true;
    };
  }, []);

  // -----------------------------
  // 2. Locale loading (unchanged)
  // -----------------------------
  const [, setLocaleVersion] = useState(0);
  useEffect(() => {
    let cancelled = false;
    loadVotdLocale(language).then(() => {
      if (!cancelled) setLocaleVersion((v) => v + 1);
    });
    return () => {
      cancelled = true;
    };
  }, [language]);

  // -----------------------------
  // 3. Dropdown behaviour (unchanged)
  // -----------------------------
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const onDocClick = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // -----------------------------
  // 4. Guard: no VOTD available
  // -----------------------------
  if (loading || !data || !data.enabled || !("reference" in data)) return null;

  // -----------------------------
  // 5. Summaries (unchanged)
  // -----------------------------
  const dayOfYear = data.dayOfYear;
  const localized = getCachedVotdSummaries(language, dayOfYear);
  const summaries = localized ?? data.summaries;

  // -----------------------------
  // 6. UI (unchanged)
  // -----------------------------
  return (
    <div ref={containerRef} className="relative mx-auto mb-4 w-full max-w-3xl">
      <span
        aria-hidden
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 sm:left-4"
      >
        <span
          className="absolute inset-0 -m-2 rounded-full opacity-60 animate-votd-pulse"
          style={{
            background: `radial-gradient(circle, ${SUN_COLOR}66 0%, transparent 70%)`,
          }}
        />
      </span>

      <button
        type="button"
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
        aria-expanded={open}
        aria-controls="votd-dropdown"
        aria-label={`Verse of the Day: ${data.reference}`}
        className={`relative flex w-full items-start gap-2 overflow-hidden border border-border bg-card px-4 py-2 text-left text-xs sm:text-sm transition hover:bg-accent disabled:opacity-60 ${
          open ? "rounded-2xl" : "rounded-full"
        }`}
      >
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary md:text-xs">
          <Sun className="h-4 w-4 shrink-0" style={{ color: SUN_COLOR }} aria-hidden="true" />
          <span className="hidden md:inline">{t("home.votdHeading")}</span>
        </span>

        <span className="min-w-0 flex-1 text-muted-foreground">
          <span className={`block ${open ? "" : "truncate"}`}>
            <span className="font-semibold text-foreground">{data.reference}</span>
            <span aria-hidden> — </span>
            <span className="italic">&ldquo;{data.excerpt}&rdquo;</span>
          </span>
          <span className="block text-[10px] sm:text-[11px] text-muted-foreground/60 leading-tight">
            {t("home.votdTapHint")}
          </span>
        </span>

        <ChevronDown
          className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
            open ? "rotate-180" : ""
          }`}
          aria-hidden
        />
      </button>

      <div
        id="votd-dropdown"
        role="region"
        aria-hidden={!open}
        className={`grid transition-all duration-300 ease-out ${
          open ? "grid-rows-[1fr] opacity-100 mt-2" : "grid-rows-[0fr] opacity-0 mt-0"
        }`}
      >
        <div className="overflow-hidden">
          <div className="rounded-2xl border border-border bg-popover p-5 text-sm text-popover-foreground shadow-lg">
            <div className="space-y-5">
              <SummaryBlock
                label={t("worldview.guiltInnocence")}
                text={summaries.guiltInnocence}
              />
              <SummaryBlock
                label={t("worldview.shameHonour")}
                text={summaries.shameHonour}
              />
              <SummaryBlock
                label={t("worldview.fearPower")}
                text={summaries.fearPower}
              />
            </div>

            <div className="mt-5 flex justify-end border-t border-border pt-3">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onPick(data.reference);
                }}
                className="text-xs font-medium text-primary hover:underline"
              >
                Explore more →
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryBlock({ label, text }: { label: string; text: string }) {
  return (
    <div className="text-left">
      <p className="text-base font-bold text-foreground">{label}</p>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{text}</p>
    </div>
  );
}

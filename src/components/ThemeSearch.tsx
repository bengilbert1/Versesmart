import { useState } from "react";
import { Loader2, ChevronDown, ArrowRight, X } from "lucide-react";
import { useT } from "@/lib/language-context";
import { trackThemeSearch } from "@/lib/track-analytics";

type Props = {
  onPick: (reference: string) => void;
  disabled?: boolean;
};

export function ThemeSearch({ onPick, disabled }: Props) {
  const t = useT();

  const [query, setQuery] = useState("");
  const [openTheme, setOpenTheme] = useState<string | null>(null);

  // Replacing TanStack mutation
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<null | { themes: any[] }>(null);

  async function runSearch(q: string) {
    try {
      setLoading(true);
      setError(null);
      setData(null);

      // Replace this with your actual API route
      const res = await fetch("/api/theme-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q }),
      });

      if (!res.ok) throw new Error("Search failed");

      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(t("theme.error"));
    } finally {
      setLoading(false);
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed || loading) return;

    setOpenTheme(null);
    trackThemeSearch(trimmed);
    runSearch(trimmed);
  };

  return (
    <div>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("theme.placeholder")}
          disabled={disabled || loading}
          className="flex-1 rounded-xl border border-white/70 bg-white/70 px-4 py-3 text-base outline-none transition shadow-[0_4px_16px_-8px_rgba(47,72,88,0.18)] backdrop-blur focus:ring-2 focus:ring-ring disabled:opacity-50 placeholder:text-muted-foreground"
        />
        <button
          type="submit"
          disabled={disabled || loading || !query.trim()}
          className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              {t("theme.explore")} <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </form>

      {error && (
        <p className="mt-2 text-center text-xs text-destructive">{error}</p>
      )}

      {data && (
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              {data.themes.length}{" "}
              {data.themes.length === 1 ? t("theme.theme") : t("theme.themes")}
            </p>
            <button
              type="button"
              onClick={() => {
                setOpenTheme(null);
                setData(null);
              }}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-xs font-medium text-muted-foreground transition hover:bg-accent hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" /> {t("theme.hideSuggestions")}
            </button>
          </div>

          {data.themes.map((t) => {
            const active = openTheme === t.theme;
            return (
              <div key={t.theme} className="rounded-2xl border border-border bg-card overflow-hidden">
                <button
                  type="button"
                  onClick={() => setOpenTheme(active ? null : t.theme)}
                  className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left transition hover:bg-accent/40"
                >
                  <div className="min-w-0">
                    <div className="font-display text-base font-semibold">{t.theme}</div>
                    <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{t.blurb}</p>
                  </div>
                  <ChevronDown
                    className={`mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
                      active ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {active && (
                  <div className="grid gap-1.5 border-t border-border bg-background/40 p-2 sm:grid-cols-2">
                    {t.verses.map((v) => (
                      <button
                        key={v.reference}
                        type="button"
                        onClick={() => onPick(v.reference)}
                        className="group rounded-xl border border-border bg-card p-3 text-left transition hover:border-foreground/30 hover:bg-accent/40"
                      >
                        <span className="font-display text-sm font-semibold group-hover:underline">
                          {v.reference}
                        </span>
                        <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{v.blurb}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

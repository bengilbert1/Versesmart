import { useState } from "react";

import { Sparkle, Loader2 } from "lucide-react";
import { getRelatedVerses } from "@/lib/related-verses.functions";

type Props = {
  reference: string;
  translation: string;
  onPick: (reference: string) => void;
};

export function RelatedVerses({ reference, translation, onPick }: Props) {
  const fetchFn = useServerFn(getRelatedVerses);
  const [openTheme, setOpenTheme] = useState<string | null>(null);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["related-verses", reference, translation],
    queryFn: () => fetchFn({ data: { reference, translation } }),
    staleTime: 1000 * 60 * 60,
    retry: 1,
  });

  if (isError) return null;

  // Group related verses by theme, in the order themes appear.
  type Item = { reference: string; theme: string; blurb: string };
  const grouped: { theme: string; items: Item[] }[] = (() => {
    if (!data) return [];
    const map = new Map<string, Item[]>();
    for (const r of data.related) {
      if (!map.has(r.theme)) map.set(r.theme, []);
      map.get(r.theme)!.push(r);
    }
    const ordered: string[] = [];
    for (const t of data.themes) if (map.has(t) && !ordered.includes(t)) ordered.push(t);
    for (const t of map.keys()) if (!ordered.includes(t)) ordered.push(t);
    return ordered.slice(0, 3).map((theme) => ({ theme, items: map.get(theme)! }));
  })();

  return (
    <section className="mt-6">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Sparkle className="h-4 w-4" />
        <span>Explore related themes</span>
      </div>

      {isLoading && (
        <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Finding related themes…
        </div>
      )}

      {data && (
        <div className="mt-3 flex flex-wrap gap-2">
          {grouped.map(({ theme }) => {
            const active = openTheme === theme;
            return (
              <button
                key={theme}
                type="button"
                onClick={() => setOpenTheme(active ? null : theme)}
                className={`rounded-full border px-3 py-1 text-sm font-medium transition ${
                  active
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-card text-foreground hover:bg-accent"
                }`}
              >
                {theme}
              </button>
            );
          })}
        </div>
      )}

      {data && openTheme && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {grouped
            .find((g) => g.theme === openTheme)
            ?.items.map((r) => (
              <button
                key={r.reference}
                type="button"
                onClick={() => onPick(r.reference)}
                className="group rounded-xl border border-border bg-card p-3 text-left transition hover:border-foreground/30 hover:bg-accent/40"
              >
                <span className="font-display text-base font-semibold group-hover:underline">
                  {r.reference}
                </span>
                <p className="mt-1 text-sm leading-snug text-muted-foreground">
                  {r.blurb}
                </p>
              </button>
            ))}
        </div>
      )}
    </section>
  );
}

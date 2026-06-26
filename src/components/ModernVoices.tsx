import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Sparkles, Lock } from "lucide-react";
import { compareModernCommentaries } from "@/lib/modern-commentary.functions";
import { listDeletedCommentators } from "@/lib/commentator-overrides.functions";
import { normalizeName } from "@/lib/commentator-metadata";
import { getPaddleEnvironment } from "@/lib/paddle";

const MODERN_AUTHORS = [
  // Western
  "N. T. Wright",
  "John Stott",
  "J. I. Packer",
  "D. A. Carson",
  "Gordon Fee",
  "Tim Keller",
  "John Piper",
  "Walter Brueggemann",
  "Jürgen Moltmann",
  "Alister McGrath",
  "Derek Prince",
  // Africa
  "John Mbiti",
  "Byang Kato",
  "Mercy Amba Oduyoye",
  "Kwame Bediako",
  // Asia
  "Kosuke Koyama",
  "C. S. Song",
  "Ajith Fernando",
  // Latin America
  "Samuel Escobar",
  "René Padilla",
  "Orlando Costas",
  "Gustavo Gutiérrez",
  "Elsa Tamez",
];

export const MODERN_AUTHOR_SET = new Set(MODERN_AUTHORS);

export function useModernCommentaries({
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
  const fetchFn = useServerFn(compareModernCommentaries);
  return useQuery({
    queryKey: ["modern-commentary", reference, translation, language],
    queryFn: () =>
      fetchFn({
        data: { reference, translation: translation as any, environment: getPaddleEnvironment(), language },
      }),
    enabled: enabled && !!reference,
    staleTime: 1000 * 60 * 30,
  });
}

export function ModernVoicesLockedTeaser() {
  const fetchDeleted = useServerFn(listDeletedCommentators);
  const { data: deleted } = useQuery({
    queryKey: ["commentator-deleted"],
    queryFn: () => fetchDeleted(),
    staleTime: 60_000,
  });
  const deletedSet = new Set(deleted ?? []);
  const visible = MODERN_AUTHORS.filter((a) => !deletedSet.has(normalizeName(a)));
  return (
    <section>
      <div className="rounded-3xl border border-border bg-card p-6 sm:p-8">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
            <Lock className="h-6 w-6 text-primary" />
          </div>
          <div className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-xs font-semibold text-primary">
            <Sparkles className="h-3.5 w-3.5" /> Premium
          </div>
          <h3 className="font-display mt-3 text-2xl font-semibold">
            Add RECENT contemporary theologians to this comparison
          </h3>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground sm:text-base">
            Upgrade to weave contemporary theologians from around the world — N. T. Wright, Tim Keller, John Piper,
            Walter Brueggemann, Jürgen Moltmann, John Mbiti, Kwame Bediako, Mercy Amba Oduyoye, Kosuke Koyama,
            C. S. Song, Ajith Fernando, René Padilla, Gustavo Gutiérrez, Elsa Tamez and more — into the same
            agree / differ / disagree view above.
          </p>
        </div>

        <ul className="mt-6 flex flex-wrap justify-center gap-2">
          {visible.map((a) => (
            <li
              key={a}
              className="rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-muted-foreground"
            >
              {a}
            </li>
          ))}
        </ul>

        <div className="mt-6 flex justify-center">
          <Link
            to="/pricing"
            className="inline-flex items-center justify-center rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Unlock contemporary voices — Explorer plan from $9.99/mo
          </Link>
        </div>
      </div>
    </section>
  );
}

import { useQuery } from "@tanstack/react-query";
import { Sparkles, Lock } from "lucide-react";
import { compareModernCommentaries } from "@/lib/modern-commentary.functions";
import { listDeletedCommentators } from "@/lib/commentator-overrides.functions";
import { normalizeName } from "@/lib/commentator-metadata";
import { getPaddleEnvironment } from "@/lib/paddle";

const MODERN_AUTHORS = [
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
  "John Mbiti",
  "Byang Kato",
  "Mercy Amba Oduyoye",
  "Kwame Bediako",
  "Kosuke Koyama",
  "C. S. Song",
  "Ajith Fernando",
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
  return useQuery({
    queryKey: ["modern-commentary", reference, translation, language],
    queryFn: async () => {
      return compareModernCommentaries({
        reference,
        translation,
        environment: getPaddleEnvironment(),
        language,
      });
    },
    enabled: enabled && !!reference,
    staleTime: 1000 * 60 * 30,
  });
}

export function ModernVoicesLockedTeaser() {
  const { data: deleted } = useQuery({
    queryKey: ["commentator-deleted"],
    queryFn: async () => {
      return listDeletedCommentators();
    },
    staleTime: 60_000,
  });

  const deletedSet = new Set(deleted ?? []);
  const visible = MODERN_AUTHORS.filter(
    (a) => !deletedSet.has(normalizeName(a))
  );

  return (
    <section className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-b from-background to-muted/30 p-6">
      <div className="text-center">
        <div className="flex items-center justify-center gap-2 text-sm font-medium text-muted-foreground">
          <Lock className="h-4 w-4" />
          Premium
        </div>

        <h3 className="mt-2 text-xl font-semibold">
          Add RECENT contemporary theologians to this comparison
        </h3>

        <p className="mt-3 text-sm text-muted-foreground">
          Upgrade to weave contemporary theologians from around the world —
          N. T. Wright, Tim Keller, John Piper, Walter Brueggemann,
          Jürgen Moltmann, John Mbiti, Kwame Bediako, Mercy Amba Oduyoye,
          Kosuke Koyama, C. S. Song, Ajith Fernando, René Padilla,
          Gustavo Gutiérrez, Elsa Tamez and more — into the same agree /
          differ / disagree view above.
        </p>

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
          <a
            href="/pricing"
            className="inline-flex items-center justify-center rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Unlock contemporary voices — Explorer plan from $9.99/mo
          </a>
        </div>
      </div>
    </section>
  );
}
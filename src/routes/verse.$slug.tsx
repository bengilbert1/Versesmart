import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Sparkles, GitCompare, BookOpen, ArrowRight } from "lucide-react";
import { getPublicCommentary } from "@/lib/verse-page.functions";
import { referenceToSlug, slugToReference } from "@/lib/verse-slug";
import { AuthorThumbnail } from "@/components/AuthorThumbnail";
import { CopyCardButton } from "@/components/CopyCardButton";
import { NewsletterFooter } from "@/components/NewsletterFooter";
import { Skeleton } from "@/components/ui/skeleton";
import { highlightPosition } from "@/lib/highlight-contrasts";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/verse/$slug")({
  // Cached commentary changes rarely. Keep loader data fresh for 10 min on
  // active matches, and treat hover/focus prefetches as fresh for 5 min so
  // intent-based preloads don't re-fire on every link hover.
  staleTime: 10 * 60_000,
  preloadStaleTime: 5 * 60_000,
  gcTime: 30 * 60_000,
  loader: async ({ params }) => {
    const result = await getPublicCommentary({ data: { slug: params.slug, translation: "WEB" } });
    if (!result) throw notFound();
    return result as NonNullable<typeof result>;
  },
  head: ({ loaderData, params }) => {
    if (!loaderData) return { meta: [{ title: "Verse not found — VerseSmart" }] };
    const ref = loaderData.reference;
    const n = loaderData.commentary?.commentaries?.length ?? 5;
    const title = `${ref} Commentary — Compare ${n} Perspectives | VerseSmart`;
    const description = `Compare how Matthew Henry, Calvin, Spurgeon, Barnes and Wesley interpret ${ref} — side by side on VerseSmart.`;
    const url = `https://versesmart.org/verse/${params.slug}`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "article" },
        { property: "og:url", content: url },
        { property: "og:image", content: "https://versesmart.org/og-image.jpg" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
        { name: "twitter:image", content: "https://versesmart.org/og-image.jpg" },
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: (() => {
        const parsed = slugToReference(params.slug);
        const bibleVerse: Record<string, unknown> = {
          "@context": "https://schema.org",
          "@type": "BibleVerse",
          name: ref,
          text: loaderData.commentary.verseText,
          translation: loaderData.commentary.translation,
          url,
        };
        if (parsed?.book) bibleVerse.book = parsed.book;
        if (parsed?.chapter) bibleVerse.chapterNumber = parsed.chapter;
        if (parsed?.verse) bibleVerse.verseNumber = parsed.verse;
        const article = {
          "@context": "https://schema.org",
          "@type": "Article",
          headline: title,
          description,
          url,
          mainEntityOfPage: url,
          author: { "@type": "Organization", name: "VerseSmart" },
          publisher: { "@type": "Organization", name: "VerseSmart" },
          isPartOf: {
            "@type": "WebSite",
            name: "VerseSmart",
            url: "https://versesmart.org",
          },
        };
        const authors = loaderData.commentary.commentaries.map((c) => c.author);
        const authorList = authors.length
          ? authors.slice(0, -1).join(", ") + (authors.length > 1 ? `, and ${authors[authors.length - 1]}` : authors[0])
          : "leading public-domain Christian commentators";
        const firstCommentary = loaderData.commentary.commentaries[0];
        const meaningAnswer = firstCommentary
          ? `${ref} is explored side-by-side by ${authors.length} commentators on VerseSmart. ${firstCommentary.author}: ${firstCommentary.summary}`
          : `${ref} is explored side-by-side by leading commentators on VerseSmart.`;
        const contrastsAnswer = loaderData.commentary.contrasts.length
          ? `Commentators diverge on ${loaderData.commentary.contrasts.length} point${loaderData.commentary.contrasts.length === 1 ? "" : "s"} for ${ref}, including: ${loaderData.commentary.contrasts.map((c) => c.topic).slice(0, 3).join("; ")}.`
          : `For ${ref}, the included commentators largely agree, with only minor differences in emphasis.`;
        const faq = {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: [
            {
              "@type": "Question",
              name: `What does ${ref} mean?`,
              acceptedAnswer: { "@type": "Answer", text: meaningAnswer },
            },
            {
              "@type": "Question",
              name: "How do commentators differ on this verse?",
              acceptedAnswer: { "@type": "Answer", text: contrastsAnswer },
            },
            {
              "@type": "Question",
              name: "Which commentators does VerseSmart include?",
              acceptedAnswer: {
                "@type": "Answer",
                text: `VerseSmart compares ${authorList} side by side, drawing from their public-domain biblical commentaries.`,
              },
            },
          ],
        };
        return [
          { type: "application/ld+json", children: JSON.stringify(bibleVerse) },
          { type: "application/ld+json", children: JSON.stringify(article) },
          { type: "application/ld+json", children: JSON.stringify(faq) },
        ];
      })(),
    };
  },
  component: VersePage,
  // Show a skeleton ~immediately during client-side navigation so the page
  // never looks blank while the loader runs. SSR still hydrates with full
  // data — this only affects client navigations after a cache miss.
  pendingMs: 0,
  pendingMinMs: 300,
  pendingComponent: VersePageSkeleton,
  errorComponent: ({ error, reset }) => (
    <main className="mx-auto max-w-2xl px-5 py-20 text-center">
      <h1 className="font-display text-3xl font-semibold">Something went wrong</h1>
      <p className="mt-3 text-muted-foreground">{(error as Error)?.message ?? "Please try again."}</p>
      <button
        onClick={reset}
        className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
      >
        Try again
      </button>
    </main>
  ),
  notFoundComponent: () => (
    <main className="mx-auto max-w-2xl px-5 py-20 text-center">
      <h1 className="font-display text-3xl font-semibold">Verse not found</h1>
      <p className="mt-3 text-muted-foreground">
        We couldn't recognize that reference. Try the home page to pick a passage.
      </p>
      <Link to="/" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
        <BookOpen className="h-4 w-4" /> Browse verses
      </Link>
    </main>
  ),
});

function VersePage() {
  const data = Route.useLoaderData() as { commentary: import("@/lib/verse-page.functions").PublicCommentary; reference: string };
  const { commentary, reference } = data;
  const { user } = useAuth();
  const authorEra = new Map(commentary.commentaries.map((c) => [c.author, c.era]));
  const cleanEra = (era?: string) => era?.replace(/^c\.\s*/i, "") ?? "";
  const slightContrasts = commentary.contrasts.filter((c) => c.severity === "slight");
  const strongContrasts = commentary.contrasts.filter((c) => c.severity === "strong");
  const interactiveHref = `/?ref=${encodeURIComponent(reference)}`;

  return (
    <main className="bg-background text-foreground">
      <section className="mx-auto max-w-4xl px-5 pt-12 pb-8 sm:px-6">
        <p className="text-sm font-medium text-muted-foreground">
          <Link to="/" className="hover:text-foreground">Verse Smart</Link> · Commentary comparison
        </p>
        <h1 className="font-display mt-3 text-4xl leading-tight sm:text-5xl">
          {reference} Commentary
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          What do the great Christian commentators say about {reference}? Below is a side-by-side
          look at how Matthew Henry, John Calvin, Charles Spurgeon, Albert Barnes, and John Wesley
          read this passage — where they agree, where they diverge.
        </p>

        <div className="mt-6 rounded-3xl border border-border bg-card p-6 sm:p-8">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {reference} · {commentary.translation}
          </p>
          <blockquote className="font-display mt-3 text-xl leading-snug sm:text-2xl">
            &ldquo;{commentary.verseText}&rdquo;
          </blockquote>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            to="/"
            search={{ ref: reference }}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Compare interactively <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>


      <section className="mx-auto max-w-4xl px-5 pb-10 sm:px-6">
        {commentary.commonGround.length > 0 && (
          <div className="mt-4">
            <h2 className="font-display flex items-center gap-2 text-2xl font-semibold">
              <Sparkles className="h-5 w-5 text-agree" /> What the commentators agree on
            </h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {commentary.commonGround.map((point, i) => (
                <li key={i} className="flex gap-3 rounded-2xl border border-border bg-card p-4">
                  <span className="mt-1.5 h-2 w-6 shrink-0 rounded-full bg-agree" />
                  <span className="text-base leading-relaxed">{point}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {slightContrasts.length > 0 && (
          <div className="mt-10">
            <h2 className="font-display flex items-center gap-2 text-2xl font-semibold">
              <GitCompare className="h-5 w-5 text-slight-diff" /> Where they differ slightly
            </h2>
            <div className="mt-4 space-y-4">
              {slightContrasts.map((c, i) => (
                <article key={i} className="rounded-2xl border border-border bg-card p-5">
                  <h3 className="font-display text-lg font-semibold">{c.topic}</h3>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {c.positions.map((p, j) => (
                      <div key={j} className="rounded-xl border-l-[3px] border-slight-diff bg-slight-diff/5 p-4">
                        <div className="text-sm font-semibold text-slight-diff">{p.author}</div>
                        {authorEra.get(p.author) && (
                          <div className="text-xs text-muted-foreground">{cleanEra(authorEra.get(p.author)!)}</div>
                        )}
                        <p className="mt-1 text-base leading-relaxed">{highlightPosition(p.view, c.positions.filter((_, k) => k !== j).map((s) => s.view))}</p>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}

        {strongContrasts.length > 0 && (
          <div className="mt-10">
            <h2 className="font-display flex items-center gap-2 text-2xl font-semibold">
              <GitCompare className="h-5 w-5 text-strong-diff" /> Where they strongly disagree
            </h2>
            <div className="mt-4 space-y-4">
              {strongContrasts.map((c, i) => (
                <article key={i} className="rounded-2xl border border-border bg-card p-5">
                  <h3 className="font-display text-lg font-semibold">{c.topic}</h3>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {c.positions.map((p, j) => (
                      <div key={j} className="rounded-xl border-l-[3px] border-strong-diff bg-strong-diff/5 p-4">
                        <div className="text-sm font-semibold text-strong-diff">{p.author}</div>
                        {authorEra.get(p.author) && (
                          <div className="text-xs text-muted-foreground">{cleanEra(authorEra.get(p.author)!)}</div>
                        )}
                        <p className="mt-1 text-base leading-relaxed">{highlightPosition(p.view, c.positions.filter((_, k) => k !== j).map((s) => s.view))}</p>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}

        <div className="mt-12 rounded-2xl border border-border bg-card p-5">
          <p className="text-xs text-muted-foreground">
            Summaries are AI-rendered overviews of public-domain commentaries (Henry, Calvin,
            Spurgeon, Barnes, Wesley). Always consult primary sources for study.
          </p>
        </div>

        <div className="mt-12">
          <h2 className="font-display text-2xl font-semibold">Each commentator on {reference}</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {commentary.commentaries.map((c, i) => (
            <article key={i} className="rounded-2xl border border-border bg-card p-5">
              <header className="flex items-center gap-3">
                <AuthorThumbnail name={c.author} size={48} />
                <div className="min-w-0 flex-1">
                  <h3 className="font-display text-lg font-semibold">{c.author}</h3>
                  <p className="text-xs text-muted-foreground">{c.era}</p>
                </div>
                <CopyCardButton
                  author={c.author}
                  era={c.era}
                  summary={c.summary}
                  keyInsight={c.keyInsight}
                  verseRef={reference}
                />
              </header>
              <p className="mt-3 text-base leading-relaxed">{c.summary}</p>
              <p className="mt-3 text-sm italic text-muted-foreground">&ldquo;{c.keyInsight}&rdquo;</p>
            </article>
            ))}
          </div>
        </div>

        <aside className="mt-12 rounded-3xl border border-border bg-card p-6 text-center sm:p-8">
          <h2 className="font-display text-xl font-semibold">
            Want to dig deeper into {reference}?
          </h2>
          <p className="mt-2 text-muted-foreground">
            Ask follow-up questions and explore each disagreement in the live tool.
          </p>
          <Link
            to="/"
            search={{ ref: reference }}

            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Open {reference} in Verse Smart <ArrowRight className="h-4 w-4" />
          </Link>
        </aside>

        <NewsletterFooter user={user} seed={reference} />

        <nav aria-label="Other verses" className="mt-10 border-t border-border pt-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Popular verse commentaries
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {SUGGESTED_VERSES.filter((r) => r !== reference).slice(0, 14).map((r) => (
              <Link
                key={r}
                to="/verse/$slug"
                params={{ slug: referenceToSlug(r) }}
                className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-accent"
              >
                {r}
              </Link>
            ))}
          </div>
        </nav>
      </section>
    </main>
  );
}

function VersePageSkeleton() {
  return (
    <main className="bg-background text-foreground">
      <section className="mx-auto max-w-4xl px-5 pt-12 pb-8 sm:px-6">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="mt-4 h-12 w-3/4" />
        <Skeleton className="mt-4 h-5 w-full" />
        <Skeleton className="mt-2 h-5 w-5/6" />
        <div className="mt-6 rounded-3xl border border-border bg-card p-6 sm:p-8">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="mt-3 h-6 w-full" />
          <Skeleton className="mt-2 h-6 w-11/12" />
          <Skeleton className="mt-2 h-6 w-3/4" />
        </div>
        <Skeleton className="mt-6 h-11 w-48 rounded-xl" />
      </section>
      <section className="mx-auto max-w-4xl px-5 pb-10 sm:px-6">
        <Skeleton className="h-7 w-72" />
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="mt-10 h-7 w-64" />
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-2xl" />
          ))}
        </div>
      </section>
    </main>
  );
}

const SUGGESTED_VERSES = [
  "John 3:16", "Psalms 23:1", "Jeremiah 29:11", "Romans 8:28", "Philippians 4:13",
  "Proverbs 3:5", "Isaiah 41:10", "Matthew 6:33", "Romans 12:2", "1 Corinthians 13:4",
  "Genesis 1:1", "Ephesians 2:8", "Joshua 1:9", "Hebrews 11:1", "John 14:6",
];


import { listPublishedPostsLocalized, type BlogPost } from "@/lib/blog.functions";
import { LANGUAGES, isRtl, type LanguageCode } from "@/lib/languages";
import { useLanguage } from "@/lib/language-context";
import { BlogLanguageSwitcher } from "@/components/BlogLanguageSwitcher";

const SUPPORTED = new Set(LANGUAGES.map((l) => l.code));

export const Route = createFileRoute("/blog/lang/$lang/")({
  loader: async ({ params }) => {
    if (!SUPPORTED.has(params.lang as LanguageCode)) throw notFound();
    const posts = await listPublishedPostsLocalized({ data: { lang: params.lang } });
    return { posts, lang: params.lang as LanguageCode };
  },
  head: ({ params }) => {
    const url = `https://versesmart.org/blog/lang/${params.lang}`;
    const title = `Blog — VerseSmart (${params.lang})`;
    const description =
      "Articles, reflections, and updates from the VerseSmart team on Bible commentary and global perspectives.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:url", content: url },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  errorComponent: BlogLangError,
  notFoundComponent: () => <BlogLangError error={new Error("Not found")} reset={() => {}} />,
  component: LocalizedBlogIndex,
});

function BlogLangError({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  return (
    <main className="mx-auto max-w-3xl px-5 py-16 text-center">
      <h1 className="font-display text-2xl font-semibold">Couldn't load the blog</h1>
      <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
      <button
        onClick={() => { router.invalidate(); reset(); }}
        className="mt-6 rounded-2xl bg-primary px-5 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        Try again
      </button>
    </main>
  );
}

function LocalizedBlogIndex() {
  const { posts, lang } = Route.useLoaderData() as { posts: BlogPost[]; lang: LanguageCode };
  const { t } = useLanguage();
  const dir = isRtl(lang) ? "rtl" : "ltr";
  return (
    <main dir={dir} className="mx-auto max-w-3xl px-5 py-10 sm:py-14">
      <BlogLanguageSwitcher currentLang={lang} />
      <header className="mb-10">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">VerseSmart</p>
        <h1 className="mt-1 font-display text-3xl font-semibold sm:text-4xl">{t("blog.title")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("blog.subtitle")}</p>
      </header>

      {posts.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("blog.empty")}</p>
      ) : (
        <ul className="space-y-6">
          {posts.map((p) => (
            <li key={p.id} className="rounded-2xl border border-border bg-card p-5">
              <Link to="/blog/lang/$lang/$slug" params={{ lang, slug: p.slug }} className="block">
                <h2 className="font-display text-xl font-semibold hover:underline">{p.title}</h2>
                {p.description ? (
                  <p className="mt-2 text-sm text-muted-foreground">{p.description}</p>
                ) : null}
                <p className="mt-3 text-xs text-muted-foreground">
                  {new Date(p.created_at).toLocaleDateString(lang, {
                    day: "numeric", month: "long", year: "numeric",
                  })}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

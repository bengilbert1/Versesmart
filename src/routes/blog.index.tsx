
import { listPublishedPosts, type BlogPost } from "@/lib/blog.functions";
import { LANGUAGES } from "@/lib/languages";
import { useLanguage } from "@/lib/language-context";
import { BlogLanguageSwitcher } from "@/components/BlogLanguageSwitcher";

export const Route = createFileRoute("/blog/")({
  loader: () => listPublishedPosts(),
  head: () => ({
    meta: [
      { title: "Blog — VerseSmart" },
      {
        name: "description",
        content: "Articles, reflections, and updates from the VerseSmart team on Bible commentary and global perspectives.",
      },
      { property: "og:title", content: "Blog — VerseSmart" },
      { property: "og:description", content: "Articles, reflections, and updates from the VerseSmart team." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://versesmart.org/blog" },
    ],
    links: [{ rel: "canonical", href: "https://versesmart.org/blog" }],
  }),
  errorComponent: BlogError,
  notFoundComponent: () => <BlogError error={new Error("Not found")} reset={() => {}} />,
  component: BlogIndex,
});

function BlogError({ error, reset }: { error: Error; reset: () => void }) {
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

function BlogIndex() {
  const posts = Route.useLoaderData() as BlogPost[];
  const { t, language } = useLanguage();
  return (
    <main className="mx-auto max-w-3xl px-5 py-10 sm:py-14">
      <BlogLanguageSwitcher currentLang="en" />
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
              <Link to="/blog/$slug" params={{ slug: p.slug }} className="block">
                <h2 className="font-display text-xl font-semibold hover:underline">{p.title}</h2>
                {p.description ? (
                  <p className="mt-2 text-sm text-muted-foreground">{p.description}</p>
                ) : null}
                <p className="mt-3 text-xs text-muted-foreground">
                  {new Date(p.created_at).toLocaleDateString(language, {
                    day: "numeric", month: "long", year: "numeric",
                  })}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <nav className="mt-12 border-t border-border pt-6 text-xs text-muted-foreground">
        <span className="mr-2">{t("blog.otherLanguages")}:</span>
        {LANGUAGES.filter((l) => l.code !== "en").map((l, i) => (
          <span key={l.code}>
            {i > 0 ? " · " : ""}
            <Link to="/blog/lang/$lang" params={{ lang: l.code }} className="hover:underline">
              {l.nativeName}
            </Link>
          </span>
        ))}
      </nav>
    </main>
  );
}

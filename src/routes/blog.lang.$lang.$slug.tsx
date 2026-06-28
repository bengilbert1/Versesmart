
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { getPublishedPostLocalized, type BlogPost } from "@/lib/blog.functions";
import { LANGUAGES, isRtl, type LanguageCode } from "@/lib/languages";
import { useLanguage } from "@/lib/language-context";
import { BlogLanguageSwitcher } from "@/components/BlogLanguageSwitcher";

const SUPPORTED = new Set(LANGUAGES.map((l) => l.code));

export const Route = createFileRoute("/blog/lang/$lang/$slug")({
  loader: async ({ params }) => {
    if (!SUPPORTED.has(params.lang as LanguageCode)) throw notFound();
    const post = await getPublishedPostLocalized({ data: { slug: params.slug, lang: params.lang } });
    if (!post) throw notFound();
    return { post, lang: params.lang as LanguageCode };
  },
  head: ({ params, loaderData }) => {
    const data = loaderData as { post: BlogPost; lang: LanguageCode } | undefined;
    const post = data?.post;
    const url = `https://versesmart.org/blog/lang/${params.lang}/${params.slug}`;
    const title = post ? `${post.title} | VerseSmart` : "Blog post | VerseSmart";
    const description = post?.description || "Read this article on the VerseSmart blog.";
    const scripts = post
      ? [{
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Article",
            headline: post.title,
            description,
            inLanguage: params.lang,
            datePublished: post.created_at,
            dateModified: post.updated_at,
            author: { "@type": "Organization", name: "VerseSmart" },
            publisher: { "@type": "Organization", name: "VerseSmart" },
            mainEntityOfPage: url,
            url,
          }),
        }]
      : [];
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "article" },
        { property: "og:url", content: url },
        { property: "og:locale", content: params.lang },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
      ],
      links: [{ rel: "canonical", href: url }],
      scripts,
    };
  },
  errorComponent: PostError,
  notFoundComponent: () => (
    <main className="mx-auto max-w-2xl px-5 py-24 text-center">
      <h1 className="font-display text-3xl font-semibold">Post not found</h1>
      <Link to="/blog" className="mt-6 inline-block text-sm underline">Back to blog</Link>
    </main>
  ),
  component: LocalizedPostPage,
});

function PostError({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  return (
    <main className="mx-auto max-w-2xl px-5 py-16 text-center">
      <h1 className="font-display text-2xl font-semibold">Couldn't load this post</h1>
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

function LocalizedPostPage() {
  const { post, lang } = Route.useLoaderData() as { post: BlogPost; lang: LanguageCode };
  const { t } = useLanguage();
  const dir = isRtl(lang) ? "rtl" : "ltr";
  return (
    <main dir={dir} className="mx-auto max-w-3xl px-5 py-10 sm:py-14">
      <BlogLanguageSwitcher currentLang={lang} slug={post.slug} />
      <Link to="/blog/lang/$lang" params={{ lang }} className="text-xs text-muted-foreground hover:underline">
        ← {t("blog.back")}
      </Link>
      <header className="mt-4 mb-8">
        <h1 className="font-display text-3xl font-semibold sm:text-4xl">{post.title}</h1>
        {post.description ? (
          <p className="mt-3 text-base text-muted-foreground">{post.description}</p>
        ) : null}
        <p className="mt-3 text-xs text-muted-foreground">
          {t("blog.published")}{" "}
          {new Date(post.created_at).toLocaleDateString(lang, {
            day: "numeric", month: "long", year: "numeric",
          })}
        </p>
      </header>

      <article className="prose prose-neutral max-w-none dark:prose-invert prose-headings:font-display prose-headings:tracking-tight prose-h1:text-3xl prose-h2:text-2xl prose-h3:text-xl prose-h4:text-lg prose-p:leading-relaxed prose-li:leading-relaxed prose-blockquote:border-l-primary prose-blockquote:text-muted-foreground prose-hr:border-border prose-a:text-primary">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{post.content}</ReactMarkdown>
      </article>
    </main>
  );
}

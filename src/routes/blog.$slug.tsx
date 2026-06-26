import { createFileRoute, Link, notFound, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";

import {
  getPublishedPostBySlug,
  listPostComments,
  createComment,
  deleteOwnComment,
  type BlogComment,
  type BlogPost,
} from "@/lib/blog.functions";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/lib/language-context";
import { BlogLanguageSwitcher } from "@/components/BlogLanguageSwitcher";

export const Route = createFileRoute("/blog/$slug")({
  loader: async ({ params }) => {
    const post = await getPublishedPostBySlug({ data: { slug: params.slug } });
    if (!post) throw notFound();
    return post;
  },
  head: ({ params, loaderData }) => {
    const post = loaderData as BlogPost | undefined;
    const url = `https://versesmart.org/blog/${params.slug}`;
    const title = post ? `${post.title} | VerseSmart Blog` : "Blog post | VerseSmart";
    const description = post?.description || "Read this article on the VerseSmart blog.";
    const scripts = post
      ? [{
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Article",
            headline: post.title,
            description,
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
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
      ],
      links: [{ rel: "canonical", href: url }],
      scripts,
    };
  },
  errorComponent: BlogPostError,
  notFoundComponent: () => (
    <main className="mx-auto max-w-2xl px-5 py-24 text-center">
      <h1 className="font-display text-3xl font-semibold">Post not found</h1>
      <p className="mt-2 text-sm text-muted-foreground">This article doesn't exist or hasn't been published.</p>
      <Link to="/blog" className="mt-6 inline-block text-sm underline">Back to blog</Link>
    </main>
  ),
  component: BlogPostPage,
});

function BlogPostError({ error, reset }: { error: Error; reset: () => void }) {
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

function BlogPostPage() {
  const post = Route.useLoaderData() as BlogPost;
  const { t, language } = useLanguage();
  return (
    <main className="mx-auto max-w-3xl px-5 py-10 sm:py-14">
      <BlogLanguageSwitcher currentLang="en" slug={post.slug} />
      <Link to="/blog" className="text-xs text-muted-foreground hover:underline">← {t("blog.back")}</Link>
      <header className="mt-4 mb-8">
        <h1 className="font-display text-3xl font-semibold sm:text-4xl">{post.title}</h1>
        {post.description ? (
          <p className="mt-3 text-base text-muted-foreground">{post.description}</p>
        ) : null}
        <p className="mt-3 text-xs text-muted-foreground">
          {t("blog.published")}{" "}
          {new Date(post.created_at).toLocaleDateString(language, {
            day: "numeric", month: "long", year: "numeric",
          })}
        </p>
      </header>

      <article className="prose prose-neutral max-w-none dark:prose-invert prose-headings:font-display prose-headings:tracking-tight prose-h1:text-3xl prose-h2:text-2xl prose-h3:text-xl prose-h4:text-lg prose-p:leading-relaxed prose-li:leading-relaxed prose-blockquote:border-l-primary prose-blockquote:text-muted-foreground prose-hr:border-border prose-a:text-primary">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{post.content}</ReactMarkdown>
      </article>

      <section className="mt-14 border-t border-border pt-8">
        <h2 className="font-display text-xl font-semibold">{t("blog.comments")}</h2>
        <Comments postId={post.id} />
      </section>
    </main>
  );
}

function Comments({ postId }: { postId: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const fetchComments = useServerFn(listPostComments);
  const addComment = useServerFn(createComment);
  const removeOwn = useServerFn(deleteOwnComment);

  const { data: comments = [], isLoading } = useQuery({
    queryKey: ["blog-comments", postId],
    queryFn: () => fetchComments({ data: { postId } }),
  });

  const [text, setText] = useState("");
  const create = useMutation({
    mutationFn: () => addComment({ data: { postId, content: text } }),
    onSuccess: () => {
      setText("");
      qc.invalidateQueries({ queryKey: ["blog-comments", postId] });
    },
    onError: (e) => toast.error((e as Error).message || "Could not post comment"),
  });

  const del = useMutation({
    mutationFn: (commentId: string) => removeOwn({ data: { commentId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["blog-comments", postId] }),
    onError: (e) => toast.error((e as Error).message || "Could not delete"),
  });

  return (
    <div className="mt-4 space-y-6">
      {user ? (
        <form
          onSubmit={(e) => { e.preventDefault(); if (text.trim()) create.mutate(); }}
          className="space-y-3"
        >
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Share your thoughts…"
            className="w-full min-h-[100px] rounded-xl border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            maxLength={4000}
          />
          <button
            type="submit"
            disabled={create.isPending || !text.trim()}
            className="rounded-2xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {create.isPending ? "Posting…" : "Post comment"}
          </button>
        </form>
      ) : (
        <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
          <Link to="/login" className="font-medium text-foreground underline">Sign in</Link> to leave a comment.
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading comments…</p>
      ) : comments.length === 0 ? (
        <p className="text-sm text-muted-foreground">No comments yet.</p>
      ) : (
        <ul className="space-y-4">
          {(comments as BlogComment[]).map((c) => (
            <li key={c.id} className="rounded-xl border border-border bg-card p-4">
              <p className="whitespace-pre-wrap text-sm">{c.content}</p>
              <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {new Date(c.created_at).toLocaleString(undefined, {
                    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
                  })}
                </span>
                {user && user.id === c.user_id ? (
                  <button
                    onClick={() => del.mutate(c.id)}
                    className="text-xs text-muted-foreground hover:text-destructive"
                  >
                    Delete
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

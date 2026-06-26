import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import {
  adminListPosts,
  adminCreatePost,
  adminUpdatePost,
  adminDeletePost,
  adminListComments,
  adminDeleteComment,
  type BlogPost,
  type BlogComment,
} from "@/lib/blog.functions";

type EditState = {
  id: string | null;
  title: string;
  slug: string;
  description: string;
  content: string;
  published: boolean;
};

const EMPTY: EditState = {
  id: null, title: "", slug: "", description: "", content: "", published: false,
};

export function AdminBlogPanel() {
  const qc = useQueryClient();
  const listFn = useServerFn(adminListPosts);
  const createFn = useServerFn(adminCreatePost);
  const updateFn = useServerFn(adminUpdatePost);
  const deleteFn = useServerFn(adminDeletePost);

  const posts = useQuery({ queryKey: ["admin-blog-posts"], queryFn: () => listFn() });

  const [edit, setEdit] = useState<EditState>(EMPTY);
  const [preview, setPreview] = useState(false);

  const save = useMutation({
    mutationFn: async () => {
      if (edit.id) {
        return updateFn({ data: {
          id: edit.id, title: edit.title, slug: edit.slug,
          description: edit.description, content: edit.content, published: edit.published,
        }});
      }
      return createFn({ data: {
        title: edit.title, slug: edit.slug || undefined,
        description: edit.description, content: edit.content, published: edit.published,
      }});
    },
    onSuccess: () => {
      toast.success(edit.id ? "Post updated" : "Post created");
      setEdit(EMPTY);
      qc.invalidateQueries({ queryKey: ["admin-blog-posts"] });
    },
    onError: (e) => toast.error((e as Error).message || "Save failed"),
  });

  const togglePublish = useMutation({
    mutationFn: (p: BlogPost) => updateFn({ data: { id: p.id, published: !p.published } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-blog-posts"] }),
    onError: (e) => toast.error((e as Error).message),
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["admin-blog-posts"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="space-y-10">
      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="font-display text-lg font-semibold">
          {edit.id ? "Edit post" : "New post"}
        </h2>
        <div className="mt-4 grid gap-3">
          <input
            value={edit.title}
            onChange={(e) => setEdit({ ...edit, title: e.target.value })}
            placeholder="Title"
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <input
            value={edit.slug}
            onChange={(e) => setEdit({ ...edit, slug: e.target.value })}
            placeholder="Slug (auto from title if blank)"
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <input
            value={edit.description}
            onChange={(e) => setEdit({ ...edit, description: e.target.value })}
            placeholder="Short description (used for SEO + listing)"
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Content (Markdown)</span>
            <button
              type="button"
              onClick={() => setPreview((v) => !v)}
              className="rounded-md border border-input bg-background px-2 py-1 text-xs hover:bg-accent"
            >
              {preview ? "Edit" : "Preview"}
            </button>
          </div>
          {preview ? (
            <article className="prose prose-neutral min-h-[240px] max-w-none rounded-md border border-input bg-background p-3 dark:prose-invert">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{edit.content || "*Nothing to preview*"}</ReactMarkdown>
            </article>
          ) : (
            <textarea
              value={edit.content}
              onChange={(e) => setEdit({ ...edit, content: e.target.value })}
              placeholder="# Hello world&#10;&#10;Write Markdown here…"
              className="min-h-[280px] rounded-md border border-input bg-background px-3 py-2 font-mono text-sm"
            />
          )}
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={edit.published}
              onChange={(e) => setEdit({ ...edit, published: e.target.checked })}
            />
            Published
          </label>
          <div className="flex gap-2">
            <button
              onClick={() => save.mutate()}
              disabled={save.isPending || !edit.title.trim()}
              className="rounded-2xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {save.isPending ? "Saving…" : edit.id ? "Update" : "Create"}
            </button>
            {edit.id ? (
              <button
                onClick={() => setEdit(EMPTY)}
                className="rounded-2xl border border-input bg-background px-4 py-2 text-sm hover:bg-accent"
              >
                Cancel
              </button>
            ) : null}
          </div>
        </div>
      </section>

      <section>
        <h2 className="font-display text-lg font-semibold">All posts</h2>
        {posts.isLoading ? (
          <p className="mt-3 text-sm text-muted-foreground">Loading…</p>
        ) : posts.isError ? (
          <p className="mt-3 text-sm text-destructive">Failed to load.</p>
        ) : (posts.data ?? []).length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No posts yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border rounded-2xl border border-border bg-card">
            {(posts.data ?? []).map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="truncate font-medium">{p.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    /blog/{p.slug} · {p.published ? "Published" : "Draft"} ·{" "}
                    {new Date(p.updated_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    onClick={() => togglePublish.mutate(p)}
                    className="rounded-md border border-input bg-background px-2 py-1 text-xs hover:bg-accent"
                  >
                    {p.published ? "Unpublish" : "Publish"}
                  </button>
                  <button
                    onClick={() => setEdit({
                      id: p.id, title: p.title, slug: p.slug,
                      description: p.description, content: p.content, published: p.published,
                    })}
                    className="rounded-md border border-input bg-background px-2 py-1 text-xs hover:bg-accent"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => { if (confirm(`Delete "${p.title}"?`)) del.mutate(p.id); }}
                    className="rounded-md border border-input bg-background px-2 py-1 text-xs text-destructive hover:bg-destructive/10"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <CommentsModeration />
    </div>
  );
}

function CommentsModeration() {
  const qc = useQueryClient();
  const listFn = useServerFn(adminListComments);
  const delFn = useServerFn(adminDeleteComment);
  const comments = useQuery<BlogComment[]>({
    queryKey: ["admin-blog-comments"], queryFn: () => listFn(),
  });
  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Comment deleted");
      qc.invalidateQueries({ queryKey: ["admin-blog-comments"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <section>
      <h2 className="font-display text-lg font-semibold">Comments moderation</h2>
      {comments.isLoading ? (
        <p className="mt-3 text-sm text-muted-foreground">Loading…</p>
      ) : (comments.data ?? []).length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">No comments yet.</p>
      ) : (
        <ul className="mt-3 divide-y divide-border rounded-2xl border border-border bg-card">
          {(comments.data ?? []).map((c) => (
            <li key={c.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">
                    On <span className="font-medium text-foreground">{c.post_title ?? "(unknown)"}</span> ·{" "}
                    {new Date(c.created_at).toLocaleString()}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm">{c.content}</p>
                </div>
                <button
                  onClick={() => { if (confirm("Delete this comment?")) del.mutate(c.id); }}
                  className="shrink-0 rounded-md border border-input bg-background px-2 py-1 text-xs text-destructive hover:bg-destructive/10"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

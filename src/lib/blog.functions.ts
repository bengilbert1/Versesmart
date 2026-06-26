import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ADMIN_EMAIL = "gilbertbg@gmail.com";

function assertAdmin(claims: Record<string, unknown> | undefined) {
  const email = typeof claims?.email === "string" ? (claims.email as string).toLowerCase() : "";
  if (email !== ADMIN_EMAIL) throw new Error("Not found");
}

export type BlogPost = {
  id: string;
  title: string;
  slug: string;
  description: string;
  content: string;
  published: boolean;
  created_at: string;
  updated_at: string;
};

export type BlogComment = {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  user_email?: string | null;
  post_title?: string | null;
  post_slug?: string | null;
};

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "post";
}

// ---------- Public reads ----------

export const listPublishedPosts = createServerFn({ method: "GET" }).handler(async (): Promise<BlogPost[]> => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("blog_posts")
    .select("*")
    .eq("published", true)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as BlogPost[];
});

export const getPublishedPostBySlug = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string }) => d)
  .handler(async ({ data }): Promise<BlogPost | null> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("blog_posts")
      .select("*")
      .eq("slug", data.slug)
      .eq("published", true)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (row as BlogPost | null) ?? null;
  });

export const listPostComments = createServerFn({ method: "GET" })
  .inputValidator((d: { postId: string }) => d)
  .handler(async ({ data }): Promise<BlogComment[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("blog_comments")
      .select("id, post_id, user_id, content, created_at")
      .eq("post_id", data.postId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (rows ?? []) as BlogComment[];
  });

// ---------- Authenticated comment actions ----------

export const createComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { postId: string; content: string }) => d)
  .handler(async ({ data, context }) => {
    const content = data.content.trim();
    if (!content) throw new Error("Empty comment");
    if (content.length > 4000) throw new Error("Comment too long");
    const { error } = await context.supabase.from("blog_comments").insert({
      post_id: data.postId,
      user_id: context.userId,
      content,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteOwnComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { commentId: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("blog_comments")
      .delete()
      .eq("id", data.commentId)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Admin actions ----------

export const adminListPosts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<BlogPost[]> => {
    assertAdmin(context.claims as Record<string, unknown>);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("blog_posts")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as BlogPost[];
  });

export const adminCreatePost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { title: string; slug?: string; description?: string; content?: string; published?: boolean }) => d)
  .handler(async ({ data, context }) => {
    assertAdmin(context.claims as Record<string, unknown>);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const title = data.title.trim();
    if (!title) throw new Error("Title required");
    const baseSlug = data.slug?.trim() ? slugify(data.slug) : slugify(title);
    // Ensure slug is unique
    let slug = baseSlug;
    let n = 2;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { data: existing } = await supabaseAdmin
        .from("blog_posts").select("id").eq("slug", slug).maybeSingle();
      if (!existing) break;
      slug = `${baseSlug}-${n++}`;
    }
    const { data: row, error } = await supabaseAdmin
      .from("blog_posts")
      .insert({
        title,
        slug,
        description: data.description?.trim() ?? "",
        content: data.content ?? "",
        published: data.published ?? false,
      })
      .select("*").single();
    if (error) throw new Error(error.message);
    if (row.published) {
      const { translatePostToAllLanguages } = await import("./blog-translate.server");
      try { await translatePostToAllLanguages(row.id); }
      catch (e) { console.warn("[blog] translation failed on create", e); }
    }
    return row as BlogPost;
  });

export const adminUpdatePost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; title?: string; slug?: string; description?: string; content?: string; published?: boolean }) => d)
  .handler(async ({ data, context }) => {
    assertAdmin(context.claims as Record<string, unknown>);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: {
      title?: string; slug?: string; description?: string; content?: string; published?: boolean;
    } = {};
    if (data.title !== undefined) patch.title = data.title.trim();
    if (data.slug !== undefined) patch.slug = slugify(data.slug);
    if (data.description !== undefined) patch.description = data.description;
    if (data.content !== undefined) patch.content = data.content;
    if (data.published !== undefined) patch.published = data.published;
    const { data: row, error } = await supabaseAdmin
      .from("blog_posts").update(patch).eq("id", data.id).select("*").single();
    if (error) throw new Error(error.message);
    if (row.published) {
      const { translatePostToAllLanguages } = await import("./blog-translate.server");
      try { await translatePostToAllLanguages(row.id); }
      catch (e) { console.warn("[blog] translation failed on update", e); }
    }
    return row as BlogPost;
  });

export const adminDeletePost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    assertAdmin(context.claims as Record<string, unknown>);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("blog_posts").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminListComments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<BlogComment[]> => {
    assertAdmin(context.claims as Record<string, unknown>);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("blog_comments")
      .select("id, post_id, user_id, content, created_at, blog_posts(title, slug)")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r: { id: string; post_id: string; user_id: string; content: string; created_at: string; blog_posts?: { title: string; slug: string } | null }) => ({
      id: r.id,
      post_id: r.post_id,
      user_id: r.user_id,
      content: r.content,
      created_at: r.created_at,
      post_title: r.blog_posts?.title ?? null,
      post_slug: r.blog_posts?.slug ?? null,
    }));
  });

export const adminDeleteComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    assertAdmin(context.claims as Record<string, unknown>);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("blog_comments").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Localized public reads ----------

// Returns the list of published posts already merged with the translation for
// the requested language. Falls back to the English original whenever a
// translation row is missing.
export const listPublishedPostsLocalized = createServerFn({ method: "GET" })
  .inputValidator((d: { lang: string }) => d)
  .handler(async ({ data }): Promise<BlogPost[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: posts, error } = await supabaseAdmin
      .from("blog_posts")
      .select("*")
      .eq("published", true)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    if (!posts || posts.length === 0) return [];
    const ids = posts.map((p) => p.id);
    const { data: trs } = await supabaseAdmin
      .from("blog_post_translations")
      .select("post_id, title, description, content")
      .in("post_id", ids)
      .eq("language_code", data.lang);
    const byId = new Map((trs ?? []).map((t) => [t.post_id, t]));
    return posts.map((p) => {
      const t = byId.get(p.id);
      return {
        ...(p as BlogPost),
        title: t?.title || p.title,
        description: t?.description ?? p.description,
        content: t?.content ?? p.content,
      };
    });
  });

export const getPublishedPostLocalized = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string; lang: string }) => d)
  .handler(async ({ data }): Promise<BlogPost | null> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("blog_posts")
      .select("*")
      .eq("slug", data.slug)
      .eq("published", true)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) return null;
    const { data: tr } = await supabaseAdmin
      .from("blog_post_translations")
      .select("title, description, content")
      .eq("post_id", row.id)
      .eq("language_code", data.lang)
      .maybeSingle();
    return {
      ...(row as BlogPost),
      title: tr?.title || row.title,
      description: tr?.description ?? row.description,
      content: tr?.content ?? row.content,
    };
  });


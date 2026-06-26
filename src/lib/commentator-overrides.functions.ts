// Server functions for the admin commentator metadata editor.
// Read is public; mutations require the admin email.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { normalizeName } from "./commentator-metadata";

const ADMIN_EMAIL = "gilbertbg@gmail.com";

function assertAdmin(claims: Record<string, unknown> | undefined) {
  const email = typeof claims?.email === "string" ? (claims.email as string).toLowerCase() : "";
  if (email !== ADMIN_EMAIL) throw new Error("Not found");
}

export type CommentatorOverrideRow = {
  id: string;
  name_key: string;
  display_name: string;
  region: string | null;
  denomination: string | null;
  country: string | null;
  tradition: string | null;
  worldview: string | null;
  gender: string | null;
  publication_era: string | null;
  birth_year: number | null;
  death_year: number | null;
  portrait_url: string | null;
  is_primary: boolean;
  is_manual: boolean;
  is_hidden: boolean;
};

function rowFromDb(r: Record<string, unknown>): CommentatorOverrideRow {
  return {
    id: String(r.id),
    name_key: String(r.name_key),
    display_name: String(r.display_name),
    region: (r.region as string | null) ?? null,
    denomination: (r.denomination as string | null) ?? null,
    country: (r.country as string | null) ?? null,
    tradition: (r.tradition as string | null) ?? null,
    worldview: (r.worldview as string | null) ?? null,
    gender: (r.gender as string | null) ?? null,
    publication_era: (r.publication_era as string | null) ?? null,
    birth_year: (r.birth_year as number | null) ?? null,
    death_year: (r.death_year as number | null) ?? null,
    portrait_url: (r.portrait_url as string | null) ?? null,
    is_primary: !!r.is_primary,
    is_manual: !!r.is_manual,
    is_hidden: !!r.is_hidden,
  };
}

// Public read — anyone may fetch overrides so every tab reflects admin metadata.
// `portrait_url` in the DB now stores only the storage object path; we mint
// short-lived signed URLs server-side so long-lived URLs are never persisted
// or exposed broadly.
export const listCommentatorOverrides = createServerFn({ method: "GET" }).handler(
  async (): Promise<CommentatorOverrideRow[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [overridesRes, deletedRes] = await Promise.all([
      supabaseAdmin
        .from("commentator_overrides")
        .select("*")
        .order("display_name", { ascending: true }),
      supabaseAdmin.from("deleted_commentators").select("name_key"),
    ]);
    const deleted = new Set(
      (deletedRes.data ?? []).map((r) => String((r as { name_key: string }).name_key)),
    );
    const rows = (overridesRes.data ?? [])
      .map((r) => rowFromDb(r as Record<string, unknown>))
      .filter((r) => !deleted.has(r.name_key));

    // Collect distinct storage paths and sign them in batch.
    const paths = Array.from(
      new Set(
        rows
          .map((r) => r.portrait_url)
          .filter((v): v is string => !!v && !v.startsWith("http") && !v.startsWith("data:")),
      ),
    );
    const signedByPath = new Map<string, string>();
    if (paths.length > 0) {
      const { data: signed } = await supabaseAdmin.storage
        .from(PORTRAIT_BUCKET)
        .createSignedUrls(paths, PORTRAIT_VIEW_TTL);
      for (const s of (signed ?? []) as Array<{ path: string | null; signedUrl: string | null }>) {
        if (s.path && s.signedUrl) signedByPath.set(s.path, s.signedUrl);
      }
    }
    return rows.map((r) =>
      r.portrait_url && signedByPath.has(r.portrait_url)
        ? { ...r, portrait_url: signedByPath.get(r.portrait_url)! }
        : r,
    );
  },
);

const UpsertInput = z.object({
  display_name: z.string().min(1).max(200),
  region: z.string().max(120).nullable().optional(),
  denomination: z.string().max(120).nullable().optional(),
  country: z.string().max(120).nullable().optional(),
  tradition: z.string().max(200).nullable().optional(),
  worldview: z.string().max(200).nullable().optional(),
  gender: z.string().max(60).nullable().optional(),
  publication_era: z.string().max(120).nullable().optional(),
  birth_year: z.number().int().min(-3000).max(3000).nullable().optional(),
  death_year: z.number().int().min(-3000).max(3000).nullable().optional(),
  is_manual: z.boolean().optional(),
});

export const upsertCommentatorOverride = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => UpsertInput.parse(input))
  .handler(async ({ context, data }): Promise<CommentatorOverrideRow> => {
    assertAdmin(context.claims as Record<string, unknown>);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const name_key = normalizeName(data.display_name);

    const { data: existing } = await supabaseAdmin
      .from("commentator_overrides")
      .select("id, is_primary")
      .eq("name_key", name_key);
    const groupExists = (existing ?? []).length > 0;
    const groupHasPrimary = (existing ?? []).some((r) => (r as { is_primary: boolean }).is_primary);

    const payload = {
      name_key,
      display_name: data.display_name,
      region: data.region ?? null,
      denomination: data.denomination ?? null,
      country: data.country ?? null,
      tradition: data.tradition ?? null,
      worldview: data.worldview ?? null,
      gender: data.gender ?? null,
      publication_era: data.publication_era ?? null,
      birth_year: data.birth_year ?? null,
      death_year: data.death_year ?? null,
      is_manual: data.is_manual ?? false,
      is_primary: !groupExists || !groupHasPrimary,
    };

    const { data: upserted, error } = await supabaseAdmin
      .from("commentator_overrides")
      .upsert(payload, { onConflict: "name_key,display_name" })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return rowFromDb(upserted as Record<string, unknown>);
  });

const DeleteInput = z.object({ id: z.string().uuid() });

export const deleteCommentatorOverride = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => DeleteInput.parse(input))
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    assertAdmin(context.claims as Record<string, unknown>);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("commentator_overrides").delete().eq("id", data.id);
    return { ok: true };
  });

// Delete a SINGLE commentator row by its unique ID.
//
// Strict ID-only semantics:
//   - Only the row with that exact `id` is removed.
//   - Other variants sharing the same `name_key` (duplicates) are untouched.
//   - Portrait storage for that one row is cleaned up.
//   - If that row was the LAST remaining variant for its name_key AND the
//     name exists in the static KNOWN_COMMENTATORS roster, we add a
//     tombstone so the commentator does not resurrect from the static
//     dataset — keeping Admin as the single source of truth. Otherwise no
//     tombstone is written, so any surviving duplicate stays visible.
const DeleteByIdInput = z.object({ id: z.string().uuid() });

export const deleteCommentatorById = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => DeleteByIdInput.parse(input))
  .handler(async ({ context, data }): Promise<{ ok: true; tombstoned: boolean }> => {
    assertAdmin(context.claims as Record<string, unknown>);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: row } = await supabaseAdmin
      .from("commentator_overrides")
      .select("id, name_key, display_name, portrait_url")
      .eq("id", data.id)
      .maybeSingle();
    if (!row) return { ok: true, tombstoned: false };
    const target = row as {
      id: string;
      name_key: string;
      display_name: string;
      portrait_url: string | null;
    };

    // Clean only this row's portrait object.
    const path = storagePathFromSignedUrl(target.portrait_url);
    if (path && !path.startsWith("data:")) {
      await supabaseAdmin.storage.from(PORTRAIT_BUCKET).remove([path]).catch(() => {});
    }

    await supabaseAdmin.from("commentator_overrides").delete().eq("id", data.id);

    // Last variant gone? Always tombstone so the name cannot resurrect
    // from the static roster, AI cache, or any future seed — Admin panel
    // is the single source of truth.
    const { count } = await supabaseAdmin
      .from("commentator_overrides")
      .select("id", { count: "exact", head: true })
      .eq("name_key", target.name_key);
    let tombstoned = false;
    if ((count ?? 0) === 0) {
      await supabaseAdmin.from("commentator_blocks").delete().eq("name_key", target.name_key);
      await supabaseAdmin
        .from("deleted_commentators")
        .upsert(
          { name_key: target.name_key, display_name: target.display_name },
          { onConflict: "name_key" },
        );
      tombstoned = true;
    }

    // Re-run audit to clean up any orphans / refresh the canonical list.
    try {
      await supabaseAdmin.rpc("admin_commentator_audit", { p_source: "delete" });
    } catch {
      /* non-fatal */
    }

    return { ok: true, tombstoned };
  });

// Public read — unified selectable commentator list.
// SINGLE SOURCE OF TRUTH for the user-facing "Select commentators to compare"
// modal across all languages. Built from the admin `commentator_overrides`
// table (the master dataset) UNIONed with the static KNOWN_COMMENTATORS
// roster, minus tombstoned names. Duplicate variants collapse to one
// Primary display_name per name_key. Refetches reflect admin add/delete
// instantly.
export const listAllSelectableCommentators = createServerFn({ method: "GET" }).handler(
  async (): Promise<string[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { KNOWN_COMMENTATORS } = await import("./known-commentators");
    const [overridesRes, deletedRes] = await Promise.all([
      supabaseAdmin
        .from("commentator_overrides")
        .select("name_key, display_name, is_primary, is_hidden"),
      supabaseAdmin.from("deleted_commentators").select("name_key"),
    ]);
    const deleted = new Set(
      (deletedRes.data ?? []).map((r) => String((r as { name_key: string }).name_key)),
    );

    // Render only Primary variants. Hide every Secondary (non-primary)
    // override row so duplicates collapse to a single entry per name_key.
    // If a group exists in overrides but has NO primary at all, fall back
    // to the first row so the commentator still appears once. Static
    // roster entries are included only when the name_key is not covered
    // by any override row.
    const overrideKeys = new Set<string>();
    const primaryByKey = new Map<string, string>();
    const fallbackByKey = new Map<string, string>();
    for (const r of (overridesRes.data ?? []) as Array<{
      name_key: string;
      display_name: string;
      is_primary: boolean;
      is_hidden: boolean;
    }>) {
      if (deleted.has(r.name_key)) continue;
      overrideKeys.add(r.name_key);
      if (r.is_primary && !primaryByKey.has(r.name_key)) {
        primaryByKey.set(r.name_key, r.display_name);
      } else if (!fallbackByKey.has(r.name_key)) {
        fallbackByKey.set(r.name_key, r.display_name);
      }
    }

    const out = new Map<string, string>();
    for (const key of overrideKeys) {
      out.set(key, primaryByKey.get(key) ?? fallbackByKey.get(key)!);
    }
    for (const name of KNOWN_COMMENTATORS) {
      const key = normalizeName(name);
      if (deleted.has(key)) continue;
      if (!out.has(key)) out.set(key, name);
    }

    return Array.from(out.values()).sort((a, b) => a.localeCompare(b));
  },
);

// ---- Global permanent delete ----
// Removes a commentator from every static dataset across all languages by
// recording the name_key in `deleted_commentators`. All read paths
// (selection engine, admin list, voice chips) filter against this set.
export const listDeletedCommentators = createServerFn({ method: "GET" }).handler(
  async (): Promise<string[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("deleted_commentators")
      .select("name_key");
    return (data ?? []).map((r) => String((r as { name_key: string }).name_key));
  },
);

const DeleteGloballyInput = z.object({ display_name: z.string().min(1).max(200) });

export const deleteCommentatorGlobally = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => DeleteGloballyInput.parse(input))
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    assertAdmin(context.claims as Record<string, unknown>);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const name_key = normalizeName(data.display_name);

    // Best-effort: clean up portrait storage objects for every variant in
    // the duplicate group before removing the override rows.
    const { data: overrideRows } = await supabaseAdmin
      .from("commentator_overrides")
      .select("portrait_url")
      .eq("name_key", name_key);
    const paths = (overrideRows ?? [])
      .map((r) => storagePathFromSignedUrl((r as { portrait_url: string | null }).portrait_url))
      .filter((p): p is string => !!p && !p.startsWith("data:"));
    if (paths.length > 0) {
      await supabaseAdmin.storage.from(PORTRAIT_BUCKET).remove(paths).catch(() => {});
    }

    // Remove every variant row in the duplicate group (Primary, hidden, all),
    // then any block row. With every variant gone, the group disappears —
    // promotion to "next Primary" is moot.
    await supabaseAdmin.from("commentator_overrides").delete().eq("name_key", name_key);
    await supabaseAdmin.from("commentator_blocks").delete().eq("name_key", name_key);

    // Persist the tombstone so every future read filters this name out
    // of every static-language dataset.
    await supabaseAdmin
      .from("deleted_commentators")
      .upsert(
        { name_key, display_name: data.display_name },
        { onConflict: "name_key" },
      );

    return { ok: true };
  });

const SetPrimaryInput = z.object({ id: z.string().uuid() });

export const setPrimaryDuplicate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SetPrimaryInput.parse(input))
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    assertAdmin(context.claims as Record<string, unknown>);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("commentator_overrides")
      .select("name_key")
      .eq("id", data.id)
      .single();
    if (!row) throw new Error("Not found");
    const name_key = (row as { name_key: string }).name_key;
    await supabaseAdmin
      .from("commentator_overrides")
      .update({ is_primary: false })
      .eq("name_key", name_key);
    await supabaseAdmin.from("commentator_overrides").update({ is_primary: true }).eq("id", data.id);
    return { ok: true };
  });

const HideInput = z.object({ id: z.string().uuid(), hidden: z.boolean() });

export const setOverrideHidden = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => HideInput.parse(input))
  .handler(async ({ context, data }): Promise<{ ok: true; refused?: "lastVisible" }> => {
    assertAdmin(context.claims as Record<string, unknown>);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.hidden) {
      const { data: row } = await supabaseAdmin
        .from("commentator_overrides")
        .select("name_key, is_hidden")
        .eq("id", data.id)
        .single();
      if (row) {
        const { data: siblings } = await supabaseAdmin
          .from("commentator_overrides")
          .select("id, is_hidden")
          .eq("name_key", (row as { name_key: string }).name_key);
        const visible = (siblings ?? []).filter(
          (s) => !(s as { is_hidden: boolean }).is_hidden && (s as { id: string }).id !== data.id,
        );
        if (visible.length === 0) {
          return { ok: true, refused: "lastVisible" };
        }
      }
    }
    await supabaseAdmin
      .from("commentator_overrides")
      .update({ is_hidden: data.hidden })
      .eq("id", data.id);
    return { ok: true };
  });

export const listManualCommentators = createServerFn({ method: "GET" }).handler(
  async (): Promise<string[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("commentator_overrides")
      .select("display_name")
      .eq("is_manual", true)
      .eq("is_hidden", false);
    return (data ?? []).map((r) => String((r as { display_name: string }).display_name));
  },
);

// --- Portrait upload / removal ---
// Portraits are uploaded as base64 data URLs from the admin UI, decoded
// server-side, and stored as binary objects in the private
// `commentator-portraits` storage bucket. The `portrait_url` column then
// holds only a long-lived signed URL, keeping row payloads small so
// public SELECTs over `commentator_overrides` don't ship multi-MB blobs.
const PORTRAIT_BUCKET = "commentator-portraits";
// Signed URLs returned to the client are short-lived; rows store only the path.
const PORTRAIT_VIEW_TTL = 60 * 60; // 1 hour

const PortraitInput = z.object({
  display_name: z.string().min(1).max(200),
  // data URL: data:image/(png|jpeg|webp);base64,...
  data_url: z
    .string()
    .min(1)
    .max(2_500_000) // ~1.8MB binary max after base64
    .regex(/^data:image\/(png|jpeg|jpg|webp);base64,/i),
});

function decodeDataUrl(dataUrl: string): { bytes: Uint8Array; contentType: string; ext: string } {
  const match = /^data:(image\/(png|jpe?g|webp));base64,(.+)$/i.exec(dataUrl);
  if (!match) throw new Error("Invalid image data URL");
  const contentType = match[1].toLowerCase();
  const ext = contentType === "image/jpeg" ? "jpg" : contentType.split("/")[1];
  const bytes = Uint8Array.from(Buffer.from(match[3], "base64"));
  return { bytes, contentType, ext };
}

async function uploadPortrait(
  supabaseAdmin: {
    storage: {
      from: (b: string) => {
        upload: (
          p: string,
          b: Uint8Array,
          o: { contentType: string; upsert: boolean },
        ) => Promise<{ error: { message: string } | null }>;
        createSignedUrl: (
          p: string,
          ttl: number,
        ) => Promise<{ data: { signedUrl: string } | null; error: { message: string } | null }>;
        remove: (p: string[]) => Promise<unknown>;
      };
    };
  },
  name_key: string,
  dataUrl: string,
): Promise<string> {
  const { bytes, contentType, ext } = decodeDataUrl(dataUrl);
  const path = `${name_key}-${Date.now()}.${ext}`;
  const { error: upErr } = await supabaseAdmin.storage
    .from(PORTRAIT_BUCKET)
    .upload(path, bytes, { contentType, upsert: true });
  if (upErr) throw new Error(upErr.message);
  return path;
}

async function signPortraitPath(
  supabaseAdmin: {
    storage: {
      from: (b: string) => {
        createSignedUrl: (
          p: string,
          ttl: number,
        ) => Promise<{ data: { signedUrl: string } | null; error: { message: string } | null }>;
      };
    };
  },
  path: string | null,
): Promise<string | null> {
  if (!path) return null;
  if (path.startsWith("http") || path.startsWith("data:")) return path;
  const { data: signed } = await supabaseAdmin.storage
    .from(PORTRAIT_BUCKET)
    .createSignedUrl(path, PORTRAIT_VIEW_TTL);
  return signed?.signedUrl ?? null;
}

// Legacy helper: extract storage path from any leftover full signed URL.
function storagePathFromSignedUrl(url: string | null): string | null {
  if (!url) return null;
  if (!url.includes("/object/sign/")) return url; // already a path
  const m = new RegExp(`/object/sign/${PORTRAIT_BUCKET}/([^?]+)`).exec(url);
  return m ? decodeURIComponent(m[1]) : null;
}

export const setCommentatorPortrait = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => PortraitInput.parse(input))
  .handler(async ({ context, data }): Promise<CommentatorOverrideRow> => {
    assertAdmin(context.claims as Record<string, unknown>);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const name_key = normalizeName(data.display_name);

    const path = await uploadPortrait(supabaseAdmin, name_key, data.data_url);

    // Ensure a row exists for this display_name; create a stub if not.
    const { data: existing } = await supabaseAdmin
      .from("commentator_overrides")
      .select("id, is_primary, portrait_url, display_name")
      .eq("name_key", name_key);
    const groupExists = (existing ?? []).length > 0;
    const groupHasPrimary = (existing ?? []).some((r) => (r as { is_primary: boolean }).is_primary);

    // Best-effort cleanup of the previous storage object for this display_name.
    const prior = (existing ?? []).find(
      (r) => (r as { display_name: string }).display_name === data.display_name,
    ) as { portrait_url: string | null } | undefined;
    const priorPath = storagePathFromSignedUrl(prior?.portrait_url ?? null);
    if (priorPath && priorPath !== path) {
      await supabaseAdmin.storage.from(PORTRAIT_BUCKET).remove([priorPath]).catch(() => {});
    }

    const { data: upserted, error } = await supabaseAdmin
      .from("commentator_overrides")
      .upsert(
        {
          name_key,
          display_name: data.display_name,
          portrait_url: path,
          is_primary: !groupExists || !groupHasPrimary,
        },
        { onConflict: "name_key,display_name" },
      )
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    const row = rowFromDb(upserted as Record<string, unknown>);
    return { ...row, portrait_url: await signPortraitPath(supabaseAdmin, row.portrait_url) };
  });

const RemovePortraitInput = z.object({ id: z.string().uuid() });

export const removeCommentatorPortrait = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => RemovePortraitInput.parse(input))
  .handler(async ({ context, data }): Promise<CommentatorOverrideRow> => {
    assertAdmin(context.claims as Record<string, unknown>);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await supabaseAdmin
      .from("commentator_overrides")
      .select("portrait_url")
      .eq("id", data.id)
      .single();
    const priorPath = storagePathFromSignedUrl(
      (existing as { portrait_url: string | null } | null)?.portrait_url ?? null,
    );
    if (priorPath) {
      await supabaseAdmin.storage.from(PORTRAIT_BUCKET).remove([priorPath]).catch(() => {});
    }
    const { data: row, error } = await supabaseAdmin
      .from("commentator_overrides")
      .update({ portrait_url: null })
      .eq("id", data.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return rowFromDb(row as Record<string, unknown>);
  });

// One-shot admin migration: move any legacy base64 `data:` portraits into
// the storage bucket and replace `portrait_url` with the storage path.
export const migrateLegacyPortraitsToStorage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ migrated: number; failed: number }> => {
    assertAdmin(context.claims as Record<string, unknown>);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("commentator_overrides")
      .select("id, name_key, portrait_url")
      .like("portrait_url", "data:%");
    let migrated = 0;
    let failed = 0;
    for (const r of (rows ?? []) as Array<{ id: string; name_key: string; portrait_url: string }>) {
      try {
        const path = await uploadPortrait(supabaseAdmin, r.name_key, r.portrait_url);
        const { error } = await supabaseAdmin
          .from("commentator_overrides")
          .update({ portrait_url: path })
          .eq("id", r.id);
        if (error) throw new Error(error.message);
        migrated++;
      } catch {
        failed++;
      }
    }
    return { migrated, failed };
  });

// --- Category extensions ---
// Admin-added category values (region/denomination/tradition/worldview/gender)
// that show up alongside built-in lists in every dropdown.
export type CommentatorCategoryRow = {
  id: string;
  category_type: string;
  value: string;
  label: string | null;
};

const CATEGORY_TYPES = [
  "region",
  "denomination",
  "tradition",
  "worldview",
  "gender",
] as const;

export const listCommentatorCategories = createServerFn({ method: "GET" }).handler(
  async (): Promise<CommentatorCategoryRow[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("commentator_categories")
      .select("id, category_type, value, label")
      .order("value", { ascending: true });
    return (data ?? []).map((r) => ({
      id: String((r as { id: string }).id),
      category_type: String((r as { category_type: string }).category_type),
      value: String((r as { value: string }).value),
      label: ((r as { label: string | null }).label ?? null),
    }));
  },
);

const AddCategoryInput = z.object({
  category_type: z.enum(CATEGORY_TYPES),
  value: z.string().min(1).max(120),
  label: z.string().max(200).nullable().optional(),
});

export const addCommentatorCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => AddCategoryInput.parse(input))
  .handler(async ({ context, data }): Promise<CommentatorCategoryRow> => {
    assertAdmin(context.claims as Record<string, unknown>);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const value = data.value.trim();
    if (!value) throw new Error("Empty value");
    const { data: row, error } = await supabaseAdmin
      .from("commentator_categories")
      .upsert(
        {
          category_type: data.category_type,
          value,
          label: data.label?.trim() || null,
        },
        { onConflict: "category_type,value" },
      )
      .select("id, category_type, value, label")
      .single();
    if (error) throw new Error(error.message);
    const r = row as { id: string; category_type: string; value: string; label: string | null };
    return { id: String(r.id), category_type: r.category_type, value: r.value, label: r.label };
  });


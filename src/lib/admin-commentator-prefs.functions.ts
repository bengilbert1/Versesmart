// Admin-local UI preferences for the Commentators panel.
// Stores per-admin sort order and hidden flags. Has NO effect on the
// canonical commentator dataset, selection engine, audits, or any
// user-facing list.

import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ADMIN_EMAIL = "gilbertbg@gmail.com";

function assertAdmin(claims: Record<string, unknown> | undefined) {
  const email = typeof claims?.email === "string" ? (claims.email as string).toLowerCase() : "";
  if (email !== ADMIN_EMAIL) throw new Error("Not found");
}

export type AdminCommentatorPref = {
  name_key: string;
  sort_index: number | null;
  hidden: boolean;
};

export const listAdminCommentatorPrefs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminCommentatorPref[]> => {
    assertAdmin(context.claims);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("admin_commentator_prefs")
      .select("name_key,sort_index,hidden")
      .eq("admin_user_id", context.userId);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => ({
      name_key: String((r as { name_key: string }).name_key),
      sort_index: (r as { sort_index: number | null }).sort_index ?? null,
      hidden: !!(r as { hidden: boolean }).hidden,
    }));
  });

export const setAdminCommentatorHidden = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ name_key: z.string().min(1), hidden: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    assertAdmin(context.claims);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("admin_commentator_prefs")
      .upsert(
        {
          admin_user_id: context.userId,
          name_key: data.name_key,
          hidden: data.hidden,
        },
        { onConflict: "admin_user_id,name_key" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setAdminCommentatorOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ order: z.array(z.string().min(1)).max(2000) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    assertAdmin(context.claims);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const rows = data.order.map((name_key, i) => ({
      admin_user_id: context.userId,
      name_key,
      sort_index: i,
    }));
    if (rows.length === 0) return { ok: true };
    const { error } = await supabaseAdmin
      .from("admin_commentator_prefs")
      .upsert(rows, { onConflict: "admin_user_id,name_key" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

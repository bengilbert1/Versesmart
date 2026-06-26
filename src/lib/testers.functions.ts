import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ADMIN_EMAIL = "gilbertbg@gmail.com";

function assertAdmin(claims: Record<string, unknown> | undefined) {
  const email = typeof claims?.email === "string" ? (claims.email as string).toLowerCase() : "";
  if (email !== ADMIN_EMAIL) throw new Error("Not found");
}

export type TesterRow = {
  id: string;
  user_id: string;
  email: string | null;
  is_tester: boolean;
  expires_at: string;
  created_at: string;
  last_sign_in_at: string | null;
  notes: string | null;
  days_remaining: number;
};

export const listTesters = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<TesterRow[]> => {
    assertAdmin(context.claims as Record<string, unknown>);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: rows } = await supabaseAdmin
      .from("testers")
      .select("id,user_id,is_tester,expires_at,created_at,notes")
      .order("created_at", { ascending: false });

    const list = rows ?? [];
    const result: TesterRow[] = [];
    for (const r of list) {
      let email: string | null = null;
      let lastSignIn: string | null = null;
      try {
        const { data: u } = await supabaseAdmin.auth.admin.getUserById(r.user_id);
        email = u.user?.email ?? null;
        lastSignIn = u.user?.last_sign_in_at ?? null;
      } catch {}
      const expiresMs = r.expires_at ? new Date(r.expires_at).getTime() : 0;
      const daysRemaining = Math.max(
        0,
        Math.ceil((expiresMs - Date.now()) / (1000 * 60 * 60 * 24)),
      );
      result.push({
        id: r.id,
        user_id: r.user_id,
        email,
        is_tester: !!r.is_tester,
        expires_at: r.expires_at,
        created_at: r.created_at,
        last_sign_in_at: lastSignIn,
        notes: r.notes,
        days_remaining: daysRemaining,
      });
    }
    return result;
  });

const AddInput = z.object({
  email: z.string().email().max(254),
  expiryDays: z.number().int().min(1).max(365).default(7),
  notes: z.string().max(1000).optional(),
});

export const addTester = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => AddInput.parse(input))
  .handler(async ({ data, context }) => {
    assertAdmin(context.claims as Record<string, unknown>);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const targetEmail = data.email.trim().toLowerCase();

    // Find existing user by paginating auth admin list.
    let userId: string | null = null;
    let page = 1;
    while (page <= 20) {
      const { data: list, error } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage: 1000,
      });
      if (error) throw new Error("Failed to look up user");
      const match = list.users.find((u) => (u.email ?? "").toLowerCase() === targetEmail);
      if (match) {
        userId = match.id;
        break;
      }
      if (list.users.length < 1000) break;
      page += 1;
    }

    // Create the user if not found.
    if (!userId) {
      const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
        email: targetEmail,
        email_confirm: true,
      });
      if (error || !created.user) throw new Error("Failed to create user");
      userId = created.user.id;
    }

    const expiresAt = new Date(Date.now() + data.expiryDays * 24 * 60 * 60 * 1000).toISOString();

    const { error: upsertErr } = await supabaseAdmin
      .from("testers")
      .upsert(
        {
          user_id: userId,
          is_tester: true,
          expires_at: expiresAt,
          added_by: context.userId,
          notes: data.notes ?? null,
        },
        { onConflict: "user_id" },
      );
    if (upsertErr) throw new Error("Failed to save tester");

    return { ok: true };
  });

const RemoveInput = z.object({ id: z.string().uuid() });

export const removeTester = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => RemoveInput.parse(input))
  .handler(async ({ data, context }) => {
    assertAdmin(context.claims as Record<string, unknown>);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("testers").delete().eq("id", data.id);
    if (error) throw new Error("Failed to remove tester");
    return { ok: true };
  });

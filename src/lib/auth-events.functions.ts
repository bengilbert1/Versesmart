
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ADMIN_EMAIL = "gilbertbg@gmail.com";

function assertAdmin(claims: Record<string, unknown> | undefined) {
  const email = typeof claims?.email === "string" ? (claims.email as string).toLowerCase() : "";
  if (email !== ADMIN_EMAIL) throw new Error("Not found");
}

export type AuthEventType = "signup" | "signin";

export type AuthEventRow = {
  id: string;
  user_id: string | null;
  email: string | null;
  event_type: AuthEventType;
  method: string;
  created_at: string;
};

export const logAuthEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { event_type: AuthEventType; method: string }) => {
    if (input.event_type !== "signup" && input.event_type !== "signin") {
      throw new Error("Invalid event_type");
    }
    const method = String(input.method || "").slice(0, 40);
    if (!method) throw new Error("Missing method");
    return { event_type: input.event_type, method };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context;
    const email =
      typeof (claims as Record<string, unknown>)?.email === "string"
        ? ((claims as Record<string, unknown>).email as string)
        : null;
    const { error } = await supabase.from("auth_event_log").insert({
      user_id: userId,
      email,
      event_type: data.event_type,
      method: data.method,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export type AuthEventList = {
  todaySignups: number;
  todaySignins: number;
  events: AuthEventRow[];
};

export const listAuthEvents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { eventType?: "all" | AuthEventType; from?: string; to?: string; limit?: number }) => ({
      eventType: input.eventType ?? "all",
      from: input.from ?? null,
      to: input.to ?? null,
      limit: Math.min(Math.max(input.limit ?? 200, 1), 500),
    }),
  )
  .handler(async ({ data, context }): Promise<AuthEventList> => {
    assertAdmin(context.claims as Record<string, unknown>);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let q = supabaseAdmin
      .from("auth_event_log")
      .select("id, user_id, email, event_type, method, created_at")
      .order("created_at", { ascending: false })
      .limit(data.limit);

    if (data.eventType !== "all") q = q.eq("event_type", data.eventType);
    if (data.from) q = q.gte("created_at", data.from);
    if (data.to) q = q.lte("created_at", data.to);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    const sinceIso = startOfDay.toISOString();

    const [{ count: signupCount }, { count: signinCount }] = await Promise.all([
      supabaseAdmin
        .from("auth_event_log")
        .select("id", { count: "exact", head: true })
        .eq("event_type", "signup")
        .gte("created_at", sinceIso),
      supabaseAdmin
        .from("auth_event_log")
        .select("id", { count: "exact", head: true })
        .eq("event_type", "signin")
        .gte("created_at", sinceIso),
    ]);

    return {
      todaySignups: signupCount ?? 0,
      todaySignins: signinCount ?? 0,
      events: (rows ?? []) as AuthEventRow[],
    };
  });

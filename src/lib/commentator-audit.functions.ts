// Commentator audit — admin-only server functions.
//
// Runs the SQL `admin_commentator_audit` routine which:
//   - re-canonicalises every name_key
//   - merges any newly created duplicates
//   - removes rows whose name_key was tombstoned in `deleted_commentators`
//   - records a row in `commentator_audit_log` listing issues that still
//     need manual attention (missing portraits, etc.)
//
// Triggered manually from the Admin Panel and daily by pg_cron via
// `/api/public/hooks/commentator-audit`.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ADMIN_EMAIL = "gilbertbg@gmail.com";

function assertAdmin(claims: Record<string, unknown> | undefined) {
  const email =
    typeof claims?.email === "string" ? (claims.email as string).toLowerCase() : "";
  if (email !== ADMIN_EMAIL) throw new Error("Not found");
}

export type CommentatorAuditManualIssue = {
  type: string;
  name_key: string;
  display_name: string;
  recommendation: string;
};

export type CommentatorAuditLogRow = {
  id: string;
  ran_at: string;
  source: string;
  duplicates_found: number;
  duplicates_merged: number;
  orphaned_removed: number;
  missing_portraits: number;
  manual_issues: CommentatorAuditManualIssue[];
  notes: string | null;
};

function rowFromDb(r: Record<string, unknown>): CommentatorAuditLogRow {
  return {
    id: String(r.id),
    ran_at: String(r.ran_at),
    source: String(r.source ?? "manual"),
    duplicates_found: Number(r.duplicates_found ?? 0),
    duplicates_merged: Number(r.duplicates_merged ?? 0),
    orphaned_removed: Number(r.orphaned_removed ?? 0),
    missing_portraits: Number(r.missing_portraits ?? 0),
    manual_issues: Array.isArray(r.manual_issues)
      ? (r.manual_issues as CommentatorAuditManualIssue[])
      : [],
    notes: (r.notes as string | null) ?? null,
  };
}

export const runCommentatorAudit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CommentatorAuditLogRow> => {
    assertAdmin(context.claims as Record<string, unknown>);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: logId, error } = await supabaseAdmin.rpc("admin_commentator_audit", {
      p_source: "manual",
    });
    if (error) throw new Error(error.message);
    const { data: row, error: readErr } = await supabaseAdmin
      .from("commentator_audit_log")
      .select("*")
      .eq("id", logId as string)
      .single();
    if (readErr) throw new Error(readErr.message);
    return rowFromDb(row as Record<string, unknown>);
  });

export const listCommentatorAuditLog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CommentatorAuditLogRow[]> => {
    assertAdmin(context.claims as Record<string, unknown>);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("commentator_audit_log")
      .select("*")
      .order("ran_at", { ascending: false })
      .limit(30);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => rowFromDb(r as Record<string, unknown>));
  });

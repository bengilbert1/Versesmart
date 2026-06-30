
import { z } from "zod";
import * as React from "react";
import { render } from "@react-email/components";
import { OneTimeCodeEmail } from "@/lib/email-templates/one-time-code";

const SITE_NAME = "VerseSmart";
const SENDER_DOMAIN = "notify.versesmart.org";
const FROM_DOMAIN = "versesmart.org";
const OTP_TTL_SECONDS = 5 * 60;
const MAX_ATTEMPTS = 5;

const EmailSchema = z.object({
  email: z.string().email().max(254).transform((s) => s.trim().toLowerCase()),
});
const VerifySchema = EmailSchema.extend({
  code: z.string().regex(/^\d{6}$/, "Code must be 6 digits"),
});

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function genSixDigit(): string {
  // Cryptographically uniform 000000-999999.
  const arr = new Uint32Array(1);
  let n: number;
  do {
    crypto.getRandomValues(arr);
    n = arr[0];
  } while (n >= 0xfffffffc - (0xfffffffc % 1_000_000));
  return String(n % 1_000_000).padStart(6, "0");
}

async function getOrCreateUnsubscribeToken(
  supabaseAdmin: any,
  email: string
): Promise<string> {
  const { data: existing, error: selectError } = await supabaseAdmin
    .from("email_unsubscribe_tokens")
    .select("token")
    .eq("email", email)
    .maybeSingle();

  if (selectError) {
    console.error("otp email: unsubscribe token lookup failed", selectError);
    throw new Error("Could not prepare email. Please try again.");
  }
  if (existing?.token) return existing.token;

  const token = crypto.randomUUID();
  const { data: inserted, error: insertError } = await supabaseAdmin
    .from("email_unsubscribe_tokens")
    .insert({ email, token })
    .select("token")
    .single();

  if (!insertError && inserted?.token) return inserted.token;

  // Another request may have created the token between the read and insert.
  if (insertError?.code === "23505") {
    const { data: raced } = await supabaseAdmin
      .from("email_unsubscribe_tokens")
      .select("token")
      .eq("email", email)
      .maybeSingle();
    if (raced?.token) return raced.token;
  }

  console.error("otp email: unsubscribe token insert failed", insertError);
  throw new Error("Could not prepare email. Please try again.");
}

/**
 * Issue a fresh 6-digit OTP for an email. Stores a SHA-256 hash with a 5
 * minute expiry, invalidates older unused codes, and enqueues the email
 * through the shared queue using our OneTimeCodeEmail template.
 */
export const requestOtp = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => EmailSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = data.email;

    // Burn any prior unused codes for this address so only the newest works.
    await supabaseAdmin
      .from("otp_codes")
      .update({ used_at: new Date().toISOString() })
      .eq("email", email)
      .is("used_at", null);

    const code = genSixDigit();
    const codeHash = await sha256Hex(code);
    const expiresAt = new Date(Date.now() + OTP_TTL_SECONDS * 1000).toISOString();

    const { error: insertError } = await supabaseAdmin
      .from("otp_codes")
      .insert({ email, code_hash: codeHash, expires_at: expiresAt });
    if (insertError) {
      console.error("requestOtp: insert failed", insertError);
      throw new Error("Could not issue code. Please try again.");
    }

    // Render the email and enqueue via the existing shared queue.
    const element = React.createElement(OneTimeCodeEmail, {
      siteName: SITE_NAME,
      token: code,
    });
    const html = await render(element);
    const text = await render(element, { plainText: true });

    const messageId = crypto.randomUUID();
    const unsubscribeToken = await getOrCreateUnsubscribeToken(supabaseAdmin, email);
    await supabaseAdmin.from("email_send_log").insert({
      message_id: messageId,
      template_name: "otp",
      recipient_email: email,
      status: "pending",
    });

    // Use the transactional_emails queue (not auth_emails, which is reserved
    // for Supabase GoTrue webhook deliveries). The shared queue worker at
    // /lovable/email/queue/process already drains this queue with the
    // service-role key, so no additional permission setup is required.
    const { error: enqueueError } = await supabaseAdmin.rpc("enqueue_email", {
      queue_name: "transactional_emails",
      payload: {
        message_id: messageId,
        to: email,
        from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
        sender_domain: SENDER_DOMAIN,
        subject: `${code} is your ${SITE_NAME} one-time code`,
        html,
        text,
        purpose: "transactional",
        label: "otp",
        idempotency_key: `otp-${messageId}`,
        unsubscribe_token: unsubscribeToken,
        queued_at: new Date().toISOString(),
      },
    });

    if (enqueueError) {
      console.error("requestOtp: enqueue failed", enqueueError);
      await supabaseAdmin.from("email_send_log").insert({
        message_id: messageId,
        template_name: "otp",
        recipient_email: email,
        status: "failed",
        error_message: "Failed to enqueue email",
      });
      throw new Error("Could not send code. Please try again.");
    }

    return { ok: true };
  });

/**
 * Verify a submitted 6-digit code against our otp_codes table, mint a real
 * Supabase session for that user on the server, and return the access /
 * refresh tokens. The client sets the session with supabase.auth.setSession.
 *
 * Session minting: we call the GoTrue admin `generateLink` endpoint to obtain
 * a one-shot `hashed_token`, then immediately POST it to the GoTrue `verify`
 * endpoint server-side. The browser never sees that token and never performs
 * a token exchange itself.
 */
export const verifyOtp = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => VerifySchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      throw new Error("Server not configured");
    }

    const email = data.email;
    const codeHash = await sha256Hex(data.code);

    // Newest unused, unexpired code for this address.
    const { data: row, error: selectError } = await supabaseAdmin
      .from("otp_codes")
      .select("id, code_hash, expires_at, used_at, attempts")
      .eq("email", email)
      .is("used_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (selectError) {
      console.error("verifyOtp: select failed", selectError);
      throw new Error("Could not verify code.");
    }
    if (!row) {
      throw new Error("No active code. Please request a new one.");
    }
    if (new Date(row.expires_at).getTime() < Date.now()) {
      await supabaseAdmin
        .from("otp_codes")
        .update({ used_at: new Date().toISOString() })
        .eq("id", row.id);
      throw new Error("That code has expired. Please request a new one.");
    }
    if (row.attempts >= MAX_ATTEMPTS) {
      await supabaseAdmin
        .from("otp_codes")
        .update({ used_at: new Date().toISOString() })
        .eq("id", row.id);
      throw new Error("Too many attempts. Please request a new code.");
    }

    if (row.code_hash !== codeHash) {
      await supabaseAdmin
        .from("otp_codes")
        .update({ attempts: row.attempts + 1 })
        .eq("id", row.id);
      throw new Error("Incorrect code.");
    }

    // Mark code consumed before issuing tokens — single-use.
    await supabaseAdmin
      .from("otp_codes")
      .update({ used_at: new Date().toISOString() })
      .eq("id", row.id);

    // Ensure user exists (admin API, idempotent).
    const { data: existing, error: getUserError } = await supabaseAdmin.auth.admin
      .listUsers({ page: 1, perPage: 1 });
    if (getUserError) {
      console.error("verifyOtp: listUsers failed", getUserError);
    }
    void existing;

    // generateLink will create the user if it doesn't exist when type=magiclink
    // is requested with the admin API.
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    if (linkError || !linkData?.properties?.hashed_token) {
      console.error("verifyOtp: generateLink failed", linkError);
      throw new Error("Could not start session.");
    }

    // Exchange the hashed_token server-side for a real session.
    const verifyRes = await fetch(`${supabaseUrl}/auth/v1/verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: serviceKey,
      },
      body: JSON.stringify({
        type: "magiclink",
        token_hash: linkData.properties.hashed_token,
      }),
    });

    if (!verifyRes.ok) {
      const body = await verifyRes.text().catch(() => "");
      console.error("verifyOtp: token exchange rejected", verifyRes.status, body);
      throw new Error("Could not start session.");
    }
    const session = (await verifyRes.json()) as {
      access_token?: string;
      refresh_token?: string;
    };
    if (!session.access_token || !session.refresh_token) {
      console.error("verifyOtp: missing tokens in verify response");
      throw new Error("Could not start session.");
    }

    return {
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    };
  });

/**
 * Debug helper: enqueue a dummy OneTimeCodeEmail through the
 * transactional_emails queue and report whether the enqueue succeeded.
 * Does NOT create an otp_codes row or mint a session.
 */
export const sendTestOtpEmail = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => EmailSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = data.email;
    const dummyCode = "000000";

    const element = React.createElement(OneTimeCodeEmail, {
      siteName: SITE_NAME,
      token: dummyCode,
    });
    const html = await render(element);
    const text = await render(element, { plainText: true });

    const messageId = crypto.randomUUID();
    const queuedAt = new Date().toISOString();
    const unsubscribeToken = await getOrCreateUnsubscribeToken(supabaseAdmin, email);

    await supabaseAdmin.from("email_send_log").insert({
      message_id: messageId,
      template_name: "otp_test",
      recipient_email: email,
      status: "pending",
    });

    const { error: enqueueError } = await supabaseAdmin.rpc("enqueue_email", {
      queue_name: "transactional_emails",
      payload: {
        message_id: messageId,
        to: email,
        from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
        sender_domain: SENDER_DOMAIN,
        subject: `${dummyCode} is your ${SITE_NAME} one-time code`,
        html,
        text,
        purpose: "transactional",
        label: "otp_test",
        idempotency_key: `otp-test-${messageId}`,
        unsubscribe_token: unsubscribeToken,
        queued_at: queuedAt,
      },
    });

    if (enqueueError) {
      console.error("sendTestOtpEmail: enqueue failed", enqueueError);
      await supabaseAdmin.from("email_send_log").insert({
        message_id: messageId,
        template_name: "otp_test",
        recipient_email: email,
        status: "failed",
        error_message: "Failed to enqueue test email",
      });
      return {
        ok: false,
        messageId,
        error: "Failed to enqueue test email",
        detail: enqueueError.message,
      };
    }

    console.log("sendTestOtpEmail: enqueued", { messageId, email, queuedAt });

    // Try to read the queue batch to see if the worker has picked it up
    // (it runs every ~5s; this is best-effort immediate feedback).
    let queueStatus: "unknown" | "still_in_queue" | "worker_picked_up" = "unknown";
    try {
      const { data: batch } = await supabaseAdmin.rpc("read_email_batch", {
        queue_name: "transactional_emails",
        batch_size: 10,
        vt: 30,
      });
      const stillQueued = (batch ?? []).some(
        (m: any) => m.message?.message_id === messageId
      );
      queueStatus = stillQueued ? "still_in_queue" : "worker_picked_up";
      console.log("sendTestOtpEmail: queue peek", { messageId, queueStatus });
    } catch (peekErr) {
      console.warn("sendTestOtpEmail: queue peek failed", peekErr);
    }

    return {
      ok: true,
      messageId,
      email,
      queuedAt,
      queueStatus,
    };
  });

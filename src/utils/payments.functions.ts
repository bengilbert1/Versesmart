
import { gatewayFetch, getPaddleClient, type PaddleEnv } from "@/lib/paddle.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const resolvePaddlePrice = createServerFn({ method: "GET" })
  .inputValidator((data: { priceId: string; environment: PaddleEnv }) => data)
  .handler(async ({ data }) => {
    const response = await gatewayFetch(
      data.environment,
      `/prices?external_id=${encodeURIComponent(data.priceId)}`,
    );
    const result = (await response.json()) as { data?: Array<{ id: string }> };
    if (!result.data?.length) throw new Error(`Price not found: ${data.priceId}`);
    return result.data[0].id;
  });

export const createPortalSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;

    const { data: sub, error } = await supabaseAdmin
      .from("subscriptions")
      .select("paddle_subscription_id, paddle_customer_id, environment")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!sub) throw new Error("No subscription found");

    const env = (sub.environment as PaddleEnv) ?? "sandbox";
    const paddle = getPaddleClient(env);
    const portal = await paddle.customerPortalSessions.create(
      sub.paddle_customer_id as string,
      [sub.paddle_subscription_id as string],
    );
    return { url: portal.urls.general.overview };
  });

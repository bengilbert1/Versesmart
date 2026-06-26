import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getPaddleEnvironment } from "@/lib/paddle";
import { useAuth } from "./useAuth";
import { tierFromPriceId, type Tier } from "@/lib/tiers";

export type Subscription = {
  id: string;
  status: string;
  price_id: string;
  product_id: string;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  environment: string;
};

function computeActive(sub: Subscription | null): boolean {
  if (!sub) return false;
  const now = Date.now();
  const end = sub.current_period_end ? new Date(sub.current_period_end).getTime() : Infinity;
  if (["active", "trialing", "past_due"].includes(sub.status)) {
    return end === Infinity || end > now;
  }
  if (sub.status === "canceled") return end > now;
  return false;
}

export function useSubscription() {
  const { user, loading: authLoading } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSub = useCallback(async () => {
    if (!user) {
      setSubscription(null);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .eq("environment", getPaddleEnvironment())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setSubscription((data as Subscription | null) ?? null);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    fetchSub();
  }, [authLoading, fetchSub]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`subs-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "subscriptions", filter: `user_id=eq.${user.id}` },
        () => { fetchSub(); },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, fetchSub]);

  const ALWAYS_PRO_EMAILS = new Set(["gilbertbg@gmail.com", "shiyanirefuge@gmail.com", "dangi@mailglobex.com"]);
  const emailPro = !!user?.email && ALWAYS_PRO_EMAILS.has(user.email.toLowerCase());

  const active = computeActive(subscription);
  let tier: Tier = "free";
  if (emailPro) tier = "explore";
  else if (active) tier = tierFromPriceId(subscription?.price_id);

  return {
    subscription,
    isActive: emailPro || active,
    tier,
    loading: authLoading || loading,
    refetch: fetchSub,
  };
}

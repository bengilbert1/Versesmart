import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import { Mail, Check } from "lucide-react";

const MESSAGES = [
  "Join my irregular newsletter — I send it sporadically when inspiration strikes.",
  "Fancy an inconsistent newsletter? It will appear in your inbox like an occasional treat.",
  "If you like deep dives, you might like my irregular newsletter.",
  "A delightfully inconsistent newsletter awaits — sign up below.",
  "I promise not to email you much. Mostly because I forget.",
];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function NewsletterFooter({ user, seed }: { user: User | null; seed: string }) {
  const [isSubscribed, setIsSubscribed] = useState<boolean | null>(null);
  const [subscribing, setSubscribing] = useState(false);
  const [justSubscribed, setJustSubscribed] = useState(false);

  const order = useMemo(() => shuffle(MESSAGES), [seed]);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    setIdx(0);
  }, [seed]);

  useEffect(() => {
    const id = setInterval(() => {
      setIdx((i) => (i + 1) % order.length);
    }, 4000);
    return () => clearInterval(id);
  }, [order]);

  useEffect(() => {
    if (!user) {
      setIsSubscribed(null);
      return;
    }
    let cancelled = false;
    supabase
      .from("newsletter_subscribers")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setIsSubscribed(!!data);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const handleSubscribe = useCallback(async () => {
    if (!user?.email) return;
    setSubscribing(true);
    const { error } = await supabase.from("newsletter_subscribers").insert({
      user_id: user.id,
      email: user.email,
    });
    setSubscribing(false);
    if (!error) {
      setJustSubscribed(true);
      setIsSubscribed(true);
    }
  }, [user]);

  if (!user || isSubscribed === true) return null;

  if (justSubscribed) {
    return (
      <div className="mt-8 flex items-center justify-center gap-2 rounded-lg border border-border bg-card/40 px-4 py-4 text-xs text-agree">
        <Check className="h-3.5 w-3.5" /> You're on the list. Thanks!
      </div>
    );
  }

  return (
    <div className="mt-8 rounded-lg border border-border bg-card/40 px-4 py-5 text-center">
      <p key={idx} className="animate-fade-in text-xs text-muted-foreground/90">
        {order[idx]}
      </p>
      <button
        onClick={handleSubscribe}
        disabled={subscribing}
        className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-primary/80 transition hover:text-primary hover:underline disabled:opacity-50"
      >
        <Mail className="h-3 w-3" />
        {subscribing ? "Subscribing…" : `Subscribe with ${user.email}`}
      </button>
    </div>
  );
}

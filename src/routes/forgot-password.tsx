import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { BookOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useLanguage } from "@/lib/language-context";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({ meta: [{ title: "Reset your password — VerseSmart" }] }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return toast.error(t("authPage.enterEmailFirst"));
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    setSent(true);
    toast.success(t("authPage.checkInboxReset"));
  };

  return (
    <main className="mx-auto max-w-md px-5 py-12 sm:py-20">
      <div className="flex flex-col items-center text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
          <BookOpen className="h-6 w-6" />
        </div>
        <h1 className="mt-4 font-display text-3xl font-semibold">{t("authPage.forgotTitle")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("authPage.forgotSubtitle")}
        </p>
      </div>

      <div className="mt-8">
        {sent ? (
          <div className="rounded-xl border border-input bg-background p-4 text-sm">
            {t("authPage.resetSent", { email })}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="email"
              required
              placeholder={t("authPage.emailPlaceholder")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm"
            />
            <button
              type="submit"
              disabled={loading || !email}
              className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? t("authPage.sending") : t("authPage.sendReset")}
            </button>
          </form>
        )}
        <Link
          to="/login"
          className="mt-6 block text-center text-xs text-muted-foreground underline-offset-2 hover:underline"
        >
          {t("authPage.backToSignIn")}
        </Link>
      </div>
    </main>
  );
}

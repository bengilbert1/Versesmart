import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BookOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PasswordInput } from "@/components/PasswordInput";
import { useLanguage } from "@/lib/language-context";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({ meta: [{ title: "Set a new password — VerseSmart" }] }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [ready, setReady] = useState(false);
  const [valid, setValid] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (session && event === "SIGNED_IN")) {
        setValid(true);
        setReady(true);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setValid(true);
      setReady(true);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) return toast.error(t("authPage.passwordTooShort"));
    if (password !== confirm) return toast.error(t("authPage.passwordsDontMatch"));
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success(t("authPage.passwordUpdated"));
    navigate({ to: "/" });
  };

  return (
    <main className="mx-auto max-w-md px-5 py-12 sm:py-20">
      <div className="flex flex-col items-center text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
          <BookOpen className="h-6 w-6" />
        </div>
        <h1 className="mt-4 font-display text-3xl font-semibold">{t("authPage.resetTitle")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("authPage.resetSubtitle")}
        </p>
      </div>

      <div className="mt-8">
        {!ready ? (
          <div className="rounded-xl border border-input bg-background p-4 text-center text-sm text-muted-foreground">
            {t("authPage.verifyingLink")}
          </div>
        ) : !valid ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
              {t("authPage.invalidLink")}
            </div>
            <Link
              to="/forgot-password"
              className="block w-full rounded-xl bg-primary px-4 py-3 text-center text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              {t("authPage.requestNewLink")}
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <PasswordInput
              value={password}
              onChange={setPassword}
              placeholder={t("authPage.newPasswordPlaceholder")}
              minLength={8}
              required
              autoFocus
            />
            <PasswordInput
              value={confirm}
              onChange={setConfirm}
              placeholder={t("authPage.confirmPasswordPlaceholder")}
              minLength={8}
              required
            />
            <button
              type="submit"
              disabled={loading || !password || !confirm}
              className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? t("authPage.updating") : t("authPage.updatePassword")}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}

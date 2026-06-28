
import { useState, useEffect } from "react";
import { BookOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PasswordInput } from "@/components/PasswordInput";
import { useLanguage } from "@/lib/language-context";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Create your account — VerseSmart" },
      { name: "description", content: "Create a free VerseSmart account to save Bible verses, track your study, and compare global theological perspectives." },
      { property: "og:title", content: "Create your account — VerseSmart" },
      { property: "og:description", content: "Create a free VerseSmart account to save Bible verses, track your study, and compare global theological perspectives." },
      { property: "og:url", content: "https://versesmart.org/signup" },
    ],
    links: [{ rel: "canonical", href: "https://versesmart.org/signup" }],
  }),
  validateSearch: (s: Record<string, unknown>) => ({
    redirect: typeof s.redirect === "string" ? s.redirect : undefined,
  }),
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const { redirect } = useSearch({ from: "/signup" });
  const returnTo = redirect && redirect.startsWith("/") ? redirect : "/";
  const { t } = useLanguage();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("verse_smart_last_email");
    if (saved) setEmail(saved);
  }, []);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) return toast.error(t("authPage.passwordTooShort"));
    setLoading(true);
    try {
      sessionStorage.setItem("vs_signing_up", JSON.stringify({ method: "password" }));
    } catch {}
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}${returnTo}` },
    });
    setLoading(false);
    if (error) {
      try { sessionStorage.removeItem("vs_signing_up"); } catch {}
      return toast.error(error.message);
    }
    if (data.session) {
      toast.success(t("authPage.welcome"));
      navigate({ to: returnTo });
    } else {
      // Email confirmation pending — session will be created later; the auth
      // state listener will log the signup then.
      setSent(true);
      toast.success(t("authPage.checkInboxConfirm"));
    }
  };

  return (
    <main className="mx-auto max-w-md px-5 py-12 sm:py-20">
      <div className="flex flex-col items-center text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
          <BookOpen className="h-6 w-6" />
        </div>
        <h1 className="mt-4 font-display text-3xl font-semibold">{t("authPage.signupTitle")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("authPage.signupSubtitle")}
        </p>
      </div>

      <div className="mt-8">
        {sent ? (
          <div className="rounded-xl border border-input bg-background p-4 text-sm">
            {t("authPage.signupConfirmSent", { email })}
          </div>
        ) : (
          <form onSubmit={handleSignup} className="space-y-3">
            <input
              type="email"
              required
              placeholder={t("authPage.emailPlaceholder")}
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                localStorage.setItem("verse_smart_last_email", e.target.value);
              }}
              className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm"
            />
            <PasswordInput
              value={password}
              onChange={setPassword}
              placeholder={t("authPage.passwordMin")}
              minLength={8}
              required
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? t("authPage.creatingAccount") : t("authPage.createAccountBtn")}
            </button>
          </form>
        )}
      </div>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        {t("authPage.haveAccount")}{" "}
        <Link to="/login" search={{ redirect: returnTo }} className="font-medium underline">
          {t("authPage.signInLink")}
        </Link>
      </p>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        {t("authPage.termsAgree")}{" "}
        <Link to="/terms" className="underline">
          {t("authPage.termsLink")}
        </Link>{" "}
        {t("authPage.and")}{" "}
        <Link to="/privacy" className="underline">
          {t("authPage.privacyLink")}
        </Link>
        .
      </p>
    </main>
  );
}


import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect } from "react";
import { BookOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { toast } from "sonner";
import { PasswordInput } from "@/components/PasswordInput";
import { requestOtp, verifyOtp } from "@/lib/otp.functions";
import { useLanguage } from "@/lib/language-context";

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
      <path fill="#FBBC05" d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.997 8.997 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z"/>
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.167 6.656 3.58 9 3.58z"/>
    </svg>
  );
}

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — VerseSmart" },
      { name: "description", content: "Sign in to VerseSmart to save verses, view your history, and unlock more daily comparisons." },
      { property: "og:title", content: "Sign in — VerseSmart" },
      { property: "og:description", content: "Sign in to VerseSmart to save verses, view your history, and unlock more daily comparisons." },
      { property: "og:url", content: "https://versesmart.org/login" },
    ],
    links: [{ rel: "canonical", href: "https://versesmart.org/login" }],
  }),
  validateSearch: (s: Record<string, unknown>) => ({
    redirect: typeof s.redirect === "string" ? s.redirect : undefined,
  }),
  component: LoginPage,
});

type Mode = "choose" | "otp" | "password";

function LoginPage() {
  const navigate = useNavigate();
  const { redirect } = useSearch({ from: "/login" });
  const returnTo = redirect && redirect.startsWith("/") ? redirect : "/";
  const { t } = useLanguage();

  const [mode, setMode] = useState<Mode>("choose");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const requestOtpFn = useServerFn(requestOtp);
  const verifyOtpFn = useServerFn(verifyOtp);

  useEffect(() => {
    const saved = localStorage.getItem("verse_smart_last_email");
    if (saved) setEmail(saved);
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: returnTo });
    });
  }, [navigate, returnTo]);

  const handleGoogle = async () => {
    setLoading(true);
    try { sessionStorage.setItem("vs_signin_method", "google"); } catch {}
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin + returnTo,
      extraParams: { prompt: "select_account" },
    });
    if (result.error) {
      setLoading(false);
      try { sessionStorage.removeItem("vs_signin_method"); } catch {}
      toast.error(result.error.message ?? t("authPage.googleFailed"));
      return;
    }
    if (result.redirected) return;
    navigate({ to: returnTo });
  };

  const handlePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try { sessionStorage.setItem("vs_signin_method", "password"); } catch {}
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      try { sessionStorage.removeItem("vs_signin_method"); } catch {}
      return toast.error(error.message);
    }
    toast.success(t("authPage.welcomeBack"));
    navigate({ to: returnTo });
  };

  // Request a 6-digit code. The server function generates a fresh code,
  // stores its SHA-256 hash with a 5-minute expiry in public.otp_codes, and
  // enqueues an email via our OneTimeCodeEmail template. No magic links,
  // no PKCE, no Supabase native OTP flow.
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return toast.error(t("authPage.enterEmailFirst"));
    setLoading(true);
    try {
      await requestOtpFn({ data: { email } });
      setOtpSent(true);
      setOtp("");
      toast.success(t("authPage.otpSent", { email }) ?? "We emailed you a 6-digit code.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send code.");
    } finally {
      setLoading(false);
    }
  };

  // Verify the code against our own table on the server. On success the
  // server mints a real Supabase session and returns the tokens; we install
  // them with setSession so the browser never performs a token exchange.
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = otp.replace(/\D/g, "");
    if (code.length !== 6) {
      return toast.error(t("authPage.otpInvalid") ?? "Enter the 6-digit code.");
    }
    setLoading(true);
    try {
      const { access_token, refresh_token } = await verifyOtpFn({
        data: { email, code },
      });
      try { sessionStorage.setItem("vs_signin_method", "magic_link"); } catch {}
      const { error } = await supabase.auth.setSession({ access_token, refresh_token });
      if (error) throw error;
      toast.success(t("authPage.welcomeBack"));
      navigate({ to: returnTo });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Incorrect code.");
    } finally {
      setLoading(false);
    }
  };

  const headings = {
    choose: { title: t("authPage.signInTitle"), subtitle: t("authPage.signInSubtitle") },
    otp: { title: t("authPage.otpTitle"), subtitle: t("authPage.otpSubtitle") },
    password: { title: t("authPage.passwordTitle"), subtitle: t("authPage.passwordSubtitle") },
  }[mode];

  return (
    <main className="mx-auto max-w-md px-5 py-12 sm:py-20">
      <div className="flex flex-col items-center text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
          <BookOpen className="h-6 w-6" />
        </div>
        <h1 className="mt-4 font-display text-3xl font-semibold">{headings.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{headings.subtitle}</p>
      </div>

      {mode === "choose" && (
        <>
          <div className="mt-8 space-y-3">
            <button
              onClick={handleGoogle}
              disabled={loading}
              className="flex w-full items-center justify-center gap-3 rounded-xl border border-input bg-white px-4 py-3 text-sm font-medium text-[#1f1f1f] shadow-sm hover:bg-gray-50 disabled:opacity-50"
            >
              <GoogleIcon />
              <span>{t("authPage.signInWithGoogle")}</span>
            </button>
            <div className="relative py-1">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
              <div className="relative flex justify-center"><span className="px-2 text-xs text-muted-foreground">{t("authPage.or")}</span></div>
            </div>
            <button
              onClick={() => setMode("otp")}
              className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              {t("authPage.signInWithOneTimeCode")}
            </button>
            <button
              onClick={() => setMode("password")}
              className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm font-medium hover:bg-accent"
            >
              {t("authPage.signInWithPassword")}
            </button>
            <Link
              to="/signup"
              search={{ redirect: returnTo }}
              className="block w-full rounded-xl border border-input bg-background px-4 py-3 text-center text-sm font-medium hover:bg-accent"
            >
              {t("authPage.createAccount")}
            </Link>
          </div>
        </>
      )}

      {mode === "otp" && (
        <div className="mt-8">
          {otpSent ? (
            <form onSubmit={handleVerifyOtp} className="space-y-3">
              <div className="rounded-xl border border-input bg-background p-4 text-sm">
                {t("authPage.otpSentTo", { email }) ??
                  `We sent a 6-digit code to ${email}. Enter it below.`}
              </div>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="one-time-code"
                maxLength={6}
                required
                placeholder="123456"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="w-full rounded-xl border border-input bg-background px-4 py-3 text-center text-2xl font-mono tracking-[0.5em]"
              />
              <button
                type="submit"
                disabled={loading || otp.length !== 6}
                className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {loading ? t("authPage.signingIn") : (t("authPage.verifyAndSignIn") ?? "Verify and sign in")}
              </button>
              <button
                type="button"
                onClick={() => { setOtpSent(false); setOtp(""); }}
                className="w-full text-center text-xs text-muted-foreground underline-offset-2 hover:underline"
              >
                {t("authPage.resendOtp") ?? "Send a new code"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRequestOtp} className="space-y-3">
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
              <button
                type="submit"
                disabled={loading || !email}
                className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {loading ? t("authPage.sending") : t("authPage.sendOneTimeCode")}
              </button>
            </form>
          )}
          <BackButton onClick={() => { setMode("choose"); setOtpSent(false); setOtp(""); }} />
        </div>
      )}

      {mode === "password" && (
        <div className="mt-8">
          <form onSubmit={handlePassword} className="space-y-3">
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
              placeholder={t("authPage.passwordPlaceholder")}
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? t("authPage.signingIn") : t("authPage.signIn")}
            </button>
          </form>
          <Link
            to="/forgot-password"
            className="mt-4 block text-center text-xs text-muted-foreground underline-offset-2 hover:underline"
          >
            {t("authPage.forgotPassword")}
          </Link>
          <BackButton onClick={() => setMode("choose")} />

        </div>
      )}
    </main>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  const { t } = useLanguage();
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-6 w-full text-center text-xs text-muted-foreground underline-offset-2 hover:underline"
    >
      {t("authPage.backToOptions")}
    </button>
  );
}

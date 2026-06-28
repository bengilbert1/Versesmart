
import { useEffect } from "react";
import { Toaster } from "sonner";

import appCss from "../styles.css?url";
import { supabase } from "@/integrations/supabase/client";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { InstallHint } from "@/components/InstallHint";
import { InstallInstructionsLink } from "@/components/InstallInstructions";
import { UpdatePrompt } from "@/components/UpdatePrompt";
import { useAuth } from "@/hooks/useAuth";
import { useClientId } from "@/hooks/useClientId";
import { recordCountryVisit } from "@/lib/geo.functions";
import { logAuthEvent } from "@/lib/auth-events.functions";
import { User } from "lucide-react";
import vsLogo from "@/assets/vs-logo.jpg.asset.json";
import { AUTHOR_FALLBACK_THUMB } from "@/components/AuthorThumbnail";
import { LanguageProvider, useLanguage } from "@/lib/language-context";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { LanguageBanner } from "@/components/LanguageBanner";
import { InAppBrowserBanner } from "@/components/InAppBrowserBanner";

function NotFoundComponent() {
  const { t } = useLanguage();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">{t("notFound.heading")}</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">{t("notFound.title")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t("notFound.body")}</p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-2xl bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {t("notFound.goHome")}
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  const { t } = useLanguage();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">{t("errorPage.title")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("errorPage.body")}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-2xl bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {t("errorPage.tryAgain")}
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-2xl border border-input bg-background px-5 py-3 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            {t("errorPage.goHome")}
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "VerseSmart — Compare Every Worldview on Any Verse" },
      {
        name: "description",
        content:
          "See how different worldviews interpret the same Bible verse. Simple, fast, and beautifully clear.",
      },
      { name: "author", content: "Refuge" },
      { property: "og:title", content: "VerseSmart — Compare Every Worldview on Any Verse" },
      {
        property: "og:description",
        content:
          "See how different worldviews interpret the same Bible verse. Simple, fast, and beautifully clear.",
      },
      { property: "og:url", content: "https://www.versesmart.org" },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "VerseSmart" },
      { property: "og:image", content: "https://www.versesmart.org/og-image.png" },
      { property: "og:image:secure_url", content: "https://www.versesmart.org/og-image.png" },
      { property: "og:image:type", content: "image/png" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: "VerseSmart — Compare Every Worldview on Any Verse" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "VerseSmart — Compare Every Worldview on Any Verse" },
      {
        name: "twitter:description",
        content: "See how different worldviews interpret the same Bible verse.",
      },
      { name: "twitter:image", content: "https://www.versesmart.org/og-image.png" },
      { name: "theme-color", content: "#1e2a4a" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
      { name: "apple-mobile-web-app-title", content: "VerseSmart" },
      { name: "google-site-verification", content: "1O_PTuFZaUAHqvDfgwYBvlRFSowHs_Y2g4J_ink7uwA" },
      { name: "google-site-verification", content: "IsoSlgGMcuyYwQcJ76WULXXjpRSv_wLdfTI_HzBM5e0" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "icon", type: "image/x-icon", href: "/favicon.ico" },
      { rel: "icon", type: "image/png", sizes: "16x16", href: "/favicon-16x16.png" },
      { rel: "icon", type: "image/png", sizes: "32x32", href: "/favicon-32x32.png" },
      { rel: "icon", type: "image/png", sizes: "192x192", href: "/icon-192.png" },
      { rel: "icon", type: "image/png", sizes: "512x512", href: "/icon-512.png" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Public+Sans:wght@400;500;600;700;800&family=Playfair+Display:wght@500;600;700&display=swap",
      },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "VerseSmart",
          url: "https://versesmart.org",
          description:
            "Any Bible verse, Global perspectives, What's yours? VerseSmart lets you compare how theologians from different cultures, traditions, and worldviews interpret any Bible verse — all in one place.",
          publisher: {
            "@type": "Organization",
            name: "VerseSmart",
            url: "https://versesmart.org",
          },
        }),
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();
  const clientId = useClientId();

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      router.invalidate();
      queryClient.invalidateQueries();

      if (event === "SIGNED_IN" && session?.access_token) {
        const LOG_KEY = "vs_auth_logged_token";
        const SIGNUP_KEY = "vs_signing_up";
        try {
          if (sessionStorage.getItem(LOG_KEY) === session.access_token) return;
          sessionStorage.setItem(LOG_KEY, session.access_token);
        } catch {}
        let isSignup = false;
        let method = "password";
        try {
          const raw = sessionStorage.getItem(SIGNUP_KEY);
          if (raw) {
            const parsed = JSON.parse(raw) as { method?: string };
            isSignup = true;
            method = parsed.method ?? "password";
            sessionStorage.removeItem(SIGNUP_KEY);
          } else {
            const intent = sessionStorage.getItem("vs_signin_method");
            if (intent) {
              method = intent;
              sessionStorage.removeItem("vs_signin_method");
            } else {
              // Default for OAuth redirects (e.g. Google) where no intent was set.
              method = "oauth";
            }
          }
        } catch {}
        logAuthEvent({
          data: { event_type: isSignup ? "signup" : "signin", method },
        }).catch(() => {});
      }
    });
    return () => subscription.unsubscribe();
  }, [router, queryClient]);

  // Country tracking — one ping per session per (client, day) on the server.
  useEffect(() => {
    if (!clientId) return;
    const KEY = "vs_country_pinged";
    try {
      const today = new Date().toISOString().slice(0, 10);
      if (sessionStorage.getItem(KEY) === today) return;
      sessionStorage.setItem(KEY, today);
    } catch {}
    recordCountryVisit({ data: { clientId } }).catch(() => {});
  }, [clientId]);

  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <PaymentTestModeBanner />
        <InAppBrowserBanner />
        <LanguageBanner />
        <NavBar />
        <Outlet />
        <SiteFooter />
        <InstallHint />
        <UpdatePrompt />
        {/* Preload the static author fallback thumbnail so it renders instantly everywhere. */}
        <img src={AUTHOR_FALLBACK_THUMB} alt="" aria-hidden="true" width={1} height={1} style={{ position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none" }} />
        <Toaster richColors position="top-center" />
      </LanguageProvider>
    </QueryClientProvider>
  );
}

function NavBar() {
  const { user, loading } = useAuth();
  const { t } = useLanguage();
  return (
    <header className="bg-transparent">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-4 pr-3 sm:px-6">
        <Link to="/" aria-label="VerseSmart" className="flex items-center">
          <img
            src={vsLogo.url}
            alt="VerseSmart"
            className="h-9 w-9 shrink-0 rounded-xl object-cover"
          />
        </Link>
        <nav className="flex items-center gap-2 text-sm font-medium [&>*]:shrink-0">
          <Link
            to="/pricing"
            aria-label={t("nav.upgradeTooltip")}
            title={t("nav.upgradeTooltip")}
            className="inline-flex items-center justify-center rounded-lg border border-border bg-background px-3 py-2 text-muted-foreground hover:bg-accent hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
            >
              <path d="M9 16 V10 L12 3 L15 10 V16 H9 Z" />
              <path d="M9 19 H15" />
              <path d="M9 22 H15" />
            </svg>
          </Link>
          <LanguageSwitcher />
          {!loading &&
            (user ? (
              <Link
                to="/account"
                aria-label={t("nav.account")}
                className="relative shrink-0 whitespace-nowrap rounded-full bg-primary px-4 py-2 text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <User className="h-5 w-5" strokeWidth={1.5} />
                <span
                  aria-hidden
                  className="absolute right-1 top-1 h-2 w-2 rounded-full bg-green-500 ring-2 ring-background"
                />
                <span className="sr-only">{t("nav.signedIn") ?? "Signed in"}</span>
              </Link>
            ) : (
              <Link
                to="/login"
                aria-label={t("nav.signIn")}
                className="shrink-0 whitespace-nowrap rounded-full bg-primary px-4 py-2 text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <User className="h-5 w-5" strokeWidth={1.5} />
              </Link>
            ))}
        </nav>
      </div>
    </header>
  );
}

function SiteFooter() {
  const { t } = useLanguage();
  return (
    <footer className="bg-transparent">
      <div className="mx-auto max-w-6xl px-5 py-6 text-center text-sm sm:px-6" style={{ color: "#6A6A6A" }}>
        <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
          <InstallInstructionsLink />
          <span aria-hidden>·</span>
          <Link to="/terms" className="hover:text-foreground">
            {t("footer.terms")}
          </Link>
          <span aria-hidden>·</span>
          <Link to="/privacy" className="hover:text-foreground">
            {t("footer.privacy")}
          </Link>
          <span aria-hidden>·</span>
          <Link to="/refund" className="hover:text-foreground">
            {t("footer.refunds")}
          </Link>
          <span aria-hidden>·</span>
          <Link to="/contact" className="hover:text-foreground">
            {t("footer.contact")}
          </Link>
          <span aria-hidden>·</span>
          <Link to="/copyright" className="hover:text-foreground">
            {t("footer.sources")}
          </Link>
        </p>
        <p className="mt-3">
          <ShareAppLink />
        </p>
      </div>
    </footer>
  );
}


function ShareAppLink() {
  const { t } = useLanguage();
  const handleClick = async () => {
    const url = "https://www.versesmart.org";
    const text = "Any Bible verse, Global perspectives, What's yours? VerseSmart lets you compare how theologians from different cultures, traditions, and worldviews interpret any Bible verse — all in one place.";
    const fullText = `${text} ${url}`;
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title: "VerseSmart", text, url });
        return;
      }
    } catch {}
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(fullText);
        const { toast } = await import("sonner");
        toast(t("toasts.linkCopied"));
      }

    } catch {}
  };
  return (
    <button onClick={handleClick} className="text-xs underline-offset-2 hover:text-foreground hover:underline">
      {t("home.shareApp")}
    </button>
  );
}

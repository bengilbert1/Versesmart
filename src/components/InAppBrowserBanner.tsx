import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { isFacebookInAppBrowser } from "@/lib/in-app-browser";

const DISMISS_KEY = "vs-fb-banner-dismissed";

export function InAppBrowserBanner() {
  const [show, setShow] = useState(false);
  const [hint, setHint] = useState(false);

  useEffect(() => {
    if (!isFacebookInAppBrowser()) return;
    if (typeof sessionStorage !== "undefined" && sessionStorage.getItem(DISMISS_KEY)) return;
    setShow(true);
  }, []);

  if (!show) return null;

  const handleOpen = () => {
    const url = window.location.href;
    const ua = navigator.userAgent || "";
    const isAndroid = /Android/i.test(ua);
    const isIOS = /iPhone|iPad|iPod/i.test(ua);

    try {
      if (isAndroid) {
        // Force Android system browser via intent:// (Chrome fallback)
        const noProto = url.replace(/^https?:\/\//, "");
        const intentUrl =
          "intent://" +
          noProto +
          "#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=" +
          encodeURIComponent(url) +
          ";end";
        window.location.href = intentUrl;
        return;
      }
      if (isIOS) {
        // Force iOS Safari via x-safari-https scheme
        const safariUrl = url.replace(/^https:\/\//, "x-safari-https://").replace(/^http:\/\//, "x-safari-http://");
        window.location.href = safariUrl;
        // Fallback to standard navigation if scheme isn't handled
        setTimeout(() => {
          const win = window.open(url, "_blank");
          if (!win) setHint(true);
        }, 800);
        return;
      }
    } catch {}

    const win = window.open(url, "_blank");
    if (!win) setHint(true);
  };

  const handleDismiss = () => {
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {}
    setShow(false);
  };

  return (
    <div className="border-b border-border bg-accent/60 px-4 py-2 text-sm">
      <div className="mx-auto flex max-w-6xl items-center gap-3">
        <span className="flex-1 text-foreground">
          For a faster sign-in, open this page in your browser.
        </span>
        <button
          onClick={handleOpen}
          className="shrink-0 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
          title={hint ? "Tap the ⋯ menu and choose 'Open in Browser'." : undefined}
        >
          Open in Browser
        </button>
        <button
          onClick={handleDismiss}
          aria-label="Dismiss"
          className="shrink-0 rounded-md p-1 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      {hint && (
        <p className="mx-auto mt-1 max-w-6xl text-xs text-muted-foreground">
          Tap the ⋯ menu and choose "Open in Browser".
        </p>
      )}
    </div>
  );
}

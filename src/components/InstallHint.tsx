import { useEffect, useState } from "react";
import { Download, X, Share } from "lucide-react";

const DISMISS_KEY = "vs_install_hint_dismissed_at";
const DISMISS_DAYS = 14;

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  // iOS
  if ((window.navigator as any).standalone) return true;
  // Android / desktop
  return window.matchMedia?.("(display-mode: standalone)").matches ?? false;
}

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
}

function isMobile(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function isDismissedRecently(): boolean {
  try {
    const ts = localStorage.getItem(DISMISS_KEY);
    if (!ts) return false;
    const ageMs = Date.now() - Number(ts);
    return ageMs < DISMISS_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

export function InstallHint() {
  const [show, setShow] = useState(false);
  const [bip, setBip] = useState<BIPEvent | null>(null);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    if (isStandalone() || !isMobile() || isDismissedRecently()) return;

    const onBip = (e: Event) => {
      e.preventDefault();
      setBip(e as BIPEvent);
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", onBip);

    if (isIOS()) {
      setIos(true);
      // iOS never fires beforeinstallprompt — show after a short delay
      const t = window.setTimeout(() => setShow(true), 2500);
      return () => {
        window.removeEventListener("beforeinstallprompt", onBip);
        window.clearTimeout(t);
      };
    }

    return () => window.removeEventListener("beforeinstallprompt", onBip);
  }, []);

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch {}
    setShow(false);
  };

  const install = async () => {
    if (!bip) return;
    try {
      await bip.prompt();
      await bip.userChoice;
    } finally {
      dismiss();
    }
  };

  if (!show) return null;

  return (
    <div className="fixed inset-x-3 bottom-3 z-40 sm:left-auto sm:right-4 sm:bottom-4 sm:max-w-sm">
      <div className="rounded-2xl border border-border bg-card shadow-lg">
        <div className="flex items-start gap-3 p-4">
          <div className="mt-0.5 flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Download className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-foreground">Install Verse Smart</div>
            {ios ? (
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Tap <Share className="inline h-3.5 w-3.5 align-[-2px]" /> Share, then{" "}
                <span className="font-medium text-foreground">Add to Home Screen</span> for an app-like experience.
              </p>
            ) : (
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Add it to your home screen for one-tap access.
              </p>
            )}
            {!ios && bip && (
              <button
                onClick={install}
                className="mt-3 inline-flex items-center justify-center rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
              >
                Install
              </button>
            )}
          </div>
          <button
            onClick={dismiss}
            aria-label="Dismiss"
            className="-mr-1 -mt-1 rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

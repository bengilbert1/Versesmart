import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useT } from "@/lib/language-context";


const POLL_MS = 60_000; // check every minute

// Extract a stable build fingerprint from index.html: the set of hashed asset URLs.
function fingerprint(html: string): string {
  const matches = html.match(/\/_build\/[^"'\s)]+|\/assets\/[^"'\s)]+/g);
  if (!matches || matches.length === 0) return "";
  return Array.from(new Set(matches)).sort().join("|");
}

async function fetchFingerprint(): Promise<string> {
  try {
    const res = await fetch("/", { cache: "no-store", headers: { Accept: "text/html" } });
    if (!res.ok) return "";
    return fingerprint(await res.text());
  } catch {
    return "";
  }
}

export function UpdatePrompt() {
  const initial = useRef<string>("");
  const prompted = useRef(false);
  const t = useT();

  useEffect(() => {
    if (typeof window === "undefined") return;

    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | undefined;

    const check = async () => {
      if (prompted.current || document.hidden) return;
      const current = await fetchFingerprint();
      if (cancelled || !current) return;
      if (!initial.current) {
        initial.current = current;
        return;
      }
      if (current !== initial.current) {
        prompted.current = true;
        toast(t("toasts.updateAvailableTitle"), {
          description: t("toasts.updateAvailableDesc"),
          duration: Infinity,
          action: {
            label: t("toasts.updateReload"),
            onClick: () => window.location.reload(),
          },
        });
      }
    };


    // Seed the initial fingerprint, then poll.
    void check();
    timer = setInterval(check, POLL_MS);
    const onVisible = () => {
      if (!document.hidden) void check();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return null;
}

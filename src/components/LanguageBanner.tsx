import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useLanguage } from "@/lib/language-context";
import { getLanguage, suggestedLanguageFromCountry, UI_STRINGS } from "@/lib/languages";
import { getVisitorCountry } from "@/lib/geo.functions";

const DISMISS_KEY = "vs-language-banner-dismissed";

export function LanguageBanner() {
  const { language, setLanguage } = useLanguage();
  const fetchCountry = useServerFn(getVisitorCountry);
  const [dismissed, setDismissed] = useState(true); // start true to avoid SSR flash

  useEffect(() => {
    try {
      setDismissed(window.localStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, []);

  const geo = useQuery({
    queryKey: ["visitor-country"],
    queryFn: () => fetchCountry(),
    staleTime: 1000 * 60 * 60 * 24,
    enabled: !dismissed,
  });

  const suggested = suggestedLanguageFromCountry(geo.data?.country);

  // Only show when geo suggests a different language than the one currently chosen.
  if (dismissed || !suggested || suggested === language) return null;

  const suggestedConfig = getLanguage(suggested);
  // Render the prompt in the suggested language so they recognize it instantly.
  const strings = UI_STRINGS[suggested];

  const dismiss = () => {
    setDismissed(true);
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="border-b border-border bg-primary/5">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-5 py-2 text-sm sm:px-6">
        <span className="font-medium">{strings.switchTo}</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setLanguage(suggested);
              dismiss();
            }}
            className="rounded-md bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
          >
            {suggestedConfig.nativeName}
          </button>
          <button
            onClick={dismiss}
            className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-accent"
            aria-label={UI_STRINGS[suggested]?.switchTo ?? "Dismiss"}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

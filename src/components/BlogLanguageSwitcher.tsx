import { GlobeAltIcon } from "@heroicons/react/24/outline";
import { Check } from "lucide-react";
import { useState } from "react";

import { LANGUAGES, type LanguageCode } from "@/lib/languages";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";

interface Props {
  currentLang: LanguageCode;
  slug?: string;
}

/**
 * Language selector specific to blog pages.
 *
 * Stays permanently visible at the top of every blog page (list + post,
 * in every language) and navigates to the matching static translation
 * route generated at publish time. No runtime AI calls.
 */
export function BlogLanguageSwitcher({ currentLang, slug }: Props) {
  const { setLanguage } = useLanguage();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const handleSelect = (code: LanguageCode) => {
    setLanguage(code);
    setOpen(false);
    if (code === "en") {
      if (slug) navigate({ to: "/blog/$slug", params: { slug } });
      else navigate({ to: "/blog" });
    } else {
      if (slug) navigate({ to: "/blog/lang/$lang/$slug", params: { lang: code, slug } });
      else navigate({ to: "/blog/lang/$lang", params: { lang: code } });
    }
  };

  const active = LANGUAGES.find((l) => l.code === currentLang) ?? LANGUAGES[0];

  return (
    <div className="mb-6 flex items-center justify-end">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring"
            aria-label="Select blog language"
          >
            <GlobeAltIcon className="h-4 w-4" />
            <span>{active.nativeName}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-48 p-1">
          <div className="flex flex-col">
            {LANGUAGES.map((l) => (
              <button
                key={l.code}
                onClick={() => handleSelect(l.code)}
                className={`flex items-center justify-between rounded-md px-3 py-2 text-sm ${
                  l.code === currentLang
                    ? "bg-accent font-medium text-accent-foreground"
                    : "text-foreground hover:bg-accent/50"
                }`}
              >
                <span>{l.nativeName}</span>
                {l.code === currentLang && <Check className="h-4 w-4" />}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

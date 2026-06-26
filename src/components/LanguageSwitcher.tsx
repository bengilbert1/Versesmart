import { GlobeAltIcon } from "@heroicons/react/24/outline";
import { Check } from "lucide-react";
import { useState } from "react";
import { useLanguage } from "@/lib/language-context";
import { LANGUAGES, type LanguageCode } from "@/lib/languages";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";

export function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();
  const [open, setOpen] = useState(false);

  const handleSelect = (code: LanguageCode) => {
    setLanguage(code);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-lg border border-border bg-background px-3 py-2 text-muted-foreground hover:bg-accent hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          aria-label="Select language"
        >
          <GlobeAltIcon className="h-5 w-5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-48 p-1">
        <div className="flex flex-col">
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              onClick={() => handleSelect(l.code)}
              className={`flex items-center justify-between rounded-md px-3 py-2 text-sm ${
                l.code === language
                  ? "bg-accent font-medium text-accent-foreground"
                  : "text-foreground hover:bg-accent/50"
              }`}
            >
              <span>{l.nativeName}</span>
              {l.code === language && <Check className="h-4 w-4" />}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, HelpCircle, Loader2 } from "lucide-react";
import { BIBLE_BOOKS } from "@/lib/bible-books";
import { getVerseCount } from "@/lib/bible-verse-counts";
import { localizedBookName } from "@/lib/bible-book-i18n";
import { parseReference } from "@/lib/parse-reference";
import { useLanguage } from "@/lib/language-context";

type Props = {
  value: string;
  onChange: (v: string) => void;
  onSubmit: (normalizedRef: string) => void;
  disabled?: boolean;
  pending?: boolean;
  label?: string;
  submitLabel?: string;
};

type Suggestion = {
  /** Display string shown in dropdown */
  display: string;
  /** Value placed in input when chosen */
  value: string;
  /** Hint shown right side */
  hint?: string;
};

function norm(s: string): string {
  return s.toLowerCase().replace(/\./g, "").replace(/\s+/g, "");
}

// Extract leading "book" portion and remainder
function splitInput(input: string): { bookRaw: string; rest: string } {
  const m = input.match(/^\s*((?:[1-3]\s*)?[\p{L}][\p{L}\s.]*?)\s*([0-9].*)?$/u);
  if (!m) return { bookRaw: input.trim(), rest: "" };
  return { bookRaw: (m[1] ?? "").trim(), rest: (m[2] ?? "").trim() };
}

export function SmartVerseInput({
  value,
  onChange,
  onSubmit,
  disabled,
  pending,
  label,
  submitLabel = "Compare",
}: Props) {
  const { language, t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const [blockClickUntil, setBlockClickUntil] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Localized -> English book map for the active language
  const localizedToEnglish = useMemo(() => {
    const map = new Map<string, string>();
    for (const b of BIBLE_BOOKS) {
      map.set(norm(localizedBookName(b.name, language)), b.name);
      map.set(norm(b.name), b.name);
    }
    return map;
  }, [language]);

  // Resolve a localized/English book typed by the user → canonical English name
  function resolveTypedBook(raw: string): string | null {
    const key = norm(raw);
    if (!key) return null;
    if (localizedToEnglish.has(key)) return localizedToEnglish.get(key)!;
    // Prefix
    const hits: string[] = [];
    for (const [k, en] of localizedToEnglish) {
      if (k.startsWith(key)) hits.push(en);
    }
    if (hits.length === 1) return hits[0];
    return null;
  }

  // Build suggestions based on input state
  const suggestions = useMemo<Suggestion[]>(() => {
    const raw = value;
    const { bookRaw, rest } = splitInput(raw);

    if (!bookRaw) {
      // Show all books so the user can scroll the full list
      return BIBLE_BOOKS.map((b) => ({
        display: localizedBookName(b.name, language),
        value: localizedBookName(b.name, language) + " ",
        hint: `${b.chapters} ${t("smartInput.chaptersHint")}`,
      }));
    }

    if (!rest) {
      const key = norm(bookRaw);

      // If the typed/tapped book exactly matches a known book, jump straight
      // to chapter selection so book → chapter → verse works by tapping alone.
      const exact = resolveTypedBook(bookRaw);
      if (exact && norm(localizedBookName(exact, language)) === key) {
        const localBook = localizedBookName(exact, language);
        const meta = BIBLE_BOOKS.find((b) => b.name === exact)!;
        const list: Suggestion[] = [];
        for (let c = 1; c <= meta.chapters; c++) {
          list.push({
            display: `${localBook} ${c}`,
            value: `${localBook} ${c}`,
            hint: `${getVerseCount(exact, c)} ${t("smartInput.versesHint")}`,
          });
        }
        return list;
      }

      const matches = BIBLE_BOOKS.filter((b) => {
        const local = norm(localizedBookName(b.name, language));
        const en = norm(b.name);
        return local.startsWith(key) || en.startsWith(key) || local.includes(key);
      });
      if (matches.length === 0) {
        return BIBLE_BOOKS.map((b) => ({
          display: localizedBookName(b.name, language),
          value: localizedBookName(b.name, language) + " ",
        }));
      }
      return matches.map((b) => ({
        display: localizedBookName(b.name, language),
        value: localizedBookName(b.name, language) + " ",
        hint: `${b.chapters} ${t("smartInput.chaptersHint")}`,
      }));
    }

    // We have a book + numeric tail. Resolve book.
    const englishBook = resolveTypedBook(bookRaw);
    if (!englishBook) return [];
    const localBook = localizedBookName(englishBook, language);
    const meta = BIBLE_BOOKS.find((b) => b.name === englishBook)!;

    // Parse rest: "3", "3:", "3:1", "3:1-", "3:1-5", "3-", "3-5"
    const restNorm = rest.replace(/[–—−]/g, "-").replace(/\s+/g, "");
    // After colon (verse mode)
    const colonIdx = restNorm.indexOf(":");
    if (colonIdx === -1) {
      // chapter or chapter range
      const dashIdx = restNorm.indexOf("-");
      if (dashIdx === -1) {
        // typing chapter
        const chStr = restNorm;
        const chNum = parseInt(chStr, 10);
        // Suggest chapters that start with chStr — show all so user can scroll
        const list: Suggestion[] = [];
        for (let c = 1; c <= meta.chapters; c++) {
          if (chStr === "" || String(c).startsWith(chStr)) {
            list.push({
              display: `${localBook} ${c}`,
              value: `${localBook} ${c}`,
              hint: `${getVerseCount(englishBook, c)} ${t("smartInput.versesHint")}`,
            });
          }
        }
        // If full chapter typed, offer ":" to pick verse and "-" for chapter range
        if (!isNaN(chNum) && chNum >= 1 && chNum <= meta.chapters && String(chNum) === chStr) {
          if (chNum < meta.chapters) {
            list.unshift({
              display: `${localBook} ${chNum}-_`,
              value: `${localBook} ${chNum}-`,
              hint: t("smartInput.pickChapterRange") ?? "pick end chapter",
            });
          }
          list.unshift({
            display: `${localBook} ${chNum}:_`,
            value: `${localBook} ${chNum}:`,
            hint: t("smartInput.pickVerse"),
          });
        }
        return list;
      } else {
        // chapter range
        const startCh = parseInt(restNorm.slice(0, dashIdx), 10);
        const endStr = restNorm.slice(dashIdx + 1);
        if (isNaN(startCh)) return [];
        const list: Suggestion[] = [];
        for (let c = startCh + 1; c <= meta.chapters; c++) {
          if (endStr === "" || String(c).startsWith(endStr)) {
            list.push({
              display: `${localBook} ${startCh}-${c}`,
              value: `${localBook} ${startCh}-${c}`,
            });
          }
        }
        return list;
      }
    } else {
      // verse mode
      const chStr = restNorm.slice(0, colonIdx);
      const afterColon = restNorm.slice(colonIdx + 1);
      const chNum = parseInt(chStr, 10);
      if (isNaN(chNum) || chNum < 1 || chNum > meta.chapters) return [];
      const vMax = getVerseCount(englishBook, chNum);
      const dashIdx = afterColon.indexOf("-");
      if (dashIdx === -1) {
        // typing single verse — show all matching verses so user can scroll
        const vStr = afterColon;
        const vNum = parseInt(vStr, 10);
        const list: Suggestion[] = [];
        for (let v = 1; v <= vMax; v++) {
          if (vStr === "" || String(v).startsWith(vStr)) {
            list.push({
              display: `${localBook} ${chNum}:${v}`,
              value: `${localBook} ${chNum}:${v}`,
            });
          }
        }
        // If exact verse typed, offer "-" to start a verse range by tap
        if (!isNaN(vNum) && vNum >= 1 && vNum < vMax && String(vNum) === vStr) {
          list.unshift({
            display: `${localBook} ${chNum}:${vNum}-_`,
            value: `${localBook} ${chNum}:${vNum}-`,
            hint: "pick a verse range",
          });
        }
        return list;
      } else {
        // verse range — show all matching ranges so user can scroll
        const startV = parseInt(afterColon.slice(0, dashIdx), 10);
        const endStr = afterColon.slice(dashIdx + 1);
        if (isNaN(startV)) return [];
        const list: Suggestion[] = [];
        for (let v = startV + 1; v <= vMax; v++) {
          if (endStr === "" || String(v).startsWith(endStr)) {
            list.push({
              display: `${localBook} ${chNum}:${startV}-${v}`,
              value: `${localBook} ${chNum}:${startV}-${v}`,
            });
          }
        }
        return list;
      }
    }
  }, [value, language, localizedToEnglish, t]);

  // Convert localized-book input -> English-canonical for parseReference,
  // then attempt to validate.
  const validation = useMemo(() => {
    const raw = value.trim();
    if (!raw) return null;
    const { bookRaw, rest } = splitInput(raw);
    const en = resolveTypedBook(bookRaw);
    const candidate = en ? `${en}${rest ? " " + rest : ""}` : raw;
    const parsed = parseReference(candidate);
    return parsed;
  }, [value, localizedToEnglish]);

  // Reset active idx when suggestions change
  useEffect(() => {
    setActiveIdx(0);
  }, [value]);

  function safeSetOpen(v: boolean) {
    setOpen(v);
    if (v) setBlockClickUntil(Date.now() + 150);
  }

  // Click outside to close suggestions and help
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setShowHelp(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function chooseSuggestion(s: Suggestion) {
    if (Date.now() < blockClickUntil) return; // ignore accidental taps right after open
    onChange(s.value);
    inputRef.current?.focus();
    // Keep open so user can continue typing chapter/verse
    safeSetOpen(true);
  }

  function handleSubmit() {
    if (validation && validation.ok) {
      onSubmit(validation.reference);
      setOpen(false);
    } else if (value.trim()) {
      // Let parent attempt; backend may handle it
      onSubmit(value.trim());
      setOpen(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || suggestions.length === 0) {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSubmit();
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = Math.min(activeIdx + 1, suggestions.length - 1);
      setActiveIdx(next);
      // Scroll active item into view
      requestAnimationFrame(() => {
        const el = document.getElementById(`svi-opt-${next}`);
        el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const prev = Math.max(activeIdx - 1, 0);
      setActiveIdx(prev);
      requestAnimationFrame(() => {
        const el = document.getElementById(`svi-opt-${prev}`);
        el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      });
    } else if (e.key === "Enter") {
      e.preventDefault();
      // If user has typed a complete valid ref, submit; else accept suggestion
      if (validation?.ok && value.trim() === validation.reference) {
        handleSubmit();
      } else {
        chooseSuggestion(suggestions[activeIdx]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    } else if (e.key === "Tab") {
      if (suggestions[activeIdx]) {
        e.preventDefault();
        chooseSuggestion(suggestions[activeIdx]);
      }
    }
  }

  const showError =
    value.trim().length > 0 && validation && !validation.ok;
  const showSuggestionHint =
    validation?.ok && validation.suggestion && validation.suggestion !== value.trim();

  return (
    <div ref={wrapRef} className="relative">
      {label && (
        <label htmlFor="smart-verse-input" className="block text-sm font-medium text-foreground">
          {label}
        </label>
      )}
      <div className="mt-2 flex gap-2">
        <div className="relative flex-1">
          <input
            ref={inputRef}
            id="smart-verse-input"
            type="text"
            value={value}
            onChange={(e) => {
              onChange(e.target.value);
              safeSetOpen(true);
            }}
            onFocus={() => safeSetOpen(true)}
            onKeyDown={onKeyDown}
            placeholder={t("smartInput.placeholder")}
            autoComplete="off"
            spellCheck={false}
            disabled={disabled}
            aria-autocomplete="list"
            aria-expanded={open}
            aria-controls="smart-verse-listbox"
            className="w-full rounded-xl border border-white/70 bg-white/70 px-4 py-3 pr-10 text-base outline-none transition shadow-[0_4px_16px_-8px_rgba(47,72,88,0.18)] backdrop-blur focus:ring-2 focus:ring-ring disabled:opacity-50"
          />
          <button
            type="button"
            onClick={() => setShowHelp((v) => !v)}
            aria-label={t("smartInput.helpAria")}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            tabIndex={-1}
          >
            <HelpCircle className="h-4 w-4" />
          </button>

          {open && suggestions.length > 0 && (
            <ul
              id="smart-verse-listbox"
              role="listbox"
              className="absolute z-30 mt-1 max-h-72 w-full touch-pan-y overflow-y-auto overscroll-contain rounded-xl border border-border bg-popover py-1 text-sm shadow-lg"
            >
              {suggestions.map((s, i) => (
                <li
                  key={`${s.value}-${i}`}
                  id={`svi-opt-${i}`}
                  role="option"
                  aria-selected={i === activeIdx}
                  onPointerDown={(e) => {
                    if (e.pointerType === "mouse") return;
                    (e.currentTarget as HTMLElement).dataset.px = String(e.clientX);
                    (e.currentTarget as HTMLElement).dataset.py = String(e.clientY);
                  }}
                  onPointerUp={(e) => {
                    if (e.pointerType === "mouse") return;
                    const el = e.currentTarget as HTMLElement;
                    const sx = Number(el.dataset.px ?? 0);
                    const sy = Number(el.dataset.py ?? 0);
                    const dx = Math.abs(e.clientX - sx);
                    const dy = Math.abs(e.clientY - sy);
                    if (dx < 8 && dy < 8) {
                      e.preventDefault();
                      chooseSuggestion(s);
                    }
                  }}
                  onClick={(e) => {
                    // Mouse click path (touch handled in pointerup)
                    if ((e.nativeEvent as PointerEvent).pointerType && (e.nativeEvent as PointerEvent).pointerType !== "mouse") return;
                    chooseSuggestion(s);
                  }}
                  onMouseEnter={() => setActiveIdx(i)}
                  className={`flex cursor-pointer items-center justify-between px-3 py-2 ${
                    i === activeIdx ? "bg-accent text-foreground" : "text-foreground"
                  }`}
                >
                  <span>{s.display}</span>
                  {s.hint && <span className="ml-3 text-xs text-muted-foreground">{s.hint}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={disabled || !value.trim()}
          className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              {submitLabel} <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </div>

      {showHelp && (
        <div className="mt-2 rounded-xl border border-border bg-card p-3 text-xs text-muted-foreground">
          <p className="mb-1 font-semibold text-foreground">
            {t("smartInput.examplesTitle")}
          </p>
          <ul className="space-y-0.5">
            <li>• John 3:16 — {t("smartInput.exSingle")}</li>
            <li>• John 3:16–18 — {t("smartInput.exRange")}</li>
            <li>• John 3 — {t("smartInput.exChapter")}</li>
            <li>• Romans 8–12 — {t("smartInput.exMultiCh")}</li>
            <li>• John — {t("smartInput.exBook")}</li>
          </ul>
        </div>
      )}

      {showError && (
        <p className="mt-2 text-xs text-destructive">
          {validation!.error}
        </p>
      )}
      {showSuggestionHint && (
        <button
          type="button"
          onClick={() => onChange(validation!.suggestion!)}
          className="mt-2 text-xs text-primary hover:underline"
        >
          {t("smartInput.didYouMean")} {validation!.suggestion}?
        </button>
      )}
    </div>
  );
}

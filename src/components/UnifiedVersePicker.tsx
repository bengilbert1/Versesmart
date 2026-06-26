import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, ChevronLeft, Loader2, Search, X } from "lucide-react";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { BIBLE_BOOKS } from "@/lib/bible-books";
import { getVerseCount } from "@/lib/bible-verse-counts";
import { localizedBookName } from "@/lib/bible-book-i18n";
import { parseReference } from "@/lib/parse-reference";
import { useLanguage } from "@/lib/language-context";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

/** Normalized structured output. */
export type NormalizedRef = {
  /** Canonical English book name (matches BIBLE_BOOKS[].name). */
  book: string;
  /** Selected chapters (sorted ascending), or "ALL" for whole book. */
  chapters: number[] | "ALL";
  /** Selected verses within a single chapter, or "ALL". */
  verses: number[] | "ALL";
};

type Props = {
  value: string;
  onChange: (v: string) => void;
  /** Called with both a backend-friendly string and the structured object. */
  onSubmit: (ref: string, structured?: NormalizedRef) => void;
  onCancel?: () => void;
  disabled?: boolean;
  pending?: boolean;
  submitLabel?: string;
  label?: string;
  placeholder?: string;
  leftAccessory?: React.ReactNode;
};


type Step = "book" | "chapter" | "verse";

function norm(s: string): string {
  return s.toLowerCase().replace(/\./g, "").replace(/\s+/g, "");
}

function buildRefString(book: string, chapters: number[] | "ALL", verses: number[] | "ALL"): string {
  if (chapters === "ALL") return book;
  if (chapters.length === 0) return book;
  const sorted = [...chapters].sort((a, b) => a - b);
  if (sorted.length > 1) {
    const isContig = sorted.every((c, i) => i === 0 || c === sorted[i - 1] + 1);
    return isContig
      ? `${book} ${sorted[0]}-${sorted[sorted.length - 1]}`
      : `${book} ${sorted.join(",")}`;
  }
  const ch = sorted[0];
  if (verses === "ALL" || verses.length === 0) return `${book} ${ch}`;
  const vs = [...verses].sort((a, b) => a - b);
  if (vs.length === 1) return `${book} ${ch}:${vs[0]}`;
  const isContig = vs.every((v, i) => i === 0 || v === vs[i - 1] + 1);
  return isContig
    ? `${book} ${ch}:${vs[0]}-${vs[vs.length - 1]}`
    : `${book} ${ch}:${vs.join(",")}`;
}

/** True if the structured selection is supported by the commentary backend. */
function isBackendSupported(n: NormalizedRef): boolean {
  if (n.chapters === "ALL") return false;
  if (n.chapters.length === 0) return false;
  if (n.chapters.length > 1) return false;
  // Single chapter, with optional verse range
  if (n.verses === "ALL") return true;
  return true;
}

export function UnifiedVersePicker({
  value,
  onChange,
  onSubmit,
  onCancel,
  disabled,
  pending,
  submitLabel,
  label,
  placeholder,
  leftAccessory,
}: Props) {
  const { language, t } = useLanguage();
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("book");
  const [book, setBook] = useState<string | null>(null);
  const [chapters, setChapters] = useState<number[]>([]);
  const [verseRange, setVerseRange] = useState<[number, number] | null>(null);
  const [verseAnchor, setVerseAnchor] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [blockMsg, setBlockMsg] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFired = useRef(false);

  function clearLongPress() {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  function extendRangeTo(v: number) {
    const anchor = verseAnchor ?? (verseRange ? verseRange[0] : v);
    const lo = Math.min(anchor, v);
    const hi = Math.max(anchor, v);
    setVerseRange([lo, hi]);
  }

  const submitText = submitLabel ?? t("versePicker.compare");

  useEffect(() => {
    if (open) {
      setStep("book");
      setBook(null);
      setChapters([]);
      setVerseRange(null);
      setVerseAnchor(null);
      setSearch("");
      setBlockMsg(null);
    }
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [step]);

  const localBookName = (en: string) => localizedBookName(en, language);

  // ----- Search parsing -----
  const localizedToEnglish = useMemo(() => {
    const map = new Map<string, string>();
    for (const b of BIBLE_BOOKS) {
      map.set(norm(localizedBookName(b.name, language)), b.name);
      map.set(norm(b.name), b.name);
    }
    return map;
  }, [language]);

  function resolveTypedBook(raw: string): string | null {
    const key = norm(raw);
    if (!key) return null;
    if (localizedToEnglish.has(key)) return localizedToEnglish.get(key)!;
    const hits: string[] = [];
    for (const [k, en] of localizedToEnglish) if (k.startsWith(key)) hits.push(en);
    return hits.length === 1 ? hits[0] : null;
  }

  const parsedSearch = useMemo(() => {
    const raw = search.trim();
    if (!raw) return null;
    const m = raw.match(/^\s*((?:[1-3]\s*)?[\p{L}][\p{L}\s.]*?)\s*([0-9].*)?$/u);
    const bookRaw = m?.[1]?.trim() ?? raw;
    const rest = m?.[2]?.trim() ?? "";
    const en = resolveTypedBook(bookRaw);
    const candidate = en ? `${en}${rest ? " " + rest : ""}` : raw;
    return parseReference(candidate);
  }, [search, localizedToEnglish]);

  const filteredBooks = useMemo(() => {
    const q = norm(search);
    if (!q) return BIBLE_BOOKS;
    return BIBLE_BOOKS.filter((b) => {
      const local = norm(localizedBookName(b.name, language));
      return local.includes(q) || norm(b.name).includes(q);
    });
  }, [search, language]);

  // ----- Selection helpers -----
  function pickBook(en: string) {
    setBook(en);
    setChapters([]);
    setVerseRange(null);
    setVerseAnchor(null);
    setStep("chapter");
    setBlockMsg(null);
  }

  function toggleChapter(c: number, multi: boolean) {
    if (!book) return;
    if (multi) {
      setChapters((prev) => {
        if (prev.includes(c)) return prev.filter((x) => x !== c);
        return [...prev, c].sort((a, b) => a - b);
      });
      setVerseRange(null);
      setVerseAnchor(null);
    } else {
      setChapters([c]);
      const vMax = getVerseCount(book, c);
      setVerseRange([1, vMax]);
      setVerseAnchor(null);
      setStep("verse");
    }
    setBlockMsg(null);
  }

  function selectWholeBook() {
    if (!book) return;
    const meta = BIBLE_BOOKS.find((b) => b.name === book)!;
    setChapters(Array.from({ length: meta.chapters }, (_, i) => i + 1));
    setVerseRange(null);
  }

  function tryCommit(structured: NormalizedRef) {
    if (!isBackendSupported(structured)) {
      setBlockMsg(t("versePicker.narrowMsg"));
      return;
    }
    const refStr = buildRefString(structured.book, structured.chapters, structured.verses);
    onChange(refStr);
    onSubmit(refStr, structured);
    setOpen(false);
  }

  function commitFromState() {
    if (!book) return;
    const meta = BIBLE_BOOKS.find((b) => b.name === book)!;
    const isWholeBook =
      chapters.length === meta.chapters &&
      chapters.every((c, i) => c === i + 1);
    const structured: NormalizedRef = {
      book,
      chapters: isWholeBook ? "ALL" : chapters,
      verses: verseRange
        ? (() => {
            if (chapters.length !== 1) return "ALL" as const;
            const ch = chapters[0];
            const vMax = getVerseCount(book, ch);
            const [a, b] = verseRange;
            if (a === 1 && b === vMax) return "ALL" as const;
            return Array.from({ length: b - a + 1 }, (_, i) => a + i);
          })()
        : "ALL",
    };
    tryCommit(structured);
  }

  function commitWholeChapter() {
    if (!book || chapters.length !== 1) return;
    tryCommit({ book, chapters, verses: "ALL" });
  }

  function commitFromParsedSearch() {
    if (!parsedSearch || !parsedSearch.ok) return;
    const p = parsedSearch;
    const meta = BIBLE_BOOKS.find((b) => b.name === p.book);
    if (!meta) return;
    let chs: number[] | "ALL";
    let vs: number[] | "ALL";
    if (p.endChapter && p.verse === undefined) {
      chs = Array.from({ length: p.endChapter - p.chapter + 1 }, (_, i) => p.chapter + i);
      vs = "ALL";
    } else {
      chs = [p.chapter];
      if (p.verse === undefined) {
        vs = "ALL";
      } else if (p.endVerse) {
        vs = Array.from({ length: p.endVerse - p.verse + 1 }, (_, i) => p.verse! + i);
      } else {
        vs = [p.verse];
      }
    }
    tryCommit({ book: p.book, chapters: chs, verses: vs });
  }

  // ----- Header -----
  const headerLabel = useMemo(() => {
    if (step === "book" || !book) return t("versePicker.selectBook");
    if (step === "chapter") return `${localBookName(book)} · ${t("versePicker.chapter")}`;
    if (step === "verse" && chapters.length === 1)
      return `${localBookName(book)} ${chapters[0]} · ${t("versePicker.verse")}`;
    return t("versePicker.selectBook");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, book, chapters, language, t]);

  function back() {
    if (step === "verse") {
      setVerseRange(null);
      setStep("chapter");
    } else if (step === "chapter") {
      setBook(null);
      setChapters([]);
      setStep("book");
    }
  }

  const meta = book ? BIBLE_BOOKS.find((b) => b.name === book) : null;
  const verseMax = book && chapters.length === 1 ? getVerseCount(book, chapters[0]) : 0;

  const previewRef =
    book && chapters.length > 0
      ? buildRefString(
          book,
          chapters.length === (meta?.chapters ?? -1) && chapters.every((c, i) => c === i + 1)
            ? "ALL"
            : chapters,
          verseRange && chapters.length === 1
            ? (() => {
                const [a, b] = verseRange;
                if (a === 1 && b === verseMax) return "ALL" as const;
                return Array.from({ length: b - a + 1 }, (_, i) => a + i);
              })()
            : "ALL",
        )
      : null;

  return (
    <div>
      {label && <label className="block text-sm font-medium text-foreground">{label}</label>}
      <div className="mt-2 flex gap-2">
        {leftAccessory}
        <button
          id="verse-picker-trigger"
          type="button"
          onClick={() => setOpen(true)}
          disabled={disabled}
          className="min-w-0 flex-1 rounded-xl border border-white/70 bg-white/70 px-3 py-3 text-start text-base outline-none transition shadow-[0_4px_16px_-8px_rgba(47,72,88,0.18)] backdrop-blur focus:ring-2 focus:ring-ring disabled:opacity-50 sm:px-4"
          aria-label={t("versePicker.openPicker")}
        >
          {value ? (
            <span className="text-foreground">{value}</span>
          ) : (
            <span className="block truncate text-muted-foreground">{placeholder ?? t("versePicker.tapToPick")}</span>
          )}
        </button>
        {(value || pending) && (
          <button
            type="button"
            onClick={() => {
              onChange("");
              onCancel?.();
            }}
            className="inline-flex shrink-0 h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition hover:bg-accent hover:text-foreground"
            aria-label={t("versePicker.cancelSearch")}
            title={t("versePicker.cancelSearch")}
          >
            <X className="h-4 w-4" />
          </button>
        )}
        <button
          type="button"
          onClick={() => value.trim() && onSubmit(value.trim())}
          disabled={disabled || !value.trim()}
          className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-primary px-3 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50 sm:px-5"
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              {submitText} <ArrowRight className="h-4 w-4 rtl:rotate-180" />
            </>
          )}
        </button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="flex h-[100dvh] w-screen max-w-none flex-col gap-0 rounded-none border-0 p-0 sm:h-[85vh] sm:max-w-4xl sm:rounded-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3 pr-12">
            <div className="flex min-w-0 items-center gap-2">
              {step !== "book" && (
                <button
                  type="button"
                  onClick={back}
                  className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                  aria-label={t("versePicker.back")}
                >
                  <ChevronLeft className="h-5 w-5 rtl:rotate-180" />
                </button>
              )}
              <span className="truncate text-sm font-semibold text-foreground">{headerLabel}</span>
            </div>
          </div>

          {/* Search */}
          <div className="border-b border-border px-3 py-2">
            <div className="relative">
              <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && parsedSearch?.ok) {
                    e.preventDefault();
                    commitFromParsedSearch();
                  }
                }}
                placeholder={t("versePicker.searchPlaceholder")}
                className="w-full rounded-lg border border-border bg-background py-2 ps-9 pe-9 text-sm outline-none focus:ring-2 focus:ring-ring"
                aria-label={t("versePicker.searchPlaceholder")}
                dir="auto"
                autoFocus={false}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute end-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-accent"
                  aria-label={t("versePicker.clearSearch")}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            {search && parsedSearch?.ok && (
              <button
                type="button"
                onClick={commitFromParsedSearch}
                className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
              >
                {t("versePicker.useReference")} <span className="font-semibold">{parsedSearch.reference}</span>
              </button>
            )}
          </div>

          {/* Body */}
          <div
            ref={scrollRef}
            className="flex flex-1 min-h-0 overflow-hidden"
          >
            {/* Books sidebar (desktop) / step (mobile) */}
            <div
              className={cn(
                "min-h-0 overflow-y-auto overscroll-contain touch-pan-y border-border",
                step === "book" ? "block w-full" : "hidden sm:block sm:w-64 sm:border-e",
              )}
            >
              <ul className="divide-y divide-border px-2 py-2">
                {filteredBooks.map((b) => {
                  const active = book === b.name;
                  return (
                    <li key={b.name}>
                      <button
                        type="button"
                        onClick={() => pickBook(b.name)}
                        className={cn(
                          "flex w-full items-center justify-between rounded-md px-3 py-3 text-start text-base text-foreground hover:bg-accent",
                          active && "bg-accent font-semibold",
                        )}
                      >
                        <span>{localBookName(b.name)}</span>
                        <span className="text-xs text-muted-foreground">
                          {b.chapters} {t("versePicker.chShort")}
                        </span>
                      </button>
                    </li>
                  );
                })}
                {filteredBooks.length === 0 && (
                  <li className="px-3 py-6 text-center text-sm text-muted-foreground">
                    {t("versePicker.noBooks")}
                  </li>
                )}
              </ul>
            </div>

            {/* Chapter + verse area */}
            <div
              className={cn(
                "flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y px-3 py-3",
                step === "book" ? "hidden sm:block" : "block",
              )}
            >
              {!book && (
                <div className="grid h-full place-items-center text-sm text-muted-foreground">
                  {t("versePicker.pickBookHint")}
                </div>
              )}

              {book && (
                <div className="space-y-4">
                  {/* Whole book / whole chapter shortcuts — hidden while backend lacks support */}
                  <div className="flex flex-wrap gap-2">
                    {chapters.length === 1 && (
                      <button
                        type="button"
                        onClick={commitWholeChapter}
                        className="rounded-lg border border-dashed border-border px-3 py-2 text-xs font-medium text-primary hover:bg-accent"
                      >
                        {t("versePicker.useWholeChapter", {
                          book: localBookName(book),
                          chapter: chapters[0],
                        })}
                      </button>
                    )}
                  </div>

                  {/* Chapter grid */}
                  <div>
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {t("versePicker.chaptersLabel")}
                    </p>
                    <div className="grid grid-cols-5 gap-2 sm:grid-cols-8 md:grid-cols-10">
                      {Array.from({ length: meta!.chapters }, (_, i) => i + 1).map((c) => {
                        const selected = chapters.includes(c);
                        return (
                          <button
                            key={c}
                            type="button"
                            onClick={() => toggleChapter(c, false)}
                            className={cn(
                              "rounded-lg border py-3 text-base font-medium transition",
                              selected
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border bg-background text-foreground hover:bg-accent",
                            )}
                          >
                            {c}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Verse selection for single chapter */}
                  {chapters.length === 1 && verseRange && (
                    <div>
                      <div className="mb-2 flex items-baseline justify-between">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          {t("versePicker.versesLabel")}
                        </p>
                        <p className="text-sm font-semibold text-foreground" dir="ltr">
                          {localBookName(book)} {chapters[0]}:{verseRange[0]}
                          {verseRange[1] !== verseRange[0] ? `–${verseRange[1]}` : ""}
                        </p>
                      </div>

                      {/* Dual-handle range slider */}
                      <div className="px-2 py-3">
                        <SliderPrimitive.Root
                          dir="ltr"
                          min={1}
                          max={verseMax}
                          step={1}
                          value={verseRange}
                          onValueChange={(v) => setVerseRange([v[0], v[1]] as [number, number])}
                          className="relative flex h-6 w-full touch-none select-none items-center"
                          minStepsBetweenThumbs={0}
                        >
                          <SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-primary/20">
                            <SliderPrimitive.Range className="absolute h-full bg-primary" />
                          </SliderPrimitive.Track>
                          <SliderPrimitive.Thumb
                            aria-label={t("versePicker.startVerseAria")}
                            className="block h-6 w-6 rounded-full border-2 border-primary bg-background shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          />
                          <SliderPrimitive.Thumb
                            aria-label={t("versePicker.endVerseAria")}
                            className="block h-6 w-6 rounded-full border-2 border-primary bg-background shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          />
                        </SliderPrimitive.Root>
                        <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                          <span>1</span>
                          <span>{verseMax}</span>
                        </div>
                      </div>

                      {/* Verse grid */}
                      <p className="mb-2 text-[10px] text-muted-foreground/80">
                        {t("versePicker.longPressRange")}
                      </p>
                      {!isMobile && (
                        <p className="mb-2 text-[10px] text-muted-foreground/70">
                          Hold Shift to select a range of verses
                        </p>
                      )}
                      <div
                        className="grid grid-cols-6 gap-1.5 select-none sm:grid-cols-10"
                        style={{ WebkitUserSelect: "none", WebkitTouchCallout: "none", userSelect: "none" }}
                      >
                        {Array.from({ length: verseMax }, (_, i) => i + 1).map((v) => {
                          const inRange = v >= verseRange[0] && v <= verseRange[1];
                          const isAnchor = verseAnchor === v;
                          return (
                            <button
                              key={v}
                              type="button"
                              draggable={false}
                              onContextMenu={(e) => {
                                e.preventDefault();
                                longPressFired.current = true;
                                extendRangeTo(v);
                              }}
                              onPointerDown={() => {
                                longPressFired.current = false;
                                clearLongPress();
                                longPressTimer.current = setTimeout(() => {
                                  longPressFired.current = true;
                                  extendRangeTo(v);
                                  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
                                    try { (navigator as Navigator).vibrate?.(10); } catch {}
                                  }
                                }, 450);
                              }}
                              onPointerUp={clearLongPress}
                              onPointerLeave={clearLongPress}
                              onPointerCancel={clearLongPress}
                              onClick={(e) => {
                                if (longPressFired.current) {
                                  longPressFired.current = false;
                                  return;
                                }
                                if (!isMobile && e.shiftKey && verseAnchor !== null) {
                                  extendRangeTo(v);
                                  return;
                                }
                                setVerseRange([v, v]);
                                setVerseAnchor(v);
                              }}
                              onDoubleClick={() => {
                                setVerseRange([1, verseMax]);
                                setVerseAnchor(null);
                              }}
                              className={cn(
                                "rounded-md border py-2 text-sm transition select-none touch-manipulation",
                                inRange
                                  ? "border-primary bg-primary/10 text-foreground"
                                  : "border-border bg-background text-foreground hover:bg-accent",
                                isAnchor && "ring-2 ring-primary/60",
                              )}
                              style={{ WebkitUserSelect: "none", WebkitTouchCallout: "none", userSelect: "none" }}
                              aria-label={`${t("versePicker.verse")} ${v}`}
                              aria-pressed={inRange}
                            >
                              <span aria-hidden="true">{v}</span>
                            </button>
                          );
                        })}
                      </div>

                    </div>
                  )}

                  {chapters.length > 1 && (
                    <p className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground hidden">
                      {t("versePicker.multiChapterHint")}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-border bg-background/95 px-4 py-3 backdrop-blur">
            {blockMsg && (
              <p className="mb-2 text-xs text-destructive">{blockMsg}</p>
            )}
            <div className="flex items-center justify-between gap-3">
              <p className="min-w-0 truncate text-sm text-muted-foreground" dir="ltr">
                {previewRef ?? t("versePicker.noSelection")}
              </p>
              <button
                type="button"
                onClick={commitFromState}
                disabled={!book || chapters.length === 0}
                className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
              >
                {submitText} <ArrowRight className="h-4 w-4 rtl:rotate-180" />
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

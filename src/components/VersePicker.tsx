import { useMemo, useState } from "react";
import { BIBLE_BOOKS } from "@/lib/bible-books";
import { getVerseCount } from "@/lib/bible-verse-counts";
import { localizedBookName } from "@/lib/bible-book-i18n";
import { useLanguage } from "@/lib/language-context";
import { BookMarked, ChevronDown, ArrowRight, Loader2 } from "lucide-react";

type Props = {
  onPick: (reference: string, translation: string) => void;
  disabled?: boolean;
  loading?: boolean;
};

type Mode = "single" | "range";

export function VersePicker({ onPick, disabled, loading }: Props) {
  const { language, config, t } = useLanguage();
  const [mode, setMode] = useState<Mode>("single");
  const translation = config.translationCode;

  // Single-mode state
  const [book, setBook] = useState<string>("");
  const [chapter, setChapter] = useState<string>("");
  const [verse, setVerse] = useState<string>("");

  // Range-mode state
  const [rBook, setRBook] = useState<string>("");
  const [rStartCh, setRStartCh] = useState<string>("");
  const [rStartV, setRStartV] = useState<string>("");
  const [rEndCh, setREndCh] = useState<string>("");
  const [rEndV, setREndV] = useState<string>("");

  // --- Single mode derived ---
  const bookData = useMemo(() => BIBLE_BOOKS.find((b) => b.name === book), [book]);
  const chapters = useMemo(
    () => (bookData ? Array.from({ length: bookData.chapters }, (_, i) => i + 1) : []),
    [bookData],
  );
  const verseCount = useMemo(() => (book && chapter ? getVerseCount(book, Number(chapter)) : 0), [book, chapter]);
  const verses = useMemo(() => Array.from({ length: verseCount }, (_, i) => i + 1), [verseCount]);

  // --- Range mode derived ---
  const rBookData = useMemo(() => BIBLE_BOOKS.find((b) => b.name === rBook), [rBook]);
  const rChapters = useMemo(
    () => (rBookData ? Array.from({ length: rBookData.chapters }, (_, i) => i + 1) : []),
    [rBookData],
  );
  const rStartVerseCount = useMemo(
    () => (rBook && rStartCh ? getVerseCount(rBook, Number(rStartCh)) : 0),
    [rBook, rStartCh],
  );
  const rStartVerses = useMemo(() => Array.from({ length: rStartVerseCount }, (_, i) => i + 1), [rStartVerseCount]);
  const rEndChapters = useMemo(() => {
    if (!rBookData || !rStartCh) return [] as number[];
    const start = Number(rStartCh);
    return Array.from({ length: rBookData.chapters - start + 1 }, (_, i) => start + i);
  }, [rBookData, rStartCh]);
  const rEndVerseChapter = rEndCh ? Number(rEndCh) : Number(rStartCh);
  const rEndVerseCount = useMemo(
    () => (rBook && rEndVerseChapter ? getVerseCount(rBook, rEndVerseChapter) : 0),
    [rBook, rEndVerseChapter],
  );
  const rEndVerses = useMemo(() => {
    if (!rEndVerseCount) return [] as number[];
    const sameChapter = !rEndCh || Number(rEndCh) === Number(rStartCh);
    const min = sameChapter && rStartV ? Number(rStartV) : 1;
    return Array.from({ length: Math.max(0, rEndVerseCount - min + 1) }, (_, i) => min + i);
  }, [rEndVerseCount, rEndCh, rStartCh, rStartV]);

  // --- Reference builders (always emit English book names for backend) ---
  const buildSingle = () => {
    if (!book) return "";
    if (!chapter) return book;
    if (!verse) return `${book} ${chapter}`;
    return `${book} ${chapter}:${verse}`;
  };

  const buildRange = () => {
    if (!rBook || !rStartCh) return "";
    const sCh = Number(rStartCh);
    const sV = rStartV ? Number(rStartV) : null;
    const eCh = rEndCh ? Number(rEndCh) : null;
    const eV = rEndV ? Number(rEndV) : null;

    if (!sV) {
      if (eCh && eCh > sCh) return `${rBook} ${sCh}-${eCh}`;
      return `${rBook} ${sCh}`;
    }
    if ((!eCh || eCh === sCh) && eV && eV > sV) {
      return `${rBook} ${sCh}:${sV}-${eV}`;
    }
    if (eCh && eCh > sCh && eV) {
      return `${rBook} ${sCh}:${sV}-${eCh}:${eV}`;
    }
    return `${rBook} ${sCh}:${sV}`;
  };

  const reference = mode === "single" ? buildSingle() : buildRange();

  const rangeIsValid = (() => {
    if (mode !== "range") return true;
    if (!rBook || !rStartCh) return false;
    const sCh = Number(rStartCh);
    const sV = rStartV ? Number(rStartV) : null;
    const eCh = rEndCh ? Number(rEndCh) : null;
    const eV = rEndV ? Number(rEndV) : null;
    if (!sV) return !!(eCh && eCh > sCh);
    if (eCh && eCh > sCh) return !!eV;
    return !!(eV && eV > sV);
  })();

  const scopeLabel = (() => {
    if (mode === "single") {
      if (!book) return "";
      if (!chapter) return t("picker.scopeBook");
      if (!verse) return t("picker.scopeChapter");
      return t("picker.scopeVerse");
    }
    if (!rBook || !rStartCh) return t("picker.scopeRange");
    const sCh = Number(rStartCh);
    const eCh = rEndCh ? Number(rEndCh) : null;
    if (!rStartV) return eCh && eCh > sCh ? t("picker.scopeChapterRange") : t("picker.scopeRange");
    if (eCh && eCh > sCh) return t("picker.scopeMultiChapter");
    return t("picker.scopePassage");
  })();

  const canGo = mode === "single" ? !!book : rangeIsValid;

  const handleGo = () => {
    if (!reference) return;
    onPick(reference, translation);
  };

  return (
    <div className="mx-auto mt-2 w-full max-w-2xl rounded-2xl border border-border bg-card p-4 text-left shadow-sm sm:p-5">
      <div className="flex items-center justify-between gap-2 text-sm font-semibold text-muted-foreground">
        <span className="flex items-center gap-2">
          <BookMarked className="h-4 w-4" /> {t("picker.choose")}
        </span>
        {scopeLabel && (
          <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium text-foreground">{scopeLabel}</span>
        )}
      </div>

      {/* Mode toggle */}
      <div className="mt-3 inline-flex rounded-xl border border-border bg-background p-1 text-xs font-medium">
        <button
          type="button"
          onClick={() => setMode("single")}
          disabled={disabled}
          className={`rounded-lg px-3 py-1.5 transition ${
            mode === "single" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {t("picker.modeSingle")}
        </button>
        <button
          type="button"
          onClick={() => setMode("range")}
          disabled={disabled}
          className={`rounded-lg px-3 py-1.5 transition ${
            mode === "range" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {t("picker.modeRange")}
        </button>
      </div>

      {mode === "single" ? (
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-[1.7fr_1fr_1fr]">
          <SelectField
            value={book}
            onChange={(v) => {
              setBook(v);
              setChapter("");
              setVerse("");
            }}
            placeholder={t("picker.book")}
            disabled={disabled}
            className="col-span-2 sm:col-span-1"
          >
            <BookOptions language={language} t={t} />
          </SelectField>

          <SelectField
            value={chapter}
            onChange={(v) => {
              setChapter(v);
              setVerse("");
            }}
            placeholder={t("picker.chapter")}
            disabled={disabled || !book}
          >
            {chapters.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </SelectField>

          <SelectField
            value={verse}
            onChange={setVerse}
            placeholder={verseCount ? t("picker.verseAny") : t("picker.verse")}
            disabled={disabled || !chapter}
          >
            {verses.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </SelectField>
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          {/* Book */}
          <div>
            <SelectField
              value={rBook}
              onChange={(v) => {
                setRBook(v);
                setRStartCh("");
                setRStartV("");
                setREndCh("");
                setREndV("");
              }}
              placeholder={t("picker.book")}
              disabled={disabled}
            >
              <BookOptions language={language} t={t} />
            </SelectField>
          </div>

          {/* From */}
          <div className="flex items-center gap-2">
            <span className="w-10 shrink-0 text-xs font-medium text-muted-foreground">{t("picker.from")}</span>
            <div className="grid flex-1 grid-cols-2 gap-2">
              <SelectField
                value={rStartCh}
                onChange={(v) => {
                  setRStartCh(v);
                  setRStartV("");
                  setREndCh("");
                  setREndV("");
                }}
                placeholder={t("picker.chapter")}
                disabled={disabled || !rBook}
              >
                {rChapters.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </SelectField>
              <SelectField
                value={rStartV}
                onChange={(v) => {
                  setRStartV(v);
                  setREndV("");
                }}
                placeholder={t("picker.verseFrom")}
                disabled={disabled || !rStartCh}
              >
                {rStartVerses.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </SelectField>
            </div>
          </div>

          {/* To */}
          <div className="flex items-center gap-2">
            <span className="w-10 shrink-0 text-xs font-medium text-muted-foreground">{t("picker.to")}</span>
            <div className="grid flex-1 grid-cols-2 gap-2">
              <SelectField
                value={rEndCh}
                onChange={(v) => {
                  setREndCh(v);
                  setREndV("");
                }}
                placeholder={t("picker.chapterOpt")}
                disabled={disabled || !rStartCh}
              >
                {rEndChapters.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </SelectField>
              <SelectField
                value={rEndV}
                onChange={setREndV}
                placeholder={t("picker.verseTo")}
                disabled={disabled || !rStartCh || (!rStartV && !rEndCh)}
              >
                {rEndVerses.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </SelectField>
            </div>
          </div>
        </div>
      )}

      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {mode === "single" ? (
            t("picker.helpSingle")
          ) : (
            <>
              {t("picker.helpRangePrefix")} <span className="font-medium text-foreground">Joshua 1:1–9</span>{" "}
              {t("picker.helpRangeMid")} <span className="font-medium text-foreground">Matthew 5–7</span>.
            </>
          )}
        </p>
        <button
          type="button"
          onClick={handleGo}
          disabled={disabled || !canGo}
          aria-label={loading ? t("picker.loadingAria") : t("picker.compareAria")}
          className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              {t("picker.compare")} <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function BookOptions({
  language,
  t,
}: {
  language: import("@/lib/languages").LanguageCode;
  t: (key: string) => string;
}) {
  return (
    <>
      <optgroup label={t("picker.testamentOT")}>
        {BIBLE_BOOKS.filter((b) => b.testament === "OT").map((b) => (
          <option key={b.name} value={b.name}>
            {localizedBookName(b.name, language)}
          </option>
        ))}
      </optgroup>
      <optgroup label={t("picker.testamentNT")}>
        {BIBLE_BOOKS.filter((b) => b.testament === "NT").map((b) => (
          <option key={b.name} value={b.name}>
            {localizedBookName(b.name, language)}
          </option>
        ))}
      </optgroup>
    </>
  );
}

function SelectField({
  value,
  onChange,
  placeholder,
  disabled,
  children,
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  disabled?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      <label className="sr-only">{placeholder}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        aria-label={placeholder}
        className="w-full appearance-none rounded-xl border border-border bg-background px-3 py-2.5 pr-8 text-base outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
      >
        <option value="">{placeholder}</option>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}

import { BIBLE_BOOKS } from "./bible-books";
import { getVerseCount } from "./bible-verse-counts";

export type ParseResult =
  | { ok: true; reference: string; book: string; chapter: number; verse?: number; endVerse?: number; endChapter?: number; suggestion?: string }
  | { ok: false; suggestion?: string; error: string };

// Common abbreviations / aliases
const ALIASES: Record<string, string> = {
  gen: "Genesis", ge: "Genesis", gn: "Genesis",
  ex: "Exodus", exo: "Exodus", exod: "Exodus",
  lev: "Leviticus", lv: "Leviticus",
  num: "Numbers", nu: "Numbers", nm: "Numbers", nb: "Numbers",
  deut: "Deuteronomy", deu: "Deuteronomy", dt: "Deuteronomy",
  josh: "Joshua", jos: "Joshua", jsh: "Joshua",
  judg: "Judges", jdg: "Judges", jdgs: "Judges",
  rut: "Ruth", rth: "Ruth",
  "1sam": "1 Samuel", "1sa": "1 Samuel", "1s": "1 Samuel", isam: "1 Samuel",
  "2sam": "2 Samuel", "2sa": "2 Samuel", "2s": "2 Samuel", iisam: "2 Samuel",
  "1kg": "1 Kings", "1ki": "1 Kings", "1kgs": "1 Kings", "1k": "1 Kings",
  "2kg": "2 Kings", "2ki": "2 Kings", "2kgs": "2 Kings", "2k": "2 Kings",
  "1chr": "1 Chronicles", "1ch": "1 Chronicles", "1chron": "1 Chronicles",
  "2chr": "2 Chronicles", "2ch": "2 Chronicles", "2chron": "2 Chronicles",
  ezr: "Ezra", neh: "Nehemiah", ne: "Nehemiah",
  est: "Esther", esth: "Esther", es: "Esther",
  jb: "Job",
  ps: "Psalms", psa: "Psalms", psalm: "Psalms", pslm: "Psalms", psm: "Psalms", pss: "Psalms",
  pr: "Proverbs", prov: "Proverbs", prv: "Proverbs", prov_: "Proverbs",
  ecc: "Ecclesiastes", eccl: "Ecclesiastes", ec: "Ecclesiastes", qoh: "Ecclesiastes",
  song: "Song of Solomon", sos: "Song of Solomon", sng: "Song of Solomon",
  "songofsongs": "Song of Solomon", canticles: "Song of Solomon", cant: "Song of Solomon",
  isa: "Isaiah", is: "Isaiah",
  jer: "Jeremiah", je: "Jeremiah",
  lam: "Lamentations", la: "Lamentations",
  ezek: "Ezekiel", eze: "Ezekiel", ezk: "Ezekiel",
  dan: "Daniel", dn: "Daniel", da: "Daniel",
  hos: "Hosea", ho: "Hosea",
  jl: "Joel",
  am: "Amos",
  obad: "Obadiah", ob: "Obadiah",
  jon: "Jonah", jnh: "Jonah",
  mic: "Micah", mi: "Micah",
  nah: "Nahum", na: "Nahum",
  hab: "Habakkuk", hb: "Habakkuk",
  zeph: "Zephaniah", zep: "Zephaniah", zp: "Zephaniah",
  hag: "Haggai", hg: "Haggai",
  zech: "Zechariah", zec: "Zechariah", zc: "Zechariah",
  mal: "Malachi", ml: "Malachi",
  matt: "Matthew", mat: "Matthew", mt: "Matthew",
  mk: "Mark", mrk: "Mark", mar: "Mark",
  lk: "Luke", luk: "Luke",
  jn: "John", jhn: "John", joh: "John",
  ac: "Acts", act: "Acts",
  rom: "Romans", ro: "Romans", rm: "Romans",
  "1cor": "1 Corinthians", "1co": "1 Corinthians", icor: "1 Corinthians",
  "2cor": "2 Corinthians", "2co": "2 Corinthians", iicor: "2 Corinthians",
  gal: "Galatians", ga: "Galatians",
  eph: "Ephesians", ephes: "Ephesians",
  phil: "Philippians", php: "Philippians", pp: "Philippians",
  col: "Colossians",
  "1thess": "1 Thessalonians", "1thes": "1 Thessalonians", "1th": "1 Thessalonians",
  "2thess": "2 Thessalonians", "2thes": "2 Thessalonians", "2th": "2 Thessalonians",
  "1tim": "1 Timothy", "1ti": "1 Timothy",
  "2tim": "2 Timothy", "2ti": "2 Timothy",
  tit: "Titus", ti: "Titus",
  philem: "Philemon", phlm: "Philemon", phm: "Philemon",
  heb: "Hebrews",
  jas: "James", jam: "James", jm: "James",
  "1pet": "1 Peter", "1pe": "1 Peter", "1pt": "1 Peter", "1p": "1 Peter",
  "2pet": "2 Peter", "2pe": "2 Peter", "2pt": "2 Peter", "2p": "2 Peter",
  "1jn": "1 John", "1jo": "1 John", "1joh": "1 John", "1jhn": "1 John",
  "2jn": "2 John", "2jo": "2 John", "2joh": "2 John", "2jhn": "2 John",
  "3jn": "3 John", "3jo": "3 John", "3joh": "3 John", "3jhn": "3 John",
  jud: "Jude", jude: "Jude",
  rev: "Revelation", re: "Revelation", apoc: "Revelation", apocalypse: "Revelation",
};

const BOOK_NAMES = BIBLE_BOOKS.map((b) => b.name);

function normKey(s: string): string {
  return s.toLowerCase().replace(/\./g, "").replace(/\s+/g, "");
}

// Levenshtein distance
function lev(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  const dp = new Array(n + 1);
  for (let j = 0; j <= n; j++) dp[j] = j;
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = tmp;
    }
  }
  return dp[n];
}

function resolveBook(raw: string): { book: string; fuzzy: boolean } | null {
  const key = normKey(raw);
  if (!key) return null;
  // Exact match against full names
  for (const name of BOOK_NAMES) {
    if (normKey(name) === key) return { book: name, fuzzy: false };
  }
  // Alias
  if (ALIASES[key]) return { book: ALIASES[key], fuzzy: false };
  // Prefix match against full names (handles partials like "ecclesia")
  const prefixHits = BOOK_NAMES.filter((n) => normKey(n).startsWith(key));
  if (prefixHits.length === 1) return { book: prefixHits[0], fuzzy: true };
  if (prefixHits.length > 1 && key.length >= 4) {
    // pick shortest
    prefixHits.sort((a, b) => a.length - b.length);
    return { book: prefixHits[0], fuzzy: true };
  }
  // Fuzzy: Levenshtein on full names and alias keys
  let best: { name: string; dist: number } | null = null;
  for (const name of BOOK_NAMES) {
    const d = lev(key, normKey(name));
    if (!best || d < best.dist) best = { name, dist: d };
  }
  for (const [alias, name] of Object.entries(ALIASES)) {
    const d = lev(key, alias);
    if (!best || d < best.dist) best = { name, dist: d };
  }
  if (best) {
    const tolerance = key.length <= 4 ? 1 : key.length <= 7 ? 2 : 3;
    if (best.dist <= tolerance) return { book: best.name, fuzzy: true };
  }
  return null;
}

/**
 * Parse a flexible Bible reference string.
 * Accepts forms like:
 *   "john 3:16", "John3:16", "jn 3 16", "jhn 3::16",
 *   "John 3:16-18", "John 3:16–18", "Psalm23", "Mat 5-7",
 *   "1cor13", "iiCor 5:17", "rev 22"
 */
export function parseReference(input: string): ParseResult {
  if (!input) return { ok: false, error: "Please enter a reference." };
  // Normalise dashes and whitespace
  let s = input.trim().replace(/[–—−]/g, "-").replace(/\s+/g, " ");
  // Collapse repeated colons / dots used as separators
  s = s.replace(/:+/g, ":").replace(/\.+/g, ".");
  // Treat "Book 3.16" as "Book 3:16"
  s = s.replace(/(\d)\.(\d)/g, "$1:$2");

  // Split book vs numeric tail. Book may start with a leading digit (1/2/3).
  const m = s.match(/^\s*((?:[1-3]\s*)?[A-Za-z][A-Za-z\s.]*?)\s*([0-9].*)?$/);
  if (!m) return { ok: false, error: "Couldn't recognise that reference." };
  const rawBook = m[1].trim();
  const tail = (m[2] ?? "").trim();

  const resolved = resolveBook(rawBook);
  if (!resolved) {
    return { ok: false, error: `Unknown book "${rawBook}".` };
  }
  const book = resolved.book;
  const bookMeta = BIBLE_BOOKS.find((b) => b.name === book)!;

  if (!tail) {
    // Just a book — default to chapter 1
    return {
      ok: true,
      reference: `${book} 1`,
      book,
      chapter: 1,
      suggestion: resolved.fuzzy ? `${book} 1` : undefined,
    };
  }

  // Parse tail: chapter[:verse[-endVerse]] or chapter-endChapter
  // Allow space as separator too: "3 16"
  const tailNorm = tail.replace(/\s*[:\s]\s*/, ":").replace(/\s*-\s*/g, "-");
  // tokens
  const rangeMatch = tailNorm.match(/^(\d+)(?::(\d+))?(?:-(\d+)(?::(\d+))?)?$/);
  if (!rangeMatch) {
    return { ok: false, error: `Couldn't parse "${tail}".` };
  }
  const chapter = Number(rangeMatch[1]);
  const verse = rangeMatch[2] ? Number(rangeMatch[2]) : undefined;
  const second = rangeMatch[3] ? Number(rangeMatch[3]) : undefined;
  const fourth = rangeMatch[4] ? Number(rangeMatch[4]) : undefined;

  if (chapter < 1 || chapter > bookMeta.chapters) {
    return {
      ok: false,
      error: `${book} only has ${bookMeta.chapters} chapter${bookMeta.chapters === 1 ? "" : "s"}.`,
    };
  }

  // Build the canonical reference
  let reference: string;
  let endChapter: number | undefined;
  let endVerse: number | undefined;

  if (verse === undefined) {
    // chapter only, maybe chapter range
    if (second !== undefined) {
      if (second < chapter || second > bookMeta.chapters) {
        return { ok: false, error: `Invalid chapter range for ${book}.` };
      }
      endChapter = second;
      reference = `${book} ${chapter}-${second}`;
    } else {
      reference = `${book} ${chapter}`;
    }
  } else {
    const vMax = getVerseCount(book, chapter);
    if (vMax && (verse < 1 || verse > vMax)) {
      return { ok: false, error: `${book} ${chapter} has ${vMax} verses.` };
    }
    if (second !== undefined && fourth === undefined) {
      // verse range within same chapter
      if (second < verse) {
        return { ok: false, error: `Invalid verse range.` };
      }
      if (vMax && second > vMax) {
        return { ok: false, error: `${book} ${chapter} has ${vMax} verses.` };
      }
      endVerse = second;
      reference = `${book} ${chapter}:${verse}-${second}`;
    } else if (second !== undefined && fourth !== undefined) {
      // cross-chapter range: book ch:v-ch:v
      endChapter = second;
      endVerse = fourth;
      reference = `${book} ${chapter}:${verse}-${second}:${fourth}`;
    } else {
      reference = `${book} ${chapter}:${verse}`;
    }
  }

  const suggestion =
    resolved.fuzzy || reference.toLowerCase() !== input.trim().toLowerCase()
      ? reference
      : undefined;

  return { ok: true, reference, book, chapter, verse, endVerse, endChapter, suggestion };
}

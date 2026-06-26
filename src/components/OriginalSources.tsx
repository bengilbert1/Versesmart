import { BookOpen, ChevronDown, ExternalLink } from "lucide-react";
import { wikiTitleForAuthor } from "@/lib/author-wiki";
import { useLanguage } from "@/lib/language-context";
import { COMMENTATOR_OVERRIDES, normalizeName } from "@/lib/commentator-metadata";

// ---------- Bible book → biblehub slug (for classic public-domain commentaries) ----------
const BOOK_SLUGS: Record<string, string> = {
  genesis: "genesis", exodus: "exodus", leviticus: "leviticus", numbers: "numbers",
  deuteronomy: "deuteronomy", joshua: "joshua", judges: "judges", ruth: "ruth",
  "1 samuel": "1_samuel", "2 samuel": "2_samuel", "1 kings": "1_kings", "2 kings": "2_kings",
  "1 chronicles": "1_chronicles", "2 chronicles": "2_chronicles", ezra: "ezra",
  nehemiah: "nehemiah", esther: "esther", job: "job", psalm: "psalms", psalms: "psalms",
  proverbs: "proverbs", ecclesiastes: "ecclesiastes",
  "song of solomon": "songs", "song of songs": "songs", canticles: "songs",
  isaiah: "isaiah", jeremiah: "jeremiah", lamentations: "lamentations", ezekiel: "ezekiel",
  daniel: "daniel", hosea: "hosea", joel: "joel", amos: "amos", obadiah: "obadiah",
  jonah: "jonah", micah: "micah", nahum: "nahum", habakkuk: "habakkuk",
  zephaniah: "zephaniah", haggai: "haggai", zechariah: "zechariah", malachi: "malachi",
  matthew: "matthew", mark: "mark", luke: "luke", john: "john", acts: "acts",
  romans: "romans", "1 corinthians": "1_corinthians", "2 corinthians": "2_corinthians",
  galatians: "galatians", ephesians: "ephesians", philippians: "philippians",
  colossians: "colossians", "1 thessalonians": "1_thessalonians",
  "2 thessalonians": "2_thessalonians", "1 timothy": "1_timothy", "2 timothy": "2_timothy",
  titus: "titus", philemon: "philemon", hebrews: "hebrews", james: "james",
  "1 peter": "1_peter", "2 peter": "2_peter", "1 john": "1_john", "2 john": "2_john",
  "3 john": "3_john", jude: "jude", revelation: "revelation",
};

function parseRef(reference: string): { slug: string; chapter: number } | null {
  const m = reference.trim().match(/^(\d?\s?[A-Za-z][A-Za-z ]*?)\s+(\d+)(?::|$|\s)/);
  if (!m) return null;
  const book = m[1].trim().toLowerCase().replace(/\s+/g, " ");
  const slug = BOOK_SLUGS[book];
  if (!slug) return null;
  return { slug, chapter: parseInt(m[2], 10) };
}

type SourceFn = (ref: string, parsed: { slug: string; chapter: number } | null) => { href: string; site: string } | null;

const SOURCES: Array<{ match: string; fn: SourceFn }> = [
  { match: "matthew henry", fn: (_r, p) => p ? { href: `https://biblehub.com/commentaries/mhc/${p.slug}/${p.chapter}.htm`, site: "biblehub.com" } : null },
  { match: "calvin", fn: (_r, p) => p ? { href: `https://biblehub.com/commentaries/calvin/${p.slug}/${p.chapter}.htm`, site: "biblehub.com" } : null },
  { match: "barnes", fn: (_r, p) => p ? { href: `https://biblehub.com/commentaries/barnes/${p.slug}/${p.chapter}.htm`, site: "biblehub.com" } : null },
  { match: "wesley", fn: (_r, p) => p ? { href: `https://biblehub.com/commentaries/wesley/${p.slug}/${p.chapter}.htm`, site: "biblehub.com" } : null },
  { match: "spurgeon", fn: (r) => ({ href: `https://www.spurgeon.org/?s=${encodeURIComponent(r)}`, site: "spurgeon.org" }) },
  { match: "origen", fn: (r) => ({ href: `https://www.ccel.org/ccel/schaff/anf04?q=${encodeURIComponent(r)}`, site: "ccel.org" }) },
  { match: "augustine", fn: (r) => ({ href: `https://www.newadvent.org/cgi-bin/search.cgi?q=${encodeURIComponent(r + " Augustine")}`, site: "newadvent.org" }) },
  { match: "chrysostom", fn: (r) => ({ href: `https://www.newadvent.org/cgi-bin/search.cgi?q=${encodeURIComponent(r + " Chrysostom")}`, site: "newadvent.org" }) },
  { match: "aquinas", fn: (r) => ({ href: `https://aquinas.cc/la/en/?q=${encodeURIComponent(r)}`, site: "aquinas.cc" }) },
  { match: "athanasius", fn: (r) => ({ href: `https://www.newadvent.org/cgi-bin/search.cgi?q=${encodeURIComponent(r + " Athanasius")}`, site: "newadvent.org" }) },
  { match: "jerome", fn: (r) => ({ href: `https://www.newadvent.org/cgi-bin/search.cgi?q=${encodeURIComponent(r + " Jerome")}`, site: "newadvent.org" }) },
  { match: "ambrose", fn: (r) => ({ href: `https://www.newadvent.org/cgi-bin/search.cgi?q=${encodeURIComponent(r + " Ambrose")}`, site: "newadvent.org" }) },
  { match: "gregory of nazianzus", fn: (r) => ({ href: `https://www.newadvent.org/cgi-bin/search.cgi?q=${encodeURIComponent(r + " Gregory Nazianzus")}`, site: "newadvent.org" }) },
  { match: "irenaeus", fn: (r) => ({ href: `https://www.newadvent.org/cgi-bin/search.cgi?q=${encodeURIComponent(r + " Irenaeus")}`, site: "newadvent.org" }) },
  { match: "tertullian", fn: (r) => ({ href: `https://www.tertullian.org/search.htm?q=${encodeURIComponent(r)}`, site: "tertullian.org" }) },
  { match: "cyril of alexandria", fn: (r) => ({ href: `https://www.newadvent.org/cgi-bin/search.cgi?q=${encodeURIComponent(r + " Cyril Alexandria")}`, site: "newadvent.org" }) },
  { match: "luther", fn: (r) => ({ href: `https://www.ccel.org/ccel/luther?q=${encodeURIComponent(r)}`, site: "ccel.org" }) },
  { match: "zwingli", fn: (r) => ({ href: `https://www.google.com/search?q=${encodeURIComponent(r + ' "Zwingli"')}`, site: "google.com" }) },
  { match: "melanchthon", fn: (r) => ({ href: `https://www.google.com/search?q=${encodeURIComponent(r + ' "Melanchthon"')}`, site: "google.com" }) },
  { match: "knox", fn: (r) => ({ href: `https://www.ccel.org/ccel/knox?q=${encodeURIComponent(r)}`, site: "ccel.org" }) },
  { match: "tyndale", fn: (r) => ({ href: `https://www.google.com/search?q=${encodeURIComponent(r + ' "Tyndale"')}`, site: "google.com" }) },
  { match: "n. t. wright", fn: (r) => ({ href: `https://ntwrightonline.org/?s=${encodeURIComponent(r)}`, site: "ntwrightonline.org" }) },
  { match: "n.t. wright", fn: (r) => ({ href: `https://ntwrightonline.org/?s=${encodeURIComponent(r)}`, site: "ntwrightonline.org" }) },
  { match: "stott", fn: (r) => ({ href: `https://www.langhampartnership.org/?s=${encodeURIComponent(r)}`, site: "langhampartnership.org" }) },
  { match: "packer", fn: (r) => ({ href: `https://www.crossway.org/search/?q=${encodeURIComponent(r + " packer")}`, site: "crossway.org" }) },
  { match: "carson", fn: (r) => ({ href: `https://www.thegospelcoalition.org/?s=${encodeURIComponent(r + " carson")}`, site: "thegospelcoalition.org" }) },
  { match: "gordon fee", fn: (r) => ({ href: `https://www.google.com/search?q=${encodeURIComponent(r + ' "Gordon Fee"')}`, site: "google.com" }) },
  { match: "keller", fn: (r) => ({ href: `https://www.gospelinlife.com/?s=${encodeURIComponent(r)}`, site: "gospelinlife.com" }) },
  { match: "piper", fn: (r) => ({ href: `https://www.desiringgod.org/search?q=${encodeURIComponent(r)}`, site: "desiringgod.org" }) },
  { match: "brueggemann", fn: (r) => ({ href: `https://www.workingpreacher.org/?s=${encodeURIComponent(r + " brueggemann")}`, site: "workingpreacher.org" }) },
  { match: "moltmann", fn: (r) => ({ href: `https://www.google.com/search?q=${encodeURIComponent(r + ' "Moltmann"')}`, site: "google.com" }) },
  { match: "mcgrath", fn: (r) => ({ href: `https://alistermcgrath.net/?s=${encodeURIComponent(r)}`, site: "alistermcgrath.net" }) },
];

function resolveSource(author: string, reference: string, parsed: ReturnType<typeof parseRef>) {
  // First check the metadata overrides — that's the dataset source of truth.
  const meta = COMMENTATOR_OVERRIDES[normalizeName(author)];
  if (meta?.source_url) {
    try {
      return { href: meta.source_url, site: new URL(meta.source_url).hostname.replace(/^www\./, "") };
    } catch {
      // fall through to pattern table
    }
  }
  const a = author.toLowerCase();
  for (const s of SOURCES) if (a.includes(s.match)) return s.fn(reference, parsed);
  return null;
}

export function OriginalSources({
  reference,
  authors,
}: {
  reference: string;
  authors: string[];
}) {
  const { t } = useLanguage();

  // Dedupe authors preserving order
  const seen = new Set<string>();
  const uniqueAuthors = authors.filter((a) => {
    const k = a.trim().toLowerCase();
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  if (uniqueAuthors.length === 0) return null;

  const parsed = parseRef(reference);
  const sourceItems = uniqueAuthors
    .map((author) => {
      const s = resolveSource(author, reference, parsed);
      return s ? { author, ...s } : null;
    })
    .filter((x): x is { author: string; href: string; site: string } => !!x);

  const authorLinks = uniqueAuthors.map((author) => {
    const title = wikiTitleForAuthor(author);
    const href = title
      ? `https://en.wikipedia.org/wiki/${title}`
      : `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(author)}`;
    return { author, href };
  });

  return (
    <section className="mt-10 border-t border-border pt-6">
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground">
          <span className="flex items-center gap-2">
            <BookOpen className="h-3.5 w-3.5" />
            {t("originals.title")}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200 group-open:rotate-180" />
        </summary>

        {sourceItems.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("originals.sourceTexts")}
            </p>
            <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-sm">
              {sourceItems.map((s) => (
                <li key={s.author}>
                  <a
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-foreground/80 underline decoration-foreground/30 underline-offset-4 hover:text-foreground hover:decoration-foreground"
                  >
                    {s.author}
                  </a>
                  <span className="ml-1.5 text-xs text-muted-foreground">{s.site}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("originals.authorsList")}
          </p>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-sm">
            {authorLinks.map((a) => (
              <li key={a.author}>
                <a
                  href={a.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-foreground/80 underline decoration-foreground/30 underline-offset-4 hover:text-foreground hover:decoration-foreground"
                >
                  {a.author}
                  <ExternalLink className="h-3 w-3 opacity-60" />
                </a>
              </li>
            ))}
          </ul>
        </div>

        <p className="mt-4 text-xs text-muted-foreground">{t("originals.opensNewTab")}</p>
      </details>
    </section>
  );
}

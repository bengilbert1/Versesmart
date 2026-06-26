// Commentator metadata layer.
//
// Provides a typed schema for every commentator surfaced in the app, with a
// controlled denomination whitelist and a credibility level. Used to filter
// commentary payloads before they're grouped into tabs and to feed the
// admin allow/block panel.
//
// IMPORTANT: This module is client-safe (no server-only imports). It contains
// only static metadata + pure helpers.

export const DENOMINATION_KEYS = [
  "catholic",
  "orthodox",
  "anglican",
  "reformed",
  "baptist",
  "pentecostal",
  "methodist",
  "lutheran",
  "nondenominational",
  "otherChristian",
] as const;
export type DenominationKey = (typeof DENOMINATION_KEYS)[number];

export const CREDIBILITY_KEYS = [
  "historic",
  "mainstream",
  "pastoral",
  "exclude",
] as const;
export type CredibilityKey = (typeof CREDIBILITY_KEYS)[number];

// Controlled region enum — the ONLY valid region values on a commentator
// metadata record. Free-text country/region strings must be mapped via
// `regionFromCountry` before being stored.
export const REGION_KEYS = [
  "Africa",
  "Asia",
  "Europe",
  "LatinAmerica",
  "NorthAmerica",
  "Oceania",
] as const;
export type RegionKey = (typeof REGION_KEYS)[number];

export const GENDER_KEYS = ["male", "female", "unspecified"] as const;
export type GenderKey = (typeof GENDER_KEYS)[number];

export type CommentatorMeta = {
  name: string;
  worldview?: string;
  tradition?: string;
  region?: RegionKey;
  country?: string;
  dates?: string;
  denomination: DenominationKey;
  theological_stream?: string;
  ministry_context?: string;
  writing_style?: string;
  gender: GenderKey;
  publication_era?: string;
  credibility_level: CredibilityKey;
  source_url?: string;
};

// Country → controlled region mapping. Keys are lowercased country names.
// Extend here when adding commentators from new countries.
const COUNTRY_TO_REGION: Record<string, RegionKey> = {
  // Africa
  nigeria: "Africa", kenya: "Africa", ghana: "Africa", uganda: "Africa",
  ethiopia: "Africa", "south africa": "Africa", egypt: "Africa",
  gambia: "Africa", "ivory coast": "Africa", senegal: "Africa",
  cameroon: "Africa", tanzania: "Africa", zimbabwe: "Africa",
  // Asia
  india: "Asia", china: "Asia", philippines: "Asia", japan: "Asia",
  "south korea": "Asia", korea: "Asia", taiwan: "Asia", thailand: "Asia",
  "sri lanka": "Asia", indonesia: "Asia", vietnam: "Asia", malaysia: "Asia",
  pakistan: "Asia", bangladesh: "Asia", israel: "Asia", lebanon: "Asia",
  syria: "Asia", turkey: "Asia", iran: "Asia", iraq: "Asia",
  // Europe
  uk: "Europe", "united kingdom": "Europe", england: "Europe",
  scotland: "Europe", wales: "Europe", ireland: "Europe",
  germany: "Europe", france: "Europe", switzerland: "Europe",
  netherlands: "Europe", italy: "Europe", spain: "Europe", portugal: "Europe",
  greece: "Europe", russia: "Europe", poland: "Europe", sweden: "Europe",
  norway: "Europe", denmark: "Europe", finland: "Europe", belgium: "Europe",
  austria: "Europe", ukraine: "Europe", romania: "Europe", hungary: "Europe",
  "czech republic": "Europe",
  // Latin America
  brazil: "LatinAmerica", chile: "LatinAmerica", peru: "LatinAmerica",
  argentina: "LatinAmerica", mexico: "LatinAmerica", colombia: "LatinAmerica",
  ecuador: "LatinAmerica", venezuela: "LatinAmerica", bolivia: "LatinAmerica",
  uruguay: "LatinAmerica", paraguay: "LatinAmerica", cuba: "LatinAmerica",
  "puerto rico": "LatinAmerica", "costa rica": "LatinAmerica",
  guatemala: "LatinAmerica", honduras: "LatinAmerica", "el salvador": "LatinAmerica",
  nicaragua: "LatinAmerica", panama: "LatinAmerica",
  "dominican republic": "LatinAmerica", haiti: "LatinAmerica",
  // North America
  usa: "NorthAmerica", "united states": "NorthAmerica",
  "u.s.": "NorthAmerica", us: "NorthAmerica", america: "NorthAmerica",
  canada: "NorthAmerica",
  // Oceania
  australia: "Oceania", "new zealand": "Oceania", fiji: "Oceania",
  "papua new guinea": "Oceania", samoa: "Oceania", tonga: "Oceania",
};

export function regionFromCountry(country: string | null | undefined): RegionKey | null {
  if (!country) return null;
  const key = country.toString().trim().toLowerCase();
  if (!key) return null;
  if ((REGION_KEYS as readonly string[]).includes(country as string)) return country as RegionKey;
  return COUNTRY_TO_REGION[key] ?? null;
}

export function isValidRegion(value: unknown): value is RegionKey {
  return typeof value === "string" && (REGION_KEYS as readonly string[]).includes(value);
}

export function isValidGender(value: unknown): value is GenderKey {
  return typeof value === "string" && (GENDER_KEYS as readonly string[]).includes(value);
}

// Validate a commentator metadata record. Throws when region or gender is
// outside its controlled enum. Used by admin write paths and tests.
export function validateCommentatorMeta(meta: Partial<CommentatorMeta>, label = "commentator"): void {
  if (meta.region !== undefined && !isValidRegion(meta.region)) {
    throw new Error(`${label}: invalid region "${String(meta.region)}" — must be one of ${REGION_KEYS.join(", ")}`);
  }
  if (meta.gender !== undefined && !isValidGender(meta.gender)) {
    throw new Error(`${label}: invalid gender "${String(meta.gender)}" — must be one of ${GENDER_KEYS.join(", ")}`);
  }
}

export function normalizeName(name: string): string {
  // Lowercase, strip punctuation (.,'’"·-), collapse whitespace. So
  // "N. T. Wright", "N.T. Wright", "N T Wright" all normalize to "n t wright".
  return name
    .trim()
    .toLowerCase()
    .replace(/[.,'’"·\-_/\\]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Canonicalize a denomination label (free-text) into a normalized lowercase
// string before mapping to DenominationKey. Used so equivalent values
// ("Anglican", "anglican", "Church of England") collapse together.
export function canonicalizeDenominationLabel(raw: string | null | undefined): string {
  return (raw ?? "").toString().toLowerCase().replace(/[._-]+/g, " ").replace(/\s+/g, " ").trim();
}


// Maps any tradition / sub-tradition string the AI payload uses to one of the
// whitelisted denomination keys. Returns null if it can't be mapped — those
// commentators are dropped per spec.
export function denominationKeyFromTradition(tradition: string | undefined): DenominationKey | null {
  if (!tradition) return null;
  const t = tradition.toLowerCase();
  if (t.includes("catholic") && !t.includes("orthodox")) return "catholic";
  if (t.includes("orthodox") || t.includes("eastern")) return "orthodox";
  if (t.includes("anglican") || t.includes("episcopal") || t.includes("church of england")) return "anglican";
  if (
    t.includes("reformed") ||
    t.includes("presbyterian") ||
    t.includes("calvinist") ||
    t.includes("nonconformist") ||
    t.includes("puritan")
  )
    return "reformed";
  if (t.includes("baptist")) return "baptist";
  if (t.includes("pentecostal") || t.includes("charismatic")) return "pentecostal";
  if (t.includes("methodist") || t.includes("wesleyan") || t.includes("arminian")) return "methodist";
  if (t.includes("lutheran")) return "lutheran";
  if (
    t.includes("evangelical") ||
    t.includes("non-denominational") ||
    t.includes("nondenominational") ||
    t.includes("free church")
  )
    return "nondenominational";
  return null;
}

// Per-author static overrides. Keyed by normalized name. Fields here override
// whatever the AI payload contains. credibility_level defaults to "mainstream"
// when not overridden.
export const COMMENTATOR_OVERRIDES: Record<string, Partial<CommentatorMeta>> = {
  "matthew henry": {
    denomination: "nondenominational", credibility_level: "historic",
    source_url: "https://www.biblegateway.com/resources/matthew-henry/",
    theological_stream: "Nonconformist Reformed", ministry_context: "Pastoral",
    writing_style: "Devotional / Expository", gender: "male",
    region: "Europe", country: "United Kingdom", publication_era: "Early 18th century",
  },
  "john calvin": {
    denomination: "reformed", credibility_level: "historic",
    source_url: "https://ccel.org/ccel/calvin",
    theological_stream: "Magisterial Reformed", ministry_context: "Pastor / Theologian",
    writing_style: "Exegetical", gender: "male",
    region: "Europe", country: "Switzerland", publication_era: "16th century",
  },
  "charles h. spurgeon": {
    denomination: "baptist", credibility_level: "historic",
    source_url: "https://www.spurgeon.org/",
    theological_stream: "Reformed Baptist", ministry_context: "Preacher",
    writing_style: "Sermonic", gender: "male",
    region: "Europe", country: "United Kingdom", publication_era: "19th century",
  },
  "albert barnes": {
    denomination: "reformed", credibility_level: "historic",
    source_url: "https://biblehub.com/commentaries/barnes/",
    theological_stream: "New School Presbyterian", writing_style: "Expository",
    gender: "male", region: "NorthAmerica", country: "USA", publication_era: "19th century",
  },
  "john wesley": {
    denomination: "methodist", credibility_level: "historic",
    source_url: "https://biblehub.com/commentaries/wesley/",
    theological_stream: "Wesleyan Arminian", writing_style: "Notes",
    gender: "male", region: "Europe", country: "United Kingdom", publication_era: "18th century",
  },
  "n. t. wright": { denomination: "anglican", credibility_level: "mainstream", source_url: "https://ntwrightonline.org/", gender: "male", region: "Europe", country: "United Kingdom" },
  "n.t. wright": { denomination: "anglican", credibility_level: "mainstream", source_url: "https://ntwrightonline.org/", gender: "male", region: "Europe", country: "United Kingdom" },
  "tim keller": { denomination: "reformed", credibility_level: "pastoral", source_url: "https://www.gospelinlife.com/", gender: "male", region: "NorthAmerica", country: "USA" },
  "john piper": { denomination: "baptist", credibility_level: "pastoral", source_url: "https://www.desiringgod.org/", gender: "male", region: "NorthAmerica", country: "USA" },
  "john stott": { denomination: "anglican", credibility_level: "mainstream", source_url: "https://www.langhampartnership.org/", gender: "male", region: "Europe", country: "United Kingdom" },
  "j. i. packer": { denomination: "anglican", credibility_level: "mainstream", gender: "male", region: "NorthAmerica", country: "Canada" },
  "d. a. carson": { denomination: "baptist", credibility_level: "mainstream", gender: "male", region: "NorthAmerica", country: "Canada" },
  "augustine": { denomination: "catholic", credibility_level: "historic", source_url: "https://www.newadvent.org/fathers/", gender: "male", region: "Africa", country: "Algeria" },
  "augustine of hippo": { denomination: "catholic", credibility_level: "historic", source_url: "https://www.newadvent.org/fathers/", gender: "male", region: "Africa", country: "Algeria" },
  "john chrysostom": { denomination: "orthodox", credibility_level: "historic", source_url: "https://www.newadvent.org/fathers/", gender: "male", region: "Asia", country: "Turkey" },
  "thomas aquinas": { denomination: "catholic", credibility_level: "historic", source_url: "https://aquinas.cc/", gender: "male", region: "Europe", country: "Italy" },
  "martin luther": { denomination: "lutheran", credibility_level: "historic", source_url: "https://ccel.org/ccel/luther", gender: "male", region: "Europe", country: "Germany" },
  "origen": { denomination: "orthodox", credibility_level: "historic", source_url: "https://www.ccel.org/ccel/schaff/anf04", gender: "male", region: "Africa", country: "Egypt" },
  "jerome": { denomination: "catholic", credibility_level: "historic", source_url: "https://www.newadvent.org/fathers/", gender: "male", region: "Europe", country: "Italy" },
  "athanasius": { denomination: "orthodox", credibility_level: "historic", source_url: "https://www.newadvent.org/fathers/", gender: "male", region: "Africa", country: "Egypt" },
  "irenaeus": { denomination: "catholic", credibility_level: "historic", source_url: "https://www.newadvent.org/fathers/", gender: "male", region: "Europe", country: "France" },
  "tertullian": { denomination: "otherChristian", credibility_level: "historic", source_url: "https://www.tertullian.org/", gender: "male", region: "Africa", country: "Tunisia" },
  "cyril of alexandria": { denomination: "orthodox", credibility_level: "historic", source_url: "https://www.newadvent.org/fathers/", gender: "male", region: "Africa", country: "Egypt" },
  "ambrose": { denomination: "catholic", credibility_level: "historic", source_url: "https://www.newadvent.org/fathers/", gender: "male", region: "Europe", country: "Italy" },
  // --- Modern evangelical / pastoral ---
  "r. c. sproul": { denomination: "reformed", credibility_level: "pastoral", source_url: "https://www.ligonier.org/", gender: "male", region: "NorthAmerica", country: "USA" },
  "r.c. sproul": { denomination: "reformed", credibility_level: "pastoral", source_url: "https://www.ligonier.org/", gender: "male", region: "NorthAmerica", country: "USA" },
  "dietrich bonhoeffer": { denomination: "lutheran", credibility_level: "historic", gender: "male", region: "Europe", country: "Germany" },
  "c. s. lewis": { denomination: "anglican", credibility_level: "historic", gender: "male", region: "Europe", country: "United Kingdom" },
  "c.s. lewis": { denomination: "anglican", credibility_level: "historic", gender: "male", region: "Europe", country: "United Kingdom" },
  "jonathan edwards": { denomination: "reformed", credibility_level: "historic", source_url: "https://edwards.yale.edu/", gender: "male", region: "NorthAmerica", country: "USA" },
  "john owen": { denomination: "reformed", credibility_level: "historic", source_url: "https://ccel.org/ccel/owen", gender: "male", region: "Europe", country: "United Kingdom" },
  "charles hodge": { denomination: "reformed", credibility_level: "historic", source_url: "https://ccel.org/ccel/hodge", gender: "male", region: "NorthAmerica", country: "USA" },
  // --- Pentecostal / Charismatic ---
  "gordon fee": { denomination: "pentecostal", credibility_level: "mainstream", gender: "male", region: "NorthAmerica", country: "Canada" },
  "craig keener": { denomination: "pentecostal", credibility_level: "mainstream", gender: "male", region: "NorthAmerica", country: "USA" },
  // --- Global South / missionary ---
  "k. p. yohannan": { denomination: "nondenominational", credibility_level: "pastoral", source_url: "https://www.gfa.org/", gender: "male", region: "Asia", country: "India" },
  "k.p. yohannan": { denomination: "nondenominational", credibility_level: "pastoral", source_url: "https://www.gfa.org/", gender: "male", region: "Asia", country: "India" },
  "watchman nee": { denomination: "otherChristian", credibility_level: "mainstream", gender: "male", region: "Asia", country: "China" },
  "festo kivengere": { denomination: "anglican", credibility_level: "mainstream", gender: "male", region: "Africa", country: "Uganda" },
  "mensa otabil": { denomination: "pentecostal", credibility_level: "pastoral", gender: "male", region: "Africa", country: "Ghana" },
  "rené padilla": { denomination: "nondenominational", credibility_level: "mainstream", gender: "male", region: "LatinAmerica", country: "Ecuador" },
  "rene padilla": { denomination: "nondenominational", credibility_level: "mainstream", gender: "male", region: "LatinAmerica", country: "Ecuador" },
  "c. rené padilla": { denomination: "nondenominational", credibility_level: "mainstream", gender: "male", region: "LatinAmerica", country: "Ecuador" },
  "samuel escobar": { denomination: "baptist", credibility_level: "mainstream", gender: "male", region: "LatinAmerica", country: "Peru" },
  "vishal mangalwadi": { denomination: "nondenominational", credibility_level: "mainstream", gender: "male", region: "Asia", country: "India" },
  "kosuke koyama": { denomination: "otherChristian", credibility_level: "mainstream", gender: "male", region: "Asia", country: "Japan" },
  "lamin sanneh": { denomination: "catholic", credibility_level: "mainstream", gender: "male", region: "Africa", country: "Gambia" },
  "john mbiti": { denomination: "anglican", credibility_level: "mainstream", gender: "male", region: "Africa", country: "Kenya" },
  "byang kato": { denomination: "nondenominational", credibility_level: "mainstream", gender: "male", region: "Africa", country: "Nigeria" },
  "kwame bediako": { denomination: "nondenominational", credibility_level: "mainstream", gender: "male", region: "Africa", country: "Ghana" },
  "c. s. song": { denomination: "otherChristian", credibility_level: "mainstream", gender: "male", region: "Asia", country: "Taiwan" },
  "ajith fernando": { denomination: "nondenominational", credibility_level: "mainstream", gender: "male", region: "Asia", country: "Sri Lanka" },
  "orlando costas": { denomination: "baptist", credibility_level: "mainstream", gender: "male", region: "LatinAmerica", country: "Puerto Rico" },
  "gustavo gutiérrez": { denomination: "catholic", credibility_level: "mainstream", gender: "male", region: "LatinAmerica", country: "Peru" },
  "gustavo gutierrez": { denomination: "catholic", credibility_level: "mainstream", gender: "male", region: "LatinAmerica", country: "Peru" },
  "walter brueggemann": { denomination: "reformed", credibility_level: "mainstream", gender: "male", region: "NorthAmerica", country: "USA" },
  "jürgen moltmann": { denomination: "reformed", credibility_level: "mainstream", gender: "male", region: "Europe", country: "Germany" },
  "jurgen moltmann": { denomination: "reformed", credibility_level: "mainstream", gender: "male", region: "Europe", country: "Germany" },
  "alister mcgrath": { denomination: "anglican", credibility_level: "mainstream", gender: "male", region: "Europe", country: "United Kingdom" },
  "derek prince": { denomination: "nondenominational", credibility_level: "pastoral", gender: "male", region: "Europe", country: "United Kingdom" },
  "huldrych zwingli": { denomination: "reformed", credibility_level: "historic", gender: "male", region: "Europe", country: "Switzerland" },
  "philip melanchthon": { denomination: "lutheran", credibility_level: "historic", gender: "male", region: "Europe", country: "Germany" },
  "john knox": { denomination: "reformed", credibility_level: "historic", gender: "male", region: "Europe", country: "United Kingdom" },
  "william tyndale": { denomination: "reformed", credibility_level: "historic", gender: "male", region: "Europe", country: "United Kingdom" },
  "gregory of nazianzus": { denomination: "orthodox", credibility_level: "historic", gender: "male", region: "Asia", country: "Turkey" },
  // --- Female commentators (gender balancing — append-only) ---
  "esther mombo": { denomination: "anglican", credibility_level: "mainstream", gender: "female", region: "Africa", country: "Kenya" },
  "elsa tamez": { denomination: "otherChristian", credibility_level: "mainstream", gender: "female", region: "LatinAmerica", country: "Mexico" },
  "mercy amba oduyoye": { denomination: "methodist", credibility_level: "mainstream", gender: "female", region: "Africa", country: "Ghana" },
  "fleming rutledge": { denomination: "anglican", credibility_level: "mainstream", gender: "female", region: "NorthAmerica", country: "USA" },
  "sarah coakley": { denomination: "anglican", credibility_level: "mainstream", gender: "female", region: "Europe", country: "United Kingdom" },
  "marianne meye thompson": { denomination: "methodist", credibility_level: "mainstream", gender: "female", region: "NorthAmerica", country: "USA" },
  "beverly roberts gaventa": { denomination: "reformed", credibility_level: "mainstream", gender: "female", region: "NorthAmerica", country: "USA" },
  "amy carmichael": { denomination: "anglican", credibility_level: "historic", gender: "female", region: "Asia", country: "India" },
  "phoebe palmer": { denomination: "methodist", credibility_level: "historic", gender: "female", region: "NorthAmerica", country: "USA" },
  "edith stein": { denomination: "catholic", credibility_level: "historic", gender: "female", region: "Europe", country: "Germany" },
  // --- Added: first-class entries with full metadata ---
  "george muller": {
    denomination: "nondenominational", credibility_level: "mainstream",
    source_url: "https://en.wikipedia.org/wiki/George_M%C3%BCller",
    theological_stream: "Plymouth Brethren / Evangelical",
    ministry_context: "Orphan care / Prayer-based ministry (Bristol)",
    writing_style: "Devotional / Narrative", gender: "male",
    region: "Europe", country: "United Kingdom",
    publication_era: "19th century", dates: "1805–1898",
    worldview: "Radical trust in God's provision; prayer-driven faith",
    tradition: "Protestant / Evangelical",
  },
  "george müller": {
    denomination: "nondenominational", credibility_level: "mainstream",
    source_url: "https://en.wikipedia.org/wiki/George_M%C3%BCller",
    theological_stream: "Plymouth Brethren / Evangelical",
    ministry_context: "Orphan care / Prayer-based ministry (Bristol)",
    writing_style: "Devotional / Narrative", gender: "male",
    region: "Europe", country: "United Kingdom",
    publication_era: "19th century", dates: "1805–1898",
    worldview: "Radical trust in God's provision; prayer-driven faith",
    tradition: "Protestant / Evangelical",
  },
  "mother teresa": {
    denomination: "catholic", credibility_level: "mainstream",
    source_url: "https://en.wikipedia.org/wiki/Mother_Teresa",
    theological_stream: "Roman Catholic / Missionaries of Charity",
    ministry_context: "Service to the poor (Calcutta, India)",
    writing_style: "Devotional / Aphoristic", gender: "female",
    region: "Asia", country: "India",
    publication_era: "20th century", dates: "1910–1997",
    worldview: "Compassion, dignity, and God's love in action",
    tradition: "Catholic",
  },
  "saint teresa of calcutta": {
    denomination: "catholic", credibility_level: "mainstream",
    source_url: "https://en.wikipedia.org/wiki/Mother_Teresa",
    theological_stream: "Roman Catholic / Missionaries of Charity",
    ministry_context: "Service to the poor (Calcutta, India)",
    writing_style: "Devotional / Aphoristic", gender: "female",
    region: "Asia", country: "India",
    publication_era: "20th century", dates: "1910–1997",
    worldview: "Compassion, dignity, and God's love in action",
    tradition: "Catholic",
  },
  "teresa of calcutta": {
    denomination: "catholic", credibility_level: "mainstream",
    source_url: "https://en.wikipedia.org/wiki/Mother_Teresa",
    gender: "female", region: "Asia", country: "India",
    publication_era: "20th century", dates: "1910–1997",
  },
};

// Validate every override at module load — region and gender must be in their
// controlled enums. Throws on first invalid entry so bad data fails loudly.
for (const [key, meta] of Object.entries(COMMENTATOR_OVERRIDES)) {
  validateCommentatorMeta(meta, `COMMENTATOR_OVERRIDES["${key}"]`);
}

// Build a synthesized record. Returns a value for every author — if the
// tradition can't be mapped to a whitelisted denomination, the author is
// bucketed under "otherChristian" instead of being silently dropped. Only
// credibility_level === "exclude" or an admin block removes them.
export function buildCommentatorMeta(input: {
  author: string;
  tradition?: string;
  region?: string;
  country?: string;
  dates?: string;
  worldview?: string;
  summary?: string;
  denomination?: string; // payload hint
  sourceUrl?: string; // payload hint
}): CommentatorMeta {
  const key = normalizeName(input.author);
  const override = COMMENTATOR_OVERRIDES[key] ?? {};
  const denomination: DenominationKey =
    override.denomination ??
    denominationKeyFromTradition(input.denomination) ??
    denominationKeyFromTradition(input.tradition) ??
    "otherChristian";
  return {
    name: input.author,
    worldview: input.worldview && input.worldview.trim() ? input.worldview : "Unspecified",
    tradition: input.tradition && input.tradition.trim() ? input.tradition : "Other Christian",
    region: regionFromCountry(input.region) ?? regionFromCountry(input.country) ?? override.region,
    country: input.country && input.country.trim() ? input.country : "Unknown",
    dates: input.dates,
    denomination,
    credibility_level: override.credibility_level ?? "mainstream",
    theological_stream: override.theological_stream,
    ministry_context: override.ministry_context,
    writing_style: override.writing_style,
    gender: override.gender ?? "unspecified",
    publication_era: override.publication_era,
    source_url: override.source_url ?? (input.sourceUrl || undefined),
  };
}

// True when the commentator may appear in any tab / comparison.
// The ONLY exclusion mechanism is the admin allow/block toggle. The
// credibility_level field is retained on the metadata record for display /
// admin UI purposes but is NOT used to filter commentators out of the feed.
export function isCommentatorAllowed(args: {
  author: string;
  tradition?: string;
  blocked: ReadonlySet<string>;
}): boolean {
  if (args.blocked.has(normalizeName(args.author))) return false;
  return true;
}

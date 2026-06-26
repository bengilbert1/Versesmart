// Unified Commentator Selection Engine.
//
// SINGLE SOURCE OF TRUTH for which commentators appear in any verse lookup.
// All endpoints (main, modern, historical, regional, SEO) call
// `selectCommentatorsForVerse` so the AI never selects — it only writes
// commentary for the names it is given.
//
// Selection rules:
//   Rule A  total count in [minCount, maxCount] (defaults 10..16)
//   Rule B  diversity: try ≥1 per region, prefer ≥1 woman
//   Rule C  positive weighting for women, Global South, under-represented
//           traditions; relevance remains primary
//   Rule D  fill remaining slots with highest-weighted candidates
//
// Fallback: if the pool is too small to hit minCount we return as many as
// possible (6–9) and log a warning. We never fail to return a list.

import {
  COMMENTATOR_OVERRIDES,
  normalizeName,
  type CommentatorMeta,
  type DenominationKey,
} from "./commentator-metadata";
import { KNOWN_COMMENTATORS, KNOWN_MODERN_AUTHORS, KNOWN_HISTORICAL_AUTHORS } from "./known-commentators";

// --- Controlled region enum -------------------------------------------------

export const REGIONS = [
  "Africa",
  "Asia",
  "Europe",
  "LatinAmerica",
  "NorthAmerica",
  "Oceania",
] as const;
export type Region = (typeof REGIONS)[number];

// Map a free-text country/region string into the controlled region enum.
export function regionFromAny(input: string | undefined | null): Region | null {
  if (!input) return null;
  const s = input.toLowerCase();
  // explicit region tokens first
  if (/(latin america|latin\b|caribbean|south america|central america)/.test(s)) return "LatinAmerica";
  if (/(north america)/.test(s)) return "NorthAmerica";
  if (/(oceania|pacific)/.test(s)) return "Oceania";
  if (/(africa)/.test(s)) return "Africa";
  if (/(asia|middle east|levant)/.test(s)) return "Asia";
  if (/(europe)/.test(s)) return "Europe";

  // common country names
  const map: Record<string, Region> = {
    usa: "NorthAmerica", "united states": "NorthAmerica", "u.s.": "NorthAmerica", us: "NorthAmerica",
    canada: "NorthAmerica", mexico: "LatinAmerica",
    uk: "Europe", "united kingdom": "Europe", england: "Europe", scotland: "Europe", ireland: "Europe", wales: "Europe",
    germany: "Europe", france: "Europe", switzerland: "Europe", netherlands: "Europe", italy: "Europe", spain: "Europe",
    greece: "Europe", russia: "Europe", sweden: "Europe", norway: "Europe", denmark: "Europe",
    egypt: "Africa", ethiopia: "Africa", "south africa": "Africa", kenya: "Africa", nigeria: "Africa",
    ghana: "Africa", uganda: "Africa", gambia: "Africa",
    brazil: "LatinAmerica", argentina: "LatinAmerica", peru: "LatinAmerica", ecuador: "LatinAmerica",
    "puerto rico": "LatinAmerica", "costa rica": "LatinAmerica",
    "south korea": "Asia", korea: "Asia", japan: "Asia", china: "Asia", india: "Asia",
    philippines: "Asia", taiwan: "Asia", "sri lanka": "Asia", thailand: "Asia", israel: "Asia",
    australia: "Oceania", "new zealand": "Oceania",
  };
  for (const key of Object.keys(map)) if (s.includes(key)) return map[key];
  return null;
}

export const GLOBAL_SOUTH: ReadonlySet<Region> = new Set<Region>(["Africa", "Asia", "LatinAmerica"]);

// --- Roster -----------------------------------------------------------------

export type CommentatorRecord = {
  name: string;
  region: Region | null;
  gender: "male" | "female" | "unspecified";
  denomination: DenominationKey;
  era: "historical" | "modern";
  publicDomain: boolean;
  meta: Partial<CommentatorMeta>;
};

// Known historical authors (period ≤ ~1900) — used as a coarse era heuristic.
const HISTORICAL_SET = new Set(KNOWN_HISTORICAL_AUTHORS.map(normalizeName).concat([
  normalizeName("Matthew Henry"),
  normalizeName("John Calvin"),
  normalizeName("Charles H. Spurgeon"),
  normalizeName("Albert Barnes"),
  normalizeName("John Wesley"),
  normalizeName("Jonathan Edwards"),
  normalizeName("John Owen"),
  normalizeName("Charles Hodge"),
  normalizeName("C. S. Lewis"),
  normalizeName("Dietrich Bonhoeffer"),
  normalizeName("George Müller"),
]));

const PUBLIC_DOMAIN = new Set([
  "matthew henry", "john calvin", "charles h spurgeon", "albert barnes", "john wesley",
  "augustine", "john chrysostom", "thomas aquinas", "martin luther", "origen", "jerome",
  "athanasius", "irenaeus", "tertullian", "cyril of alexandria", "ambrose", "jonathan edwards",
  "john owen", "charles hodge",
]);

// Per-name region hints (used when COMMENTATOR_OVERRIDES doesn't have country).
const NAME_REGION_HINTS: Record<string, Region> = {
  "matthew henry": "Europe", "john calvin": "Europe", "charles h spurgeon": "Europe",
  "albert barnes": "NorthAmerica", "john wesley": "Europe", "augustine": "Africa",
  "john chrysostom": "Asia", "thomas aquinas": "Europe", "martin luther": "Europe",
  "origen": "Africa", "jerome": "Europe", "athanasius": "Africa", "irenaeus": "Europe",
  "tertullian": "Africa", "cyril of alexandria": "Africa", "ambrose": "Europe",
  "n t wright": "Europe", "john stott": "Europe", "j i packer": "NorthAmerica",
  "d a carson": "NorthAmerica", "gordon fee": "NorthAmerica", "tim keller": "NorthAmerica",
  "john piper": "NorthAmerica", "walter brueggemann": "NorthAmerica",
  "jürgen moltmann": "Europe", "jurgen moltmann": "Europe", "alister mcgrath": "Europe",
  "derek prince": "Europe",
  "john mbiti": "Africa", "byang kato": "Africa", "mercy amba oduyoye": "Africa",
  "kwame bediako": "Africa", "festo kivengere": "Africa", "mensa otabil": "Africa",
  "lamin sanneh": "Africa", "esther mombo": "Africa",
  "kosuke koyama": "Asia", "c s song": "Asia", "ajith fernando": "Asia",
  "watchman nee": "Asia", "k p yohannan": "Asia", "vishal mangalwadi": "Asia",
  "samuel escobar": "LatinAmerica", "rené padilla": "LatinAmerica", "rene padilla": "LatinAmerica",
  "orlando costas": "LatinAmerica", "gustavo gutiérrez": "LatinAmerica",
  "gustavo gutierrez": "LatinAmerica", "elsa tamez": "LatinAmerica",
  "huldrych zwingli": "Europe", "philip melanchthon": "Europe", "john knox": "Europe",
  "william tyndale": "Europe", "gregory of nazianzus": "Asia",
  // Female additions (see below)
  "fleming rutledge": "NorthAmerica", "sarah coakley": "Europe",
  "marianne meye thompson": "NorthAmerica", "beverly roberts gaventa": "NorthAmerica",
  "amy carmichael": "Asia", "phoebe palmer": "NorthAmerica",
  // Manual / admin-added commentators
  "hudson taylor": "Asia", "sadhu sundar singh": "Asia",
  "bill johnson": "NorthAmerica", "michael heiser": "NorthAmerica",
  "george muller": "Europe", "george müller": "Europe",
  "mother teresa": "Asia", "saint teresa of calcutta": "Asia",
};

// Female commentators added to the static pool so gender balancing has actual
// candidates. Appended only; existing male entries remain.
const FEMALE_ADDITIONS: Array<Partial<CommentatorRecord> & { name: string }> = [
  { name: "Fleming Rutledge", gender: "female", denomination: "anglican", era: "modern" },
  { name: "Sarah Coakley", gender: "female", denomination: "anglican", era: "modern" },
  { name: "Marianne Meye Thompson", gender: "female", denomination: "methodist", era: "modern" },
  { name: "Beverly Roberts Gaventa", gender: "female", denomination: "reformed", era: "modern" },
  { name: "Amy Carmichael", gender: "female", denomination: "anglican", era: "historical", publicDomain: true },
  { name: "Phoebe Palmer", gender: "female", denomination: "methodist", era: "historical", publicDomain: true },
];

function recordFor(name: string, extra: Partial<CommentatorRecord> = {}): CommentatorRecord {
  const key = normalizeName(name);
  const meta = COMMENTATOR_OVERRIDES[key] ?? {};
  const era: "historical" | "modern" =
    extra.era ?? (HISTORICAL_SET.has(key) ? "historical" : "modern");
  const region: Region | null =
    extra.region ?? regionFromAny(meta.region) ?? regionFromAny(meta.country) ?? NAME_REGION_HINTS[key] ?? null;
  return {
    name,
    region,
    gender: (extra.gender ?? meta.gender ?? "unspecified") as CommentatorRecord["gender"],
    denomination: (extra.denomination ?? meta.denomination ?? "otherChristian") as DenominationKey,
    era,
    publicDomain: extra.publicDomain ?? PUBLIC_DOMAIN.has(key),
    meta,
  };
}

export function buildBasePool(blocked: ReadonlySet<string> = new Set()): CommentatorRecord[] {
  const seen = new Set<string>();
  const out: CommentatorRecord[] = [];
  const push = (rec: CommentatorRecord) => {
    const key = normalizeName(rec.name);
    if (blocked.has(key)) return;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(rec);
  };
  for (const name of KNOWN_COMMENTATORS) push(recordFor(name));
  for (const add of FEMALE_ADDITIONS) push(recordFor(add.name, add));
  // Also include public-domain classics not already covered
  for (const name of ["Matthew Henry", "John Calvin", "Charles H. Spurgeon", "Albert Barnes", "John Wesley"]) {
    push(recordFor(name));
  }
  return out;
}

// --- Weighting / scoring ----------------------------------------------------

export type SelectionFilters = {
  era?: "modern" | "historical";
  publicDomain?: boolean;
  country?: string; // free text — matched via regionFromAny
  region?: Region;
};

export type SelectionOptions = {
  targetCount?: number; // soft target
  minCount?: number;    // default 10
  maxCount?: number;    // default 16
  filter?: SelectionFilters;
  mustInclude?: string[]; // admin pinned names
  blocked?: ReadonlySet<string>;
  // Recency: normalized name keys from the immediately previous lookup.
  // The engine guarantees at least `minNewAuthors` chosen names that are
  // NOT in this set (subject to pool size).
  recentlyUsed?: ReadonlySet<string>;
  // Normalized name keys ever surfaced to this scope. Authors not in this
  // set get a weighting bonus so the rotation eventually covers everyone.
  everUsed?: ReadonlySet<string>;
  // Minimum count of authors not present in `recentlyUsed`. Defaults to 2.
  minNewAuthors?: number;
  // Reserved for future relevance scoring; today we treat all candidates as
  // equally relevant since we don't have per-verse author indices.
  verseRef?: string;
};

function passesFilter(rec: CommentatorRecord, f?: SelectionFilters): boolean {
  if (!f) return true;
  if (f.era && rec.era !== f.era) return false;
  if (f.publicDomain && !rec.publicDomain) return false;
  if (f.region && rec.region !== f.region) return false;
  if (f.country) {
    const want = regionFromAny(f.country);
    if (want && rec.region && rec.region !== want) return false;
  }
  return true;
}

function weight(
  rec: CommentatorRecord,
  recentlyUsed?: ReadonlySet<string>,
  everUsed?: ReadonlySet<string>,
): number {
  let w = 1.0;
  if (rec.gender === "female") w += 0.25;
  if (rec.region && GLOBAL_SOUTH.has(rec.region)) w += 0.25;
  if (rec.denomination === "orthodox" || rec.denomination === "pentecostal") w += 0.15;
  if (rec.publicDomain) w += 0.35; // anchor on PD classics so they remain present
  const key = normalizeName(rec.name);
  if (everUsed && !everUsed.has(key)) w += 0.5;   // surface never-used authors
  if (recentlyUsed && !recentlyUsed.has(key)) w += 0.2; // prefer rotation
  return w;
}

export type SelectionResult = {
  commentators: CommentatorRecord[];
  warning?: string;
};

// Core selection.
export function selectCommentatorsForVerse(
  verseRef: string,
  options: SelectionOptions = {},
): SelectionResult {
  const minCount = options.minCount ?? 10;
  const maxCount = options.maxCount ?? 16;
  const target = Math.min(maxCount, Math.max(minCount, options.targetCount ?? 12));
  const recentlyUsed = options.recentlyUsed ?? new Set<string>();
  const everUsed = options.everUsed ?? new Set<string>();
  const minNewAuthors = options.minNewAuthors ?? 2;

  const blocked = options.blocked ?? new Set<string>();
  const pool = buildBasePool(blocked).filter((r) => passesFilter(r, options.filter));

  const chosen = new Map<string, CommentatorRecord>();
  const pinnedKeys = new Set<string>();
  const add = (rec: CommentatorRecord | undefined) => {
    if (!rec) return;
    chosen.set(normalizeName(rec.name), rec);
  };

  // Admin must-include first (subject to filter). Pinned names are never
  // swapped out by the recency rule below.
  for (const name of options.mustInclude ?? []) {
    const key = normalizeName(name);
    if (blocked.has(key)) continue;
    const rec = pool.find((r) => normalizeName(r.name) === key) ?? recordFor(name);
    add(rec);
    pinnedKeys.add(key);
  }

  // Rule B — diversity: ≥1 per region present, prefer ≥1 woman.
  const byRegion = new Map<Region, CommentatorRecord[]>();
  for (const r of pool) {
    if (!r.region) continue;
    const arr = byRegion.get(r.region) ?? [];
    arr.push(r);
    byRegion.set(r.region, arr);
  }
  for (const region of REGIONS) {
    if (chosen.size >= target) break;
    const list = byRegion.get(region);
    if (!list || list.length === 0) continue;
    if ([...chosen.values()].some((c) => c.region === region)) continue;
    const sorted = [...list].sort((a, b) => weight(b, recentlyUsed, everUsed) - weight(a, recentlyUsed, everUsed));
    add(sorted[0]);
  }
  // Anchor: ensure ≥3 public-domain classics so coverage stays recognisable.
  const pdAnchors = pool.filter((r) => r.publicDomain).sort((a, b) => weight(b, recentlyUsed, everUsed) - weight(a, recentlyUsed, everUsed));
  for (const r of pdAnchors) {
    const pdCount = [...chosen.values()].filter((c) => c.publicDomain).length;
    if (pdCount >= 3) break;
    if (chosen.size >= target) break;
    add(r);
  }
  if (![...chosen.values()].some((c) => c.gender === "female")) {
    const woman = [...pool]
      .sort((a, b) => weight(b, recentlyUsed, everUsed) - weight(a, recentlyUsed, everUsed))
      .find((r) => r.gender === "female");
    if (woman) add(woman);
  }

  // Rule D — fill remaining slots with highest-weighted candidates.
  const remaining = [...pool]
    .filter((r) => !chosen.has(normalizeName(r.name)))
    .sort((a, b) => weight(b, recentlyUsed, everUsed) - weight(a, recentlyUsed, everUsed));
  for (const r of remaining) {
    if (chosen.size >= target) break;
    add(r);
  }

  // Cap at maxCount.
  let list = [...chosen.values()].slice(0, maxCount);

  // Rule E — recency rotation: at least `minNewAuthors` chosen names must NOT
  // appear in `recentlyUsed`. If fewer than that, swap in unused candidates
  // (prefer never-used over merely not-recent), evicting the lowest-weighted
  // recently-used non-pinned entries. If the pool is too small, include as
  // many unused authors as exist — never fail.
  if (recentlyUsed.size > 0) {
    const isNew = (rec: CommentatorRecord) => !recentlyUsed.has(normalizeName(rec.name));
    let newCount = list.filter(isNew).length;
    if (newCount < minNewAuthors) {
      // Candidates to swap IN — not already chosen, not blocked, not recent.
      const swapInPool = pool
        .filter((r) => !chosen.has(normalizeName(r.name)))
        .filter((r) => !recentlyUsed.has(normalizeName(r.name)))
        .sort((a, b) => {
          // Prefer never-used, then weight.
          const aNever = everUsed.has(normalizeName(a.name)) ? 0 : 1;
          const bNever = everUsed.has(normalizeName(b.name)) ? 0 : 1;
          if (aNever !== bNever) return bNever - aNever;
          return weight(b, recentlyUsed, everUsed) - weight(a, recentlyUsed, everUsed);
        });
      // Evictable entries — lowest-weighted recently-used, non-pinned.
      const evictOrder = [...list]
        .filter((r) => !pinnedKeys.has(normalizeName(r.name)))
        .filter((r) => recentlyUsed.has(normalizeName(r.name)))
        .sort((a, b) => weight(a, recentlyUsed, everUsed) - weight(b, recentlyUsed, everUsed));

      while (newCount < minNewAuthors && swapInPool.length > 0) {
        const incoming = swapInPool.shift()!;
        const evict = evictOrder.shift();
        if (evict) {
          chosen.delete(normalizeName(evict.name));
        } else if (chosen.size >= maxCount) {
          break; // nothing to evict and at cap
        }
        chosen.set(normalizeName(incoming.name), incoming);
        list = [...chosen.values()].slice(0, maxCount);
        newCount = list.filter(isNew).length;
      }
    }
  }

  let warning: string | undefined;
  if (list.length < minCount) {
    warning = `Selection engine returned ${list.length} commentators (below minCount=${minCount}) for "${verseRef}".`;
    console.warn(warning);
  }
  return { commentators: list, warning };
}

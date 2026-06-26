// Classifies theologians into one of three biblical worldview lenses, with
// support for a primary lens and optional secondary lenses. A theologian
// surfaces in any worldview section where they are listed as primary OR
// secondary AND their commentary on the verse meaningfully engages that
// worldview (the latter is enforced downstream by only showing authors who
// actually appear in a contrast position for that worldview).

export type Worldview = "guilt-innocence" | "shame-honour" | "fear-power";

export const WORLDVIEWS: { key: Worldview; labelKey: string }[] = [
  { key: "guilt-innocence", labelKey: "worldview.guiltInnocence" },
  { key: "shame-honour", labelKey: "worldview.shameHonour" },
  { key: "fear-power", labelKey: "worldview.fearPower" },
];

// Countries primarily oriented around fear-power (spiritual cosmology,
// ancestors, unseen powers — common framing across sub-Saharan Africa and
// parts of Oceania).
const FEAR_POWER_COUNTRIES = new Set([
  "NG", "KE", "ET", "ZA", "GH", "UG", "ZW", "CM", "AO", "MZ", "TZ", "RW",
  "BJ", "SN", "ML", "CI", "CD", "MG", "PG",
]);

// Countries primarily oriented around guilt-innocence (Western legal-moral frame).
const GUILT_INNOCENCE_COUNTRIES = new Set([
  "US", "CA", "GB", "DE", "NL", "CH", "SE", "NO", "DK", "IE", "FI", "IS", "AU", "NZ",
]);

// Explicit author overrides where geography alone misleads.
const AUTHOR_PRIMARY_OVERRIDE: Record<string, Worldview> = {
  "John Calvin": "guilt-innocence",
  "Irenaeus": "guilt-innocence",
};

export function primaryWorldview(
  author: string,
  countryCode?: string | null,
): Worldview {
  const override = AUTHOR_PRIMARY_OVERRIDE[author];
  if (override) return override;
  const code = (countryCode ?? "").toUpperCase();
  if (FEAR_POWER_COUNTRIES.has(code)) return "fear-power";
  if (GUILT_INNOCENCE_COUNTRIES.has(code)) return "guilt-innocence";
  return "shame-honour";
}

// Secondary lenses any major theologian also engages — keeps every worldview
// section populated without flattening into "every author everywhere". The
// secondary set is paired with each primary so theologians can legitimately
// appear in two lenses, never all three at once.
const SECONDARY_BY_PRIMARY: Record<Worldview, Worldview[]> = {
  "guilt-innocence": ["shame-honour"],
  "shame-honour": ["fear-power"],
  "fear-power": ["shame-honour"],
};

export function worldviewsForAuthor(
  author: string,
  countryCode?: string | null,
): { primary: Worldview; secondary: Worldview[] } {
  const primary = primaryWorldview(author, countryCode);
  return { primary, secondary: SECONDARY_BY_PRIMARY[primary] };
}

export function authorEngagesWorldview(
  author: string,
  worldview: Worldview,
  countryCode?: string | null,
): boolean {
  const { primary, secondary } = worldviewsForAuthor(author, countryCode);
  return primary === worldview || secondary.includes(worldview);
}

// Backwards-compatible single-worldview helper (still used elsewhere).
export function worldviewForAuthor(
  author: string,
  countryCode?: string | null,
): Worldview {
  return primaryWorldview(author, countryCode);
}

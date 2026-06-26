// Region groupings + author→country mapping used by the unified comparison view.

import { REGIONAL_COUNTRIES } from "./regional-commentary.functions";

export type RegionKey =
  | "europe"
  | "north_america"
  | "latin_america"
  | "africa"
  | "asia"
  | "oceania";

export const REGIONS: { key: RegionKey; label: string; countries: string[] }[] = [
  { key: "africa", label: "Africa", countries: ["EG", "ET", "ZA", "KE", "NG", "GH"] },
  { key: "asia", label: "Asia", countries: ["KR", "JP", "CN", "IN", "PH", "IL", "TW", "LK", "TH"] },
  { key: "europe", label: "Europe", countries: ["GB", "DE", "FR", "CH", "NL", "IT", "ES", "GR", "RU", "IE", "SE", "NO", "DK"] },
  { key: "latin_america", label: "Latin America", countries: ["BR", "MX", "AR", "PE", "EC", "PR", "CR"] },
  { key: "north_america", label: "North America", countries: ["US", "CA"] },
  { key: "oceania", label: "Oceania", countries: ["AU"] },
];

const COUNTRY_NAMES = new Map(REGIONAL_COUNTRIES.map((c) => [c.code, c.name]));

export function countryNameFor(code: string | null | undefined): string | null {
  if (!code) return null;
  return COUNTRY_NAMES.get(code.toUpperCase()) ?? code.toUpperCase();
}

// Static country-of-origin map for well-known classic, modern, and historical
// commentators. Used to render a small country label next to each author.
export const AUTHOR_COUNTRIES: Record<string, string> = {
  // Classic
  "Matthew Henry": "GB",
  "John Calvin": "FR",
  "Charles H. Spurgeon": "GB",
  "Albert Barnes": "US",
  "John Wesley": "GB",
  // Modern / Contemporary
  "N. T. Wright": "GB",
  "John Stott": "GB",
  "J. I. Packer": "GB",
  "D. A. Carson": "CA",
  "Gordon Fee": "CA",
  "Tim Keller": "US",
  "John Piper": "US",
  "Walter Brueggemann": "US",
  "Jürgen Moltmann": "DE",
  "Alister McGrath": "GB",
  "Derek Prince": "GB",
  // Global South — Africa
  "John Mbiti": "KE",
  "Byang Kato": "NG",
  "Mercy Amba Oduyoye": "GH",
  "Kwame Bediako": "GH",
  // Global South — Asia
  "Kosuke Koyama": "JP",
  "C. S. Song": "TW",
  "Ajith Fernando": "LK",
  // Global South — Latin America
  "Samuel Escobar": "PE",
  "René Padilla": "EC",
  "Orlando Costas": "PR",
  "Gustavo Gutiérrez": "PE",
  "Elsa Tamez": "MX",
  // Foundational
  "Origen": "EG",
  "Augustine": "DZ",
  "John Chrysostom": "TR",
  "Thomas Aquinas": "IT",
  // Church Fathers
  "Athanasius": "EG",
  "Jerome": "HR",
  "Ambrose": "IT",
  "Gregory of Nazianzus": "TR",
  "Irenaeus": "FR",
  "Tertullian": "TN",
  "Cyril of Alexandria": "EG",
  // Reformation
  "Martin Luther": "DE",
  "Huldrych Zwingli": "CH",
  "Philip Melanchthon": "DE",
  "John Knox": "GB",
  "William Tyndale": "GB",
  // First-class additions
  "George Müller": "GB",
  "Mother Teresa": "IN",
};

// Country-name fallback for codes not in REGIONAL_COUNTRIES (used by author map).
const EXTRA_COUNTRY_NAMES: Record<string, string> = {
  DZ: "Algeria",
  TR: "Türkiye",
  HR: "Croatia",
  TN: "Tunisia",
  GH: "Ghana",
  TW: "Taiwan",
  LK: "Sri Lanka",
  TH: "Thailand",
  PE: "Peru",
  EC: "Ecuador",
  PR: "Puerto Rico",
  CR: "Costa Rica",
};

export function resolveCountryName(code: string | null | undefined): string | null {
  if (!code) return null;
  const upper = code.toUpperCase();
  return COUNTRY_NAMES.get(upper) ?? EXTRA_COUNTRY_NAMES[upper] ?? upper;
}

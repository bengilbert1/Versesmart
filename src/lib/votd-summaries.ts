// Lazy-loaded per-language static worldview summaries for the 365-day VOTD cycle.
// Generated offline; no runtime AI calls.
import type { LanguageCode } from "./languages";
import type { VotdSummaries } from "./votd-defaults";
import en from "@/locales/votd/en.json";

type Entry = { gi: string; sh: string; fp: string };
type Bundle = Record<string, Entry>;

const cache: Partial<Record<LanguageCode, Bundle>> = { en: en as Bundle };
const inflight: Partial<Record<LanguageCode, Promise<Bundle>>> = {};

const LOADERS: Record<Exclude<LanguageCode, "en">, () => Promise<{ default: Bundle }>> = {
  es: () => import("@/locales/votd/es.json"),
  fr: () => import("@/locales/votd/fr.json"),
  de: () => import("@/locales/votd/de.json"),
  "zh-Hans": () => import("@/locales/votd/zh-Hans.json"),
  "zh-Hant": () => import("@/locales/votd/zh-Hant.json"),
  hi: () => import("@/locales/votd/hi.json"),
  ar: () => import("@/locales/votd/ar.json"),
};

export async function loadVotdLocale(code: LanguageCode): Promise<Bundle> {
  if (cache[code]) return cache[code]!;
  if (inflight[code]) return inflight[code]!;
  if (code === "en") return en as Bundle;
  const p = LOADERS[code]()
    .then((m) => {
      cache[code] = m.default;
      return m.default;
    })
    .catch(() => en as Bundle)
    .finally(() => {
      delete inflight[code];
    });
  inflight[code] = p;
  return p;
}

export function getCachedVotdSummaries(
  code: LanguageCode,
  dayOfYear: number,
): VotdSummaries | null {
  const bundle = cache[code] ?? (code === "en" ? (en as Bundle) : null);
  if (!bundle) return null;
  const entry = bundle[String(dayOfYear)] ?? (en as Bundle)[String(dayOfYear)];
  if (!entry) return null;
  return {
    guiltInnocence: entry.gi,
    shameHonour: entry.sh,
    fearPower: entry.fp,
  };
}

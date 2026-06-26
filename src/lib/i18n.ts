// Lightweight i18n. Translations live in /src/locales/<code>.json and are
// lazy-loaded the first time a language is selected. English ships in the
// initial bundle so first paint is instant; everything else is fetched on
// demand and then cached for the session.

import type { LanguageCode } from "./languages";
import en from "@/locales/en.json";

export type Dict = typeof en;
type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

const cache: Partial<Record<LanguageCode, DeepPartial<Dict>>> = { en };
const inflight: Partial<Record<LanguageCode, Promise<DeepPartial<Dict>>>> = {};

// Lazy loaders — Vite splits each into its own chunk.
const LOADERS: Record<Exclude<LanguageCode, "en">, () => Promise<{ default: DeepPartial<Dict> }>> = {
  es: () => import("@/locales/es.json"),
  fr: () => import("@/locales/fr.json"),
  de: () => import("@/locales/de.json"),
  "zh-Hans": () => import("@/locales/zh-Hans.json"),
  "zh-Hant": () => import("@/locales/zh-Hant.json"),
  hi: () => import("@/locales/hi.json"),
  ar: () => import("@/locales/ar.json"),
};

export async function loadLocale(code: LanguageCode): Promise<DeepPartial<Dict>> {
  if (cache[code]) return cache[code]!;
  if (inflight[code]) return inflight[code]!;
  if (code === "en") {
    cache.en = en;
    return en;
  }
  const p = LOADERS[code]()
    .then((m) => {
      cache[code] = m.default;
      return m.default;
    })
    .catch((err) => {
      console.warn(`[i18n] failed to load ${code}, falling back to English`, err);
      return en as DeepPartial<Dict>;
    })
    .finally(() => {
      delete inflight[code];
    });
  inflight[code] = p;
  return p;
}

export function getCached(code: LanguageCode): DeepPartial<Dict> | null {
  return cache[code] ?? null;
}

// Resolve "a.b.c" against an object. Returns undefined when missing.
function lookup(obj: unknown, path: string): string | undefined {
  let cur: unknown = obj;
  for (const part of path.split(".")) {
    if (cur && typeof cur === "object" && part in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return typeof cur === "string" ? cur : undefined;
}

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`));
}

// Track keys we've already warned about, so the console doesn't flood.
const warned = new Set<string>();

export function translate(
  dict: DeepPartial<Dict> | null,
  key: string,
  vars?: Record<string, string | number>,
): string {
  const localized = dict ? lookup(dict, key) : undefined;
  if (localized !== undefined) return interpolate(localized, vars);
  const fallback = lookup(en, key);
  if (fallback !== undefined) {
    if (dict && dict !== en && !warned.has(key)) {
      warned.add(key);
      console.warn(`[i18n] missing key "${key}" — falling back to English`);
    }
    return interpolate(fallback, vars);
  }
  if (!warned.has(key)) {
    warned.add(key);
    console.warn(`[i18n] missing key "${key}" in every language`);
  }
  return key;
}

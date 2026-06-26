// Language configuration for Verse Smart.
// Translation codes correspond to public-domain Bible translations.
// Native names are used in the UI dropdown for instant recognition.

export type LanguageCode = "en" | "es" | "fr" | "de" | "zh-Hans" | "zh-Hant" | "hi" | "ar";

export interface LanguageConfig {
  code: LanguageCode;
  nativeName: string; // shown in the dropdown
  englishName: string; // used inside AI prompts
  translationCode: string; // value passed to commentary/verse_cache key
  translationName: string; // human label for the translation
}

export const LANGUAGES: LanguageConfig[] = [
  {
    code: "en",
    nativeName: "English",
    englishName: "English",
    translationCode: "WEB",
    translationName: "World English Bible (WEB)",
  },
  {
    code: "es",
    nativeName: "Español",
    englishName: "Spanish",
    translationCode: "RV1909",
    translationName: "Reina-Valera 1909",
  },
  {
    code: "fr",
    nativeName: "Français",
    englishName: "French",
    translationCode: "LSG1910",
    translationName: "Louis Segond 1910",
  },
  {
    code: "de",
    nativeName: "Deutsch",
    englishName: "German",
    translationCode: "LUTH1912",
    translationName: "Luther Bibel 1912",
  },
  {
    code: "zh-Hans",
    nativeName: "简体中文",
    englishName: "Simplified Chinese",
    translationCode: "CUVS",
    translationName: "和合本 (CUV 简体)",
  },
  {
    code: "zh-Hant",
    nativeName: "繁體中文",
    englishName: "Traditional Chinese",
    translationCode: "CUVT",
    translationName: "和合本 (CUV 繁體)",
  },
  {
    code: "hi",
    nativeName: "हिन्दी",
    englishName: "Hindi",
    translationCode: "HHBD",
    translationName: "Hindi Holy Bible (HHBD)",
  },
  {
    code: "ar",
    nativeName: "العربية",
    englishName: "Arabic",
    translationCode: "SVD",
    translationName: "Smith–Van Dyke Arabic Bible (1865)",
  },
];

// Languages that render right-to-left.
export const RTL_LANGUAGES: ReadonlySet<LanguageCode> = new Set(["ar"]);
export function isRtl(code: LanguageCode): boolean {
  return RTL_LANGUAGES.has(code);
}

export const DEFAULT_LANGUAGE: LanguageCode = "en";

export function getLanguage(code: string | null | undefined): LanguageConfig {
  return LANGUAGES.find((l) => l.code === code) ?? LANGUAGES[0];
}

// Cloudflare country code → suggested language. Conservative — only suggest where
// the language is the clear majority. Otherwise we leave it to the user.
const COUNTRY_TO_LANG: Record<string, LanguageCode> = {
  // Spanish
  ES: "es", MX: "es", AR: "es", CO: "es", PE: "es", VE: "es", CL: "es",
  EC: "es", GT: "es", CU: "es", BO: "es", DO: "es", HN: "es", PY: "es",
  SV: "es", NI: "es", CR: "es", PA: "es", UY: "es", PR: "es",
  // French
  FR: "fr", MC: "fr", LU: "fr",
  // German
  DE: "de", AT: "de", LI: "de",
  // Simplified Chinese
  CN: "zh-Hans", SG: "zh-Hans",
  // Traditional Chinese
  TW: "zh-Hant", HK: "zh-Hant", MO: "zh-Hant",
};

export function suggestedLanguageFromCountry(country: string | null | undefined): LanguageCode | null {
  if (!country) return null;
  return COUNTRY_TO_LANG[country.toUpperCase()] ?? null;
}

// Localized UI strings — keep this list small and curated.
type UIStrings = {
  pricing: string;
  account: string;
  signIn: string;
  language: string;
  switchTo: string;
  keepEnglish: string;
};

export const UI_STRINGS: Record<LanguageCode, UIStrings> = {
  en: {
    pricing: "Pricing", account: "Account", signIn: "Sign in",
    language: "Language", switchTo: "View in English?", keepEnglish: "Keep current",
  },
  es: {
    pricing: "Precios", account: "Cuenta", signIn: "Iniciar sesión",
    language: "Idioma", switchTo: "¿Ver en español?", keepEnglish: "Mantener actual",
  },
  fr: {
    pricing: "Tarifs", account: "Compte", signIn: "Connexion",
    language: "Langue", switchTo: "Voir en français ?", keepEnglish: "Garder",
  },
  de: {
    pricing: "Preise", account: "Konto", signIn: "Anmelden",
    language: "Sprache", switchTo: "Auf Deutsch anzeigen?", keepEnglish: "Behalten",
  },
  "zh-Hans": {
    pricing: "定价", account: "账户", signIn: "登录",
    language: "语言", switchTo: "切换到简体中文？", keepEnglish: "保持当前",
  },
  "zh-Hant": {
    pricing: "定價", account: "帳戶", signIn: "登入",
    language: "語言", switchTo: "切換到繁體中文？", keepEnglish: "保持目前",
  },
  hi: {
    pricing: "मूल्य निर्धारण", account: "खाता", signIn: "साइन इन करें",
    language: "भाषा", switchTo: "हिन्दी में देखें?", keepEnglish: "वर्तमान रखें",
  },
  ar: {
    pricing: "الأسعار", account: "الحساب", signIn: "تسجيل الدخول",
    language: "اللغة", switchTo: "العرض بالعربية؟", keepEnglish: "الإبقاء على الحالي",
  },
};

// Inserted into every AI commentary system prompt when language !== "en".
// Keeps the analytical structure identical but switches output language and
// translation reference. We deliberately keep the SAME public-domain commentator
// set (Henry, Calvin, Spurgeon, Barnes, Wesley + historical groups + modern voices)
// across all languages — they are universally recognized and PD — and have the AI
// write its summaries in the target language. This avoids fabricating obscure
// language-specific commentators.
export function languageDirective(code: LanguageCode, translationName: string): string {
  if (code === "en") return "";
  const langName = getLanguage(code).englishName;
  return `\n\nCRITICAL OUTPUT LANGUAGE: Write EVERY field of the JSON response — verseText, summaries, key insights, common ground, contrast topics, contrast positions, all of it — entirely in ${langName}. Author names and tradition labels may stay in their original form (e.g. "Matthew Henry", "Reformed") since they are proper nouns. When quoting or paraphrasing verse text, use the ${translationName} translation. Do NOT mix English into the response.`;
}

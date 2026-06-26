import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_LANGUAGE, getLanguage, isRtl, type LanguageCode, type LanguageConfig } from "./languages";
import { loadLocale, getCached, translate, type Dict } from "./i18n";

const STORAGE_KEY = "vs-language";

interface LanguageContextValue {
  language: LanguageCode;
  config: LanguageConfig;
  setLanguage: (code: LanguageCode) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
  // Bumped every time the active dictionary is swapped; lets consumers
  // re-render even though they read translations through the t() function.
  dictVersion: number;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<LanguageCode>(DEFAULT_LANGUAGE);
  const [dictVersion, setDictVersion] = useState(0);

  // Always default to English on first load. We do NOT read localStorage
  // or the user's saved DB preference on mount so the app opens in English
  // every time. The user can still switch languages during the session and
  // that choice is persisted for the current session.

  // 1) Load the dictionary for the active language and bump the version.
  useEffect(() => {
    let cancelled = false;
    loadLocale(language).then(() => {
      if (!cancelled) setDictVersion((v) => v + 1);
    });
    return () => {
      cancelled = true;
    };
  }, [language]);

  // Sync <html lang> and <html dir> so RTL languages (e.g. Arabic) lay out
  // properly across every route. Static text always comes from the locale
  // bundle above — no AI calls at runtime.
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.lang = language;
    document.documentElement.dir = isRtl(language) ? "rtl" : "ltr";
  }, [language]);

  const setLanguage = useCallback((code: LanguageCode) => {
    setLanguageState(code);
    try {
      window.localStorage.setItem(STORAGE_KEY, code);
    } catch {
      /* ignore */
    }
    // Fire-and-forget profile sync.
    supabase.auth.getSession().then(({ data }) => {
      const user = data.session?.user;
      if (!user) return;
      supabase
        .from("user_preferences")
        .upsert({ user_id: user.id, language: code, updated_at: new Date().toISOString() });
    });
  }, []);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) =>
      translate(getCached(language) as Partial<Dict> | null, key, vars),
    // dictVersion ensures memoization re-runs once the async dict resolves.
    [language, dictVersion],
  );

  return (
    <LanguageContext.Provider value={{ language, config: getLanguage(language), setLanguage, t, dictVersion }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    return {
      language: DEFAULT_LANGUAGE,
      config: getLanguage(DEFAULT_LANGUAGE),
      setLanguage: () => {},
      t: (key, vars) => translate(null, key, vars),
      dictVersion: 0,
    };
  }
  return ctx;
}

// Convenience shorthand for components that only need translation.
export function useT() {
  return useLanguage().t;
}

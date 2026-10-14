import { useCallback } from 'react';
import type { Language } from '../data/settingsRepo';
import en from '../data/strings.en.json';
import hi from '../data/strings.hi.json';
import { useSettings } from '../store/settings';

export type StringKey = Exclude<keyof typeof en, `_meta.${string}`>;
export type TranslateParams = Readonly<Record<string, string>>;

export const DEFAULT_LANGUAGE: Language = 'en';

const DICTS: Record<Language, Readonly<Record<string, string>>> = { en, hi };

const warned = new Set<string>();

function warnMissing(language: Language, key: string): void {
  if (!__DEV__) {
    return;
  }
  const id = `${language}:${key}`;
  if (warned.has(id)) {
    return;
  }
  warned.add(id);
  console.warn(`[i18n] missing key "${key}" for language "${language}"`);
}

function interpolate(template: string, params: TranslateParams): string {
  return template.replace(/\{(\w+)\}/g, (match: string, name: string) => params[name] ?? match);
}

/** Pure translation. Falls back to English, then to the key itself. */
export function translate(language: Language, key: StringKey, params?: TranslateParams): string {
  let raw = DICTS[language][key];
  if (raw === undefined) {
    warnMissing(language, key);
    raw = DICTS.en[key] ?? key;
  }
  return params === undefined ? raw : interpolate(raw, params);
}

/** For non-React code. Components should use useLanguage() so they re-render on change. */
export function t(key: StringKey, params?: TranslateParams): string {
  const language = useSettings.getState().language ?? DEFAULT_LANGUAGE;
  return translate(language, key, params);
}

export interface UseLanguage {
  language: Language;
  setLanguage(language: Language): Promise<void>;
  t(key: StringKey, params?: TranslateParams): string;
}

export function useLanguage(): UseLanguage {
  const stored = useSettings((s) => s.language);
  const setLanguage = useSettings((s) => s.setLanguage);
  const language = stored ?? DEFAULT_LANGUAGE;
  const boundT = useCallback(
    (key: StringKey, params?: TranslateParams) => translate(language, key, params),
    [language],
  );
  return { language, setLanguage, t: boundT };
}

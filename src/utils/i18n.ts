/**
 * Bilingual helper — extracts the preferred language from a BilingualText field.
 *
 * Handles three cases:
 *   1. { es: "...", en: "..." }  → returns the requested lang
 *   2. Plain string (legacy)    → returns the string as-is
 *   3. null/undefined           → returns fallback
 */

import { useSyncExternalStore } from 'react';

export interface BilingualText {
  es: string;
  en: string;
}

type MaybeBilingual = BilingualText | string | null | undefined;

export type Lang = keyof BilingualText;

const STORAGE_KEY = 'postalpeek_lang';

// ── Module-level reactive state ──
let currentLang: Lang = (localStorage.getItem(STORAGE_KEY) as Lang) || 'es';
const listeners = new Set<() => void>();

function emitChange() {
  for (const fn of listeners) fn();
}

export function getLang(): Lang {
  return currentLang;
}

export function setLang(lang: Lang) {
  if (lang === currentLang) return;
  currentLang = lang;
  localStorage.setItem(STORAGE_KEY, lang);
  emitChange();
}

export function toggleLang() {
  setLang(currentLang === 'es' ? 'en' : 'es');
}

/** React hook — causes a re-render when the language changes. */
export function useLang(): Lang {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => currentLang,
  );
}

/**
 * Extract text from a bilingual field.
 * Usage: t(item.category) → returns text in the current app language
 *        t(item.category, 'en') → forces English
 */
export function t(value: MaybeBilingual, lang: Lang = currentLang): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  const result = value[lang] || value.es || '';
  // Defensive: guard against malformed JSONB (e.g., nested objects)
  if (typeof result !== 'string') return '';
  return result;
}

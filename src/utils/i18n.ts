/**
 * Bilingual helper — extracts the preferred language from a BilingualText field.
 *
 * Handles three cases:
 *   1. { es: "...", en: "..." }  → returns the requested lang
 *   2. Plain string (legacy)    → returns the string as-is
 *   3. null/undefined           → returns fallback
 */

export interface BilingualText {
  es: string;
  en: string;
}

type MaybeBilingual = BilingualText | string | null | undefined;

/** Default language for the app */
const DEFAULT_LANG: keyof BilingualText = 'es';

/**
 * Extract text from a bilingual field.
 * Usage: t(item.category) → returns the Spanish text by default
 *        t(item.category, 'en') → returns the English text
 */
export function t(value: MaybeBilingual, lang: keyof BilingualText = DEFAULT_LANG): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return value[lang] || value.es || '';
}

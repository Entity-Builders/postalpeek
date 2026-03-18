import { useState, useCallback, useRef } from 'react';
import type { FeedItem } from '../components/Postcard';
import { normalize, getSearchableFields, matchesActiveFilters } from './searchUtils';

export interface SmartSearchResult {
  tags: string[];
  time_of_day?: string | null;
  weather?: string | null;
  scene_type?: string | null;
  country?: string | null;
  city?: string | null;
  rarity?: string | null;
  freeTextSearch?: string | null;
}

/**
 * Heuristic: is this query "conversational" enough to warrant an AI call?
 * If it's just 1-2 simple words, let the auto-fallback handle it (0 results → force AI).
 */
function isNaturalLanguageQuery(query: string): boolean {
  const trimmed = query.trim();
  const words = trimmed.split(/\s+/);

  // 3+ words → likely conversational
  if (words.length >= 3) return true;

  // Intent words in Spanish/English that signal natural language
  const intentWords = [
    'quiero', 'dame', 'mostrame', 'busco', 'todas', 'todos',
    'show', 'find', 'give', 'want', 'all', 'with',
    'con', 'sin', 'del', 'las', 'los', 'mis',
  ];

  return words.some((w) => intentWords.includes(w.toLowerCase()));
}

interface UseSmartSearchOptions {
  allTagNames: string[];
  debounceMs?: number;
}

export function useSmartSearch({ allTagNames, debounceMs = 800 }: UseSmartSearchOptions) {
  const [isSearching, setIsSearching] = useState(false);
  const [smartResult, setSmartResult] = useState<SmartSearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cache = useRef<Map<string, SmartSearchResult>>(new Map());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const clearSmartSearch = useCallback(() => {
    setSmartResult(null);
    setError(null);
    setIsSearching(false);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  }, []);

  const triggerSmartSearch = useCallback(
    (query: string, force = false) => {
      // Clear previous timer and null the ref so filterItems knows no debounce is pending
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (abortRef.current) abortRef.current.abort();

      const trimmed = query.trim();

      // Don't trigger for empty or very short queries
      if (!trimmed || trimmed.length < 3) {
        clearSmartSearch();
        return;
      }

      // Skip AI unless forced (e.g., 0 classic results) or query looks conversational
      if (!force && !isNaturalLanguageQuery(trimmed)) {
        setSmartResult(null);
        setIsSearching(false);
        return;
      }

      // Check cache
      const cacheKey = trimmed.toLowerCase();
      if (cache.current.has(cacheKey)) {
        setSmartResult(cache.current.get(cacheKey)!);
        setIsSearching(false);
        return;
      }

      // Debounce the API call — only show indicator when the call actually fires
      timerRef.current = setTimeout(async () => {
        timerRef.current = null; // Timer has fired — no longer pending
        setIsSearching(true);
        const controller = new AbortController();
        abortRef.current = controller;

        try {
          const baseUrl =
            import.meta.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321';

          const response = await fetch(
            `${baseUrl}/functions/v1/postalpeek-search-intent`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                apikey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
              },
              body: JSON.stringify({
                query: trimmed,
                availableTags: allTagNames.slice(0, 100),
              }),
              signal: controller.signal,
            },
          );

          if (!response.ok) {
            throw new Error(`Search failed: ${response.status}`);
          }

          const result: SmartSearchResult = await response.json();

          // Cache it
          cache.current.set(cacheKey, result);

          // Keep cache size reasonable
          if (cache.current.size > 50) {
            const firstKey = cache.current.keys().next().value;
            if (firstKey) cache.current.delete(firstKey);
          }

          setSmartResult(result);
          setError(null);
        } catch (err: unknown) {
          if (err instanceof Error && err.name === 'AbortError') return;
          console.warn('[SmartSearch] AI search failed, falling back:', err);
          setError('AI search unavailable');
          setSmartResult(null);
        } finally {
          setIsSearching(false);
        }
      }, debounceMs);
    },
    [allTagNames, debounceMs, clearSmartSearch],
  );



  /** Unified filterItems matching the same shape as useClassicSearch */
  const filterItems = useCallback(
    (items: FeedItem[], searchQuery: string, activeFilters: string[]): FeedItem[] => {
      const q = searchQuery.trim();
      return items.filter((item) => {
        let matchesSearch = true;

        if (smartResult && q) {
          matchesSearch = smartFilterItem(item, smartResult);
        } else if (q && timerRef.current) {
          // AI debounce is pending — show all items while waiting
          matchesSearch = true;
        } else if (q) {
          // No debounce pending and no AI result — use classic substring fallback
          const qNorm = normalize(q);
          const searchTerms = [qNorm];
          if (qNorm.endsWith('es') && qNorm.length > 4) searchTerms.push(qNorm.slice(0, -2));
          else if (qNorm.endsWith('s') && qNorm.length > 3) searchTerms.push(qNorm.slice(0, -1));

          const escaped = searchTerms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
          const regex = new RegExp(`(?:^|\\s|_|-)(?:${escaped.join('|')})`, 'i');
          const fields = getSearchableFields(item);
          matchesSearch = fields.some((f) => regex.test(f));
        }

        return matchesSearch && matchesActiveFilters(item, activeFilters);
      });
    },
    [smartResult],
  );

  // Manage search trigger on query changes
  const onQueryChange = useCallback(
    (query: string) => {
      if (query.trim()) {
        triggerSmartSearch(query);
      } else {
        clearSmartSearch();
      }
    },
    [triggerSmartSearch, clearSmartSearch],
  );

  return {
    filterItems,
    triggerSmartSearch,
    clearSmartSearch,
    onQueryChange,
    smartResult,
    isSearching,
    error,
  };
}

// ── Smart filter logic ────────────────────────────────────────
export function smartFilterItem(item: FeedItem, sr: SmartSearchResult): boolean {
  const fields = getSearchableFields(item);
  const conditions: boolean[] = [];

  // Match AI-resolved tags with word-boundary matching
  if (sr.tags.length > 0) {
    const tagMatch = sr.tags.some((aiTag) => {
      const aiNorm = normalize(aiTag).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const wb = new RegExp(`(?:^|[\\s_-])${aiNorm}(?:[\\s_-]|s?$)`, 'i');
      return fields.some((f) => wb.test(f));
    });
    conditions.push(tagMatch);
  }

  // Match structured fields
  if (sr.time_of_day) {
    conditions.push(
      normalize(item.time_of_day || '').includes(normalize(sr.time_of_day)),
    );
  }
  if (sr.weather) {
    conditions.push(
      normalize(item.weather || '').includes(normalize(sr.weather)),
    );
  }
  if (sr.scene_type) {
    conditions.push(
      normalize(item.scene_type || '').includes(normalize(sr.scene_type)),
    );
  }
  if (sr.country) {
    conditions.push(
      normalize(item.country || '').includes(normalize(sr.country)),
    );
  }
  if (sr.city) {
    conditions.push(
      normalize(item.city || '').includes(normalize(sr.city)),
    );
  }
  if (sr.rarity) {
    conditions.push(
      normalize(item.rarity || '').includes(normalize(sr.rarity)),
    );
  }

  // Fallback freeTextSearch (word-boundary)
  if (sr.freeTextSearch && conditions.length === 0) {
    const ftNorm = normalize(sr.freeTextSearch).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const ftBoundary = new RegExp(`(?:^|[\\s_-])${ftNorm}(?:[\\s_-]|s?$)`, 'i');
    conditions.push(fields.some((f) => ftBoundary.test(f)));
  }

  return conditions.length > 0 ? conditions.every(Boolean) : false;
}

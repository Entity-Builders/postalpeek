import { useCallback, useEffect, useMemo } from 'react';
import type { FeedItem } from '../components/Postcard';
import { useClassicSearch } from './useClassicSearch';
import { useSmartSearch } from './useSmartSearch';
import { FeatureFlags } from '../lib/featureFlags';
import { analytics } from '../lib/analytics';

export type SearchMode = 'classic' | 'smart';

interface UseSearchStrategyOptions {
  allTagNames: string[];
  searchQuery: string;
  activeFilters: string[];
}

/**
 * Strategy wrapper that reads the PostHog feature flag
 * `postalpeek_smart_search` and delegates to the right search hook.
 *
 * - false (default) → Classic typeahead + substring search
 * - true → AI-powered smart search with Gemini
 */
export function useSearchStrategy({
  allTagNames,
  searchQuery,
  activeFilters,
}: UseSearchStrategyOptions) {
  // Read feature flag (returns undefined before loaded, false by default)
  const flagValue = analytics.getFeatureFlag(FeatureFlags.SMART_SEARCH);
  const mode: SearchMode = flagValue === true || flagValue === 'true' ? 'smart' : 'classic';

  // Both strategies are initialized (hooks can't be conditional)
  const classic = useClassicSearch();
  const smart = useSmartSearch({ allTagNames });

  // Destructure stable references for dependency arrays
  const {
    filterItems: smartFilter,
    onQueryChange: smartOnQueryChange,
    triggerSmartSearch,
    smartResult,
    isSearching: smartIsSearching,
  } = smart;
  const { filterItems: classicFilter } = classic;

  // In smart mode, trigger AI search on query changes
  useEffect(() => {
    if (mode === 'smart') {
      smartOnQueryChange(searchQuery);
    }
  }, [mode, searchQuery, smartOnQueryChange]);

  // Unified filterItems
  const filterItems = useCallback(
    (items: FeedItem[]): FeedItem[] => {
      if (mode === 'smart') {
        return smartFilter(items, searchQuery, activeFilters);
      }
      return classicFilter(items, searchQuery, activeFilters);
    },
    [mode, searchQuery, activeFilters, smartFilter, classicFilter],
  );

  // Auto-fallback for smart mode: 0 results → force AI
  const checkAutoFallback = useCallback(
    (resultCount: number) => {
      if (
        mode === 'smart' &&
        resultCount === 0 &&
        searchQuery.trim().length >= 3 &&
        !smartResult &&
        !smartIsSearching
      ) {
        triggerSmartSearch(searchQuery, true);
      }
    },
    [mode, searchQuery, smartResult, smartIsSearching, triggerSmartSearch],
  );

  // Memoize return to avoid unnecessary re-renders
  return useMemo(
    () => ({
      mode,
      filterItems,
      checkAutoFallback,
      // Smart mode state (ignored in classic mode)
      isSmartSearching: mode === 'smart' ? smartIsSearching : false,
      smartSearchActive: mode === 'smart' ? !!smartResult : false,
    }),
    [mode, filterItems, checkAutoFallback, smartIsSearching, smartResult],
  );
}

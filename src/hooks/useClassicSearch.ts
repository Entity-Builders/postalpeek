import { useCallback } from 'react';
import type { FeedItem } from '../components/Postcard';
import { normalize, getSearchableFields, matchesActiveFilters } from './searchUtils';

/**
 * Classic typeahead + substring search strategy.
 * Instant, client-side, no API calls.
 */
export function useClassicSearch() {
  const filterItems = useCallback(
    (items: FeedItem[], searchQuery: string, activeFilters: string[]): FeedItem[] => {
      return items.filter((item) => {
        const q = searchQuery.trim();
        let matchesSearch = true;

        if (q) {
          const qNorm = normalize(q);

          // Basic plural stemming for English/Spanish
          const searchTerms = [qNorm];
          if (qNorm.endsWith('es') && qNorm.length > 4) {
            searchTerms.push(qNorm.slice(0, -2));
          } else if (qNorm.endsWith('s') && qNorm.length > 3) {
            searchTerms.push(qNorm.slice(0, -1));
          }

          const escapedTerms = searchTerms.map((term) =>
            term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
          );

          const searchRegex = new RegExp(
            `(?:^|\\s|_|-)(?:${escapedTerms.join('|')})`,
            'i',
          );

          const fields = getSearchableFields(item);
          matchesSearch = fields.some((text) => searchRegex.test(text));
        }

        return matchesSearch && matchesActiveFilters(item, activeFilters);
      });
    },
    [],
  );

  return { filterItems };
}

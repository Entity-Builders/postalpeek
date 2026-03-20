/**
 * useGenerationLog.ts — Fetches recent generated postcards from the DB.
 *
 * Used by the /admin page to show a live "build log" of what the Walker
 * has been generating, including strategy, theme, and thumbnail.
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@eb-packages/logic/src/supabase';

export interface GenerationLogEntry {
  id: string;
  created_at: string;
  city: string;
  country: string;
  illustration_url: string | null;
  category: { es: string; en: string } | string | null;
  strategy: string | null;
  theme: string | null;
  vibe_injected: string | null;
  has_detailed_tags: boolean;
}

function extractStrategy(meta: Record<string, unknown> | null): string | null {
  if (!meta) return null;
  return (meta.strategy as string) || null;
}

function extractTheme(strategy: string | null): string | null {
  if (!strategy) return null;
  const match = strategy.match(/Themed Hunt: (.+)/);
  return match ? match[1] : null;
}

export function useGenerationLog(pollingIntervalMs = 15_000) {
  const [entries, setEntries] = useState<GenerationLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  const fetchLog = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('postalpeek_postcards')
        .select(
          'id, created_at, city, country, illustration_url, category, generation_metadata, detailed_tags',
        )
        .order('created_at', { ascending: false })
        .limit(30);

      if (error) throw error;

      const mapped: GenerationLogEntry[] = (data || []).map((row) => {
        const meta = row.generation_metadata as Record<string, unknown> | null;
        const strategy = extractStrategy(meta);
        return {
          id: row.id,
          created_at: row.created_at,
          city: row.city || '—',
          country: row.country || '',
          illustration_url: row.illustration_url,
          category: row.category,
          strategy,
          theme: extractTheme(strategy),
          vibe_injected: (meta?.vibe_injected as string) || null,
          has_detailed_tags:
            Array.isArray(row.detailed_tags) && row.detailed_tags.length > 0,
        };
      });

      setEntries(mapped);
      setLastFetched(new Date());
    } catch (err) {
      console.warn('[useGenerationLog] fetch failed:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchLog();
  }, [fetchLog]);

  // Poll at interval
  useEffect(() => {
    if (!pollingIntervalMs) return;
    const timer = setInterval(fetchLog, pollingIntervalMs);
    return () => clearInterval(timer);
  }, [fetchLog, pollingIntervalMs]);

  return { entries, isLoading, lastFetched, refetch: fetchLog };
}

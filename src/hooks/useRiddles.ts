/**
 * useRiddles.ts — Fetch or generate riddles for a postcard's Find Objects game.
 *
 * 1. Checks postalpeek_riddles table for cached riddles
 * 2. If none → calls postalpeek-generate-riddles edge function
 * 3. Returns a Map<objectLabel, { riddle, difficulty }> + loading state
 */
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@eb-packages/logic/src/supabase';
import { getLang } from '../utils/i18n';

interface RiddleEntry {
  /** The localized riddle text */
  text: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

interface UseRiddlesResult {
  /** Map from EN object label → riddle entry */
  riddles: Map<string, RiddleEntry>;
  /** True while fetching/generating riddles */
  isLoading: boolean;
  /** Error message if generation failed */
  error: string | null;
}

// ── Module-level cache: survives component unmount/remount ──
const riddleCache = new Map<string, Map<string, RiddleEntry>>();

export function useRiddles(postcardId: string): UseRiddlesResult {
  const [riddles, setRiddles] = useState<Map<string, RiddleEntry>>(
    () => riddleCache.get(postcardId) ?? new Map(),
  );
  const [isLoading, setIsLoading] = useState(() => !riddleCache.has(postcardId));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Already in memory → skip everything
    if (riddleCache.has(postcardId)) {
      setRiddles(riddleCache.get(postcardId)!);
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);

      try {
        // 1. Try cached riddles in DB
        const { data: cached } = await supabase
          .from('postalpeek_riddles')
          .select('object_label, riddle, difficulty')
          .eq('postcard_id', postcardId);

        if (cancelled) return;

        if (cached && cached.length > 0) {
          const map = toMap(cached);
          riddleCache.set(postcardId, map);
          setRiddles(map);
          setIsLoading(false);
          return;
        }

        // 2. Generate via edge function
        const { data, error: fnError } = await supabase.functions.invoke(
          'postalpeek-generate-riddles',
          { body: { postcard_id: postcardId } },
        );

        if (cancelled) return;
        if (fnError) throw fnError;

        if (data?.riddles && Array.isArray(data.riddles)) {
          const map = toMap(data.riddles);
          riddleCache.set(postcardId, map);
          setRiddles(map);
        }
      } catch (err) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : 'Failed to load riddles';
          console.warn('[useRiddles]', msg);
          setError(msg);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [postcardId]);

  return { riddles, isLoading, error };
}

/** Convert raw rows into a Map keyed by EN label */
function toMap(
  rows: Array<{ object_label: string; riddle: Record<string, string>; difficulty: string }>,
): Map<string, RiddleEntry> {
  const lang = getLang();
  const map = new Map<string, RiddleEntry>();

  for (const row of rows) {
    const text =
      typeof row.riddle === 'object'
        ? row.riddle[lang] || row.riddle.en || row.riddle.es || ''
        : String(row.riddle);

    map.set(row.object_label, {
      text,
      difficulty: (row.difficulty as 'easy' | 'medium' | 'hard') || 'medium',
    });
  }

  return map;
}

/**
 * useGameProgress.ts — Track game completions per postcard per user
 *
 * Manages the "play to earn" loop:
 * 1. Fetches which games the user has already completed for a postcard
 * 2. Determines which games are available (based on postcard data)
 * 3. Saves game completions to DB
 * 4. Detects when all games are done → earns the postcard (sets owner_id)
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@eb-packages/logic/src/supabase';

// Maps from UI GameMode to DB game_type
export type DbGameType = 'find_objects' | 'puzzle' | 'stamp_hunt';

const GAME_MODE_TO_DB: Record<string, DbGameType> = {
  hunt: 'find_objects',
  puzzle: 'puzzle',
  stamp: 'stamp_hunt',
};

export function gameModeToDb(mode: string): DbGameType {
  return GAME_MODE_TO_DB[mode] || (mode as DbGameType);
}

interface GameProgressRow {
  game_type: DbGameType;
  completed_at: string;
  time_seconds: number | null;
}

interface UseGameProgressReturn {
  /** Set of DB game types available for this postcard */
  availableGames: Set<DbGameType>;
  /** Set of DB game types the user has completed */
  completedGames: Set<DbGameType>;
  /** True when every available game has been completed */
  allGamesComplete: boolean;
  /** Number of games completed / total available */
  progress: { done: number; total: number };
  /** Save a game completion to DB. Returns true if this was the last game. */
  saveGameCompletion: (gameType: DbGameType, timeSeconds: number) => Promise<boolean>;
  /** Earn the postcard: set owner_id. Called after all games complete. */
  earnPostcard: () => Promise<{ success: boolean; error?: string }>;
  /** Whether an earn operation is in progress */
  isEarning: boolean;
  /** Whether the postcard has been earned (owner_id set by this user) */
  hasEarned: boolean;
  /** Loading state for initial fetch */
  isLoading: boolean;
}

export function useGameProgress(
  postcardId: string | undefined,
  userId: string | undefined,
  hasHuntMode: boolean,
): UseGameProgressReturn {
  const [completedRows, setCompletedRows] = useState<GameProgressRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isEarning, setIsEarning] = useState(false);
  const [hasEarned, setHasEarned] = useState(false);

  // Available games: puzzle + stamp_hunt always, find_objects if has bboxes
  const availableGames = useMemo(() => {
    const games = new Set<DbGameType>(['puzzle', 'stamp_hunt']);
    if (hasHuntMode) games.add('find_objects');
    return games;
  }, [hasHuntMode]);

  // Completed games from DB
  const completedGames = useMemo(
    () => new Set(completedRows.map((r) => r.game_type)),
    [completedRows],
  );

  const allGamesComplete = useMemo(
    () => availableGames.size > 0 && [...availableGames].every((g) => completedGames.has(g)),
    [availableGames, completedGames],
  );

  const progress = useMemo(() => {
    const total = availableGames.size;
    const done = [...availableGames].filter((g) => completedGames.has(g)).length;
    return { done, total };
  }, [availableGames, completedGames]);

  // Fetch existing progress on mount
  useEffect(() => {
    if (!postcardId || !userId) return;
    let cancelled = false;

    async function fetchProgress() {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('postalpeek_game_progress')
          .select('game_type, completed_at, time_seconds')
          .eq('user_id', userId!)
          .eq('postcard_id', postcardId!);

        if (!cancelled && !error && data) {
          setCompletedRows(data as GameProgressRow[]);
        }
      } catch (err) {
        console.error('[useGameProgress] fetch error', err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    fetchProgress();
    return () => { cancelled = true; };
  }, [postcardId, userId]);

  // Save a game completion
  const saveGameCompletion = useCallback(
    async (gameType: DbGameType, timeSeconds: number): Promise<boolean> => {
      if (!postcardId || !userId) return false;

      // Optimistic update
      setCompletedRows((prev) => {
        if (prev.some((r) => r.game_type === gameType)) return prev;
        return [
          ...prev,
          { game_type: gameType, completed_at: new Date().toISOString(), time_seconds: timeSeconds },
        ];
      });

      try {
        const { error } = await supabase
          .from('postalpeek_game_progress')
          .upsert({
            user_id: userId,
            postcard_id: postcardId,
            game_type: gameType,
            time_seconds: timeSeconds,
          }, { onConflict: 'user_id,postcard_id,game_type' });

        if (error) {
          console.error('[useGameProgress] save error', error);
          return false;
        }

        // Check if all games are now complete
        const updatedCompleted = new Set([...completedGames, gameType]);
        return [...availableGames].every((g) => updatedCompleted.has(g));
      } catch (err) {
        console.error('[useGameProgress] save error', err);
        return false;
      }
    },
    [postcardId, userId, completedGames, availableGames],
  );

  // Earn the postcard (set owner_id)
  const earnPostcard = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    if (!postcardId || !userId) return { success: false, error: 'Missing ID' };

    setIsEarning(true);
    try {
      const { error } = await supabase
        .from('postalpeek_postcards')
        .update({ owner_id: userId })
        .eq('id', postcardId)
        .is('owner_id', null); // Only claim if not already owned

      if (error) {
        return { success: false, error: error.message };
      }

      setHasEarned(true);
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    } finally {
      setIsEarning(false);
    }
  }, [postcardId, userId]);

  return {
    availableGames,
    completedGames,
    allGamesComplete,
    progress,
    saveGameCompletion,
    earnPostcard,
    isEarning,
    hasEarned,
    isLoading,
  };
}

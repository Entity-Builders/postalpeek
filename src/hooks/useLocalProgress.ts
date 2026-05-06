/**
 * useLocalProgress.ts
 *
 * Persists game progress in localStorage so the user sees their
 * album slots fill up across sessions — no auth required for reading.
 *
 * Key: `postalpeek_progress_${albumId}`
 */

import { useState, useCallback, useEffect } from 'react';

export interface SlotProgress {
  /** The source postcard ID (album slot's postcard_id) */
  slotId: string;
  /** When the user completed this slot */
  completedAt: string;
  /** URL of the user's generated illustration */
  illustrationUrl: string;
  /** ID of the saved row in postalpeek_user_postcards */
  userPostcardId: string;
  /** Location info for display */
  city: string;
  country: string;
  /** Rarity derived from enrichment */
  rarity?: string;
}

export interface GameProgress {
  albumId: string;
  completedSlots: SlotProgress[];
  startedAt: string;
}

const STORAGE_PREFIX = 'postalpeek_progress_';

function readProgress(albumId: string): GameProgress {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${albumId}`);
    if (raw) {
      return JSON.parse(raw) as GameProgress;
    }
  } catch (e) {
    console.warn('[useLocalProgress] Failed to read localStorage:', e);
  }
  return {
    albumId,
    completedSlots: [],
    startedAt: new Date().toISOString(),
  };
}

function writeProgress(progress: GameProgress) {
  try {
    localStorage.setItem(
      `${STORAGE_PREFIX}${progress.albumId}`,
      JSON.stringify(progress),
    );
  } catch (e) {
    console.warn('[useLocalProgress] Failed to write localStorage:', e);
  }
}

export function useLocalProgress(albumId: string | null) {
  const [progress, setProgress] = useState<GameProgress | null>(null);

  // Load progress when albumId changes
  useEffect(() => {
    if (!albumId) {
      setProgress(null);
      return;
    }
    setProgress(readProgress(albumId));
  }, [albumId]);

  /** Mark a slot as completed with the user's postcard data */
  const markSlotCompleted = useCallback(
    (slot: SlotProgress) => {
      if (!albumId) return;

      setProgress((prev) => {
        const base = prev || readProgress(albumId);
        // Don't duplicate
        if (base.completedSlots.some((s) => s.slotId === slot.slotId)) {
          return base;
        }
        const updated: GameProgress = {
          ...base,
          completedSlots: [...base.completedSlots, slot],
        };
        writeProgress(updated);
        return updated;
      });
    },
    [albumId],
  );

  /** Check if a specific slot is completed */
  const isSlotCompleted = useCallback(
    (slotId: string): boolean => {
      if (!progress) return false;
      return progress.completedSlots.some((s) => s.slotId === slotId);
    },
    [progress],
  );

  /** Get the SlotProgress data for a completed slot */
  const getSlotData = useCallback(
    (slotId: string): SlotProgress | undefined => {
      if (!progress) return undefined;
      return progress.completedSlots.find((s) => s.slotId === slotId);
    },
    [progress],
  );

  /** Number of completed slots */
  const completedCount = progress?.completedSlots.length ?? 0;

  /** Build a Map<slotId, SlotProgress> for quick lookups */
  const completedSlotsMap = new Map<string, SlotProgress>(
    (progress?.completedSlots ?? []).map((s) => [s.slotId, s]),
  );

  /** Reset all progress (dev tool) */
  const resetProgress = useCallback(() => {
    if (!albumId) return;
    const fresh: GameProgress = {
      albumId,
      completedSlots: [],
      startedAt: new Date().toISOString(),
    };
    writeProgress(fresh);
    setProgress(fresh);
  }, [albumId]);

  return {
    progress,
    completedCount,
    completedSlotsMap,
    markSlotCompleted,
    isSlotCompleted,
    getSlotData,
    resetProgress,
  };
}

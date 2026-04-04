/**
 * useExplorerRealtime.ts
 *
 * Hook that subscribes to postalpeek_scout_progress via Supabase Realtime
 * and returns events in the same format as the SSE-based ExplorerLiveFeed.
 *
 * Usage:
 *   const sessionId = crypto.randomUUID();
 *   // pass sessionId to cron-walker as scout_session_id
 *   const { events, isDone } = useExplorerRealtime(sessionId);
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@eb-packages/logic/src/supabase';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ExplorerProgressEvent {
  type: 'phase' | 'ring_point' | 'frame_captured' | 'ranked' | 'refinement' | 'done';
  phase?: 1 | 2 | 3 | 4;
  message?: string;
  ring_radius_m?: number;
  radius_class?: string;
  total_frames?: number;
  frame?: {
    pano_id: string;
    heading: number;
    fov: number;
    pitch: number;
    lat: number;
    lng: number;
    lens_type?: string;
    status?: string;
    prominence_pct?: number;
    narration?: string;
    score?: number;
    is_winner?: boolean;
  };
}

interface UseExplorerRealtimeResult {
  events: ExplorerProgressEvent[];
  isDone: boolean;
  error: string | null;
  elapsedSeconds: number;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useExplorerRealtime(sessionId: string | null): UseExplorerRealtimeResult {
  const [events, setEvents] = useState<ExplorerProgressEvent[]>([]);
  const [isDone, setIsDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const pushEvent = useCallback((event: ExplorerProgressEvent) => {
    setEvents(prev => [...prev, event]);
    if (event.type === 'done') {
      setIsDone(true);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }, []);

  useEffect(() => {
    if (!sessionId) return;

    startTimeRef.current = Date.now();

    // Elapsed timer
    timerRef.current = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);

    // Subscribe to INSERT events on postalpeek_scout_progress for this session
    const channel = supabase
      .channel(`scout-progress-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'postalpeek_scout_progress',
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          const row = payload.new as { type: string; data: ExplorerProgressEvent };
          if (row?.data) pushEvent(row.data);
        },
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          setError('Realtime connection failed. Check Supabase Realtime is enabled.');
        }
      });

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      supabase.removeChannel(channel);
    };
  }, [sessionId, pushEvent]);

  return { events, isDone, error, elapsedSeconds };
}

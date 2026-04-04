/**
 * ExplorerLiveFeed.tsx
 *
 * Streams Explorer v2 progress in real-time via SSE from postalpeek-camera-preview.
 *
 * Visual flow:
 *  Phase 1-2  →  Ring discovery status + animated radar
 *  Phase 3    →  "Discovery" grid grows as frames arrive (2-col, bigger)
 *  contact_sheet → Contact sheet shown as a collapsible section (grid still visible)
 *  ranked     →  Score badges + ⭐ CANDIDATE badge on top-2 frames selected for refinement
 *  Phase 4A   →  "FOV Refinement" frames grouped by parent candidate
 *  Phase 4B   →  "Approach Vector" frames appear with amber accent (physically closer panos)
 *  done       →  Winner banner
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader, CheckCircle, AlertCircle, ScanSearch, Star, TrendingUp, Zap, Navigation } from 'lucide-react';
import {
  FrameSection,
  RefinementSection,
  PhaseIndicator
} from './ExplorerShared';
import {
  FramePhase,
  CapturedFrame,
  svThumb,
  scoreColor,
  isApproachLensType,
} from './explorer-utils';

interface ExplorerLiveFeedProps {
  locationName: string;
  lat: number;
  lng: number;
  mapsApiKey: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  onDone?: (summary: { total_frames: number; best_frame?: CapturedFrame }) => void;
}

interface ExplorerProgressEvent {
  type: 'phase' | 'ring_point' | 'frame_captured' | 'ranked' | 'refinement' | 'contact_sheet' | 'done';
  phase?: 1 | 2 | 3 | 4;
  message?: string;
  ring_radius_m?: number;
  radius_class?: string;
  total_frames?: number;
  contact_sheet_base64?: string;
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

// --- End Types ---

export function ExplorerLiveFeed({
  locationName,
  lat,
  lng,
  mapsApiKey,
  supabaseUrl,
  supabaseAnonKey,
  onDone,
}: ExplorerLiveFeedProps) {
  const [phaseNum, setPhaseNum] = useState<number>(0);
  const [phaseMsg, setPhaseMsg] = useState<string>('Initializing...');
  const [frames, setFrames] = useState<CapturedFrame[]>([]);
  const [contactSheet, setContactSheet] = useState<string | null>(null);
  const [contactSheetExpanded, setContactSheetExpanded] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [winner, setWinner] = useState<CapturedFrame | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  // Track which pano_ids are top candidates (selected for refinement)
  // populated when we enter phase 4 by looking at top-scored discovery frames
  const candidatePanosRef = useRef<string[]>([]);
  // Track the current "active" refinement parent so refinement frames know their origin
  const activeRefinementParentRef = useRef<string | null>(null);
  // Stable ref for frames count — avoids recreating handleEvent on every frame add
  // (which would restart the SSE connection and drop refinement events)
  const framesCountRef = useRef(0);
  const startRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onDoneRef = useRef(onDone);
  useEffect(() => { onDoneRef.current = onDone; });

  // ── Event handler ──────────────────────────────────────────────────────────

  const handleEvent = useCallback((event: ExplorerProgressEvent) => {
    switch (event.type) {
      case 'phase':
        setPhaseNum(event.phase ?? 0);
        setPhaseMsg(event.message ?? '');

        // Phase 4 starts → mark top-2 discovery frames as candidates
        if (event.phase === 4) {
          setFrames(prev => {
            const ranked = prev
              .filter(f => f.phase === 'discovery' && f.score !== undefined)
              .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
            const topIds = ranked.slice(0, 2).map(f => f.pano_id);
            candidatePanosRef.current = topIds;
            if (topIds.length === 0) return prev;
            return prev.map(f =>
              topIds.includes(f.pano_id) && f.phase === 'discovery'
                ? { ...f, is_candidate: true }
                : f
            );
          });
        }
        break;

      case 'ring_point':
        break;

      case 'frame_captured': {
        const f = event.frame;
        if (!f?.pano_id) break;
        setFrames(prev => {
          if (prev.find(x => x.pano_id === f.pano_id && x.phase === 'discovery')) return prev;
          const next = [...prev, {
            pano_id: f.pano_id,
            heading: f.heading,
            fov: f.fov,
            pitch: f.pitch,
            lat: f.lat,
            lng: f.lng,
            index: prev.length + 1,
            phase: 'discovery' as FramePhase,
            lens_type: f.lens_type,
          }];
          framesCountRef.current = next.length;
          return next;
        });
        break;
      }

      case 'contact_sheet':
        if (event.contact_sheet_base64) {
          setContactSheet(event.contact_sheet_base64);
          setIsAnalyzing(true);
          setPhaseMsg('Gemini is analyzing the contact sheet...');
        }
        break;

      case 'ranked': {
        const f = event.frame;
        if (!f?.pano_id) break;
        setIsAnalyzing(false);
        setFrames(prev => prev.map(x =>
          x.pano_id === f.pano_id && x.phase === 'discovery'
            ? { ...x, score: f.score, prominence_pct: f.prominence_pct, narration: f.narration, is_winner: f.is_winner, status: f.status }
            : x
        ));
        break;
      }

      case 'refinement': {
        const f = event.frame;
        if (!f?.pano_id) break;
        const phase: FramePhase = isApproachLensType(f.lens_type) ? 'approach' : 'refinement';

        // Identify the parent candidate:
        // The backend processes candidates in order (top-1 then top-2).
        // Each new pano_id in refinement signals a new candidate group.
        // We track the "active parent" as the pano_id of the discovery frame.
        // For refinement (Phase 4A), the pano_id stays the same across FOVs.
        // For approach (Phase 4B), pano_ids change — we track based on discovery candidates.
        let parentPanoId: string | undefined;
        if (phase === 'refinement') {
          // In Phase 4A: the refinement pano_id IS the discovery pano_id
          if (candidatePanosRef.current.includes(f.pano_id)) {
            activeRefinementParentRef.current = f.pano_id;
          }
          parentPanoId = f.pano_id; // same pano, different FOV
        } else {
          // In Phase 4B: the pano_id is new (moved closer). Keep tracking last known candidate parent
          parentPanoId = activeRefinementParentRef.current ?? candidatePanosRef.current[0];
        }

        setFrames(prev => {
          const exists = prev.find(x => x.pano_id === f.pano_id && x.fov === f.fov && x.phase === phase);
          if (exists) return prev;
          const next = [...prev, {
            pano_id: f.pano_id,
            heading: f.heading,
            fov: f.fov,
            pitch: f.pitch,
            lat: f.lat,
            lng: f.lng,
            index: prev.length + 1,
            phase,
            score: f.score,
            prominence_pct: f.prominence_pct,
            narration: f.narration,
            is_winner: f.is_winner,
            status: f.status,
            lens_type: f.lens_type,
            parent_pano_id: parentPanoId,
          }];
          framesCountRef.current = next.length;
          return next;
        });
        break;
      }

      case 'done': {
        setIsAnalyzing(false);
        setIsDone(true);
        if (timerRef.current) clearInterval(timerRef.current);
        const f = event.frame;
        if (f?.pano_id) {
          const w: CapturedFrame = {
            pano_id: f.pano_id, heading: f.heading, fov: f.fov,
            pitch: f.pitch, lat: f.lat, lng: f.lng, index: 0,
            phase: 'discovery',
            score: f.score, prominence_pct: f.prominence_pct,
            narration: f.narration, is_winner: true,
          };
          setWinner(w);
          setFrames(prev => prev.map(x => x.pano_id === f.pano_id ? { ...x, is_winner: true } : x));
          onDoneRef.current?.({ total_frames: framesCountRef.current, best_frame: w });
        }
        break;
      }
    }
  // NOTE: empty dep array is intentional — handleEvent must be stable so the SSE
  // useEffect never restarts mid-stream. framesCountRef replaces frames.length.
  }, []);

  // ── SSE connection ─────────────────────────────────────────────────────────

  useEffect(() => {
    startRef.current = Date.now();
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 1000);

    const fnUrl = `${supabaseUrl}/functions/v1/postalpeek-camera-preview`;
    const body = JSON.stringify({ lat, lng, stream: true });

    const connect = async () => {
      try {
        const res = await fetch(fnUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseAnonKey}`,
          },
          body,
        });

        if (!res.ok || !res.body) {
          setError(`Server error ${res.status}`);
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        const read = async () => {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() ?? '';
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const evt = JSON.parse(line.slice(6)) as ExplorerProgressEvent;
                  handleEvent(evt);
                } catch { /* ignore parse errors */ }
              }
            }
          }
        };
        read().catch(e => setError(e?.message ?? 'Stream error'));
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Connection failed');
      }
    };

    connect();

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [lat, lng, supabaseUrl, supabaseAnonKey, handleEvent]);

  // ── Derived state ──────────────────────────────────────────────────────────

  const discoveryFrames = frames.filter(f => f.phase === 'discovery');
  const refinementFrames = frames.filter(f => f.phase === 'refinement');
  const approachFrames = frames.filter(f => f.phase === 'approach');
  const rankedFrames = frames.filter(f => f.score !== undefined);
  const candidateFrames = discoveryFrames.filter(f => f.is_candidate);
  
  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div
      className="rounded-2xl overflow-hidden flex flex-col"
      style={{
        background: 'rgba(10,10,22,0.97)',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      }}
    >
      {/* ── Header ── */}
      <div className="px-4 py-3 flex items-center justify-between gap-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="relative shrink-0">
            {!isDone && !error && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            )}
            <span className="text-lg leading-none">🛸</span>
          </div>
          <div className="min-w-0">
            <p className="text-white/90 font-semibold text-sm leading-tight truncate">Explorer Scout — Live</p>
            <p className="text-white/35 text-[10px] font-mono truncate">{locationName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isDone ? (
            <span className="flex items-center gap-1 text-[11px] font-mono text-emerald-400">
              <CheckCircle className="w-3.5 h-3.5" /> {elapsed}s
            </span>
          ) : error ? (
            <span className="flex items-center gap-1 text-[11px] font-mono text-red-400">
              <AlertCircle className="w-3.5 h-3.5" /> Error
            </span>
          ) : (
            <span className="text-[11px] font-mono text-white/25 flex items-center gap-1">
              <Loader className="w-3 h-3 animate-spin" /> {elapsed}s
            </span>
          )}
        </div>
      </div>

      <AnimatePresence mode="wait">
        <PhaseIndicator phase={phaseNum} message={phaseMsg} />
      </AnimatePresence>

      {/* ── Main content area ── */}
      <div className="px-3 pb-3 flex flex-col gap-3 mt-2">

        {/* ── Empty state: radar animation ── */}
        {phaseNum <= 2 && frames.length === 0 && (
          <div className="py-6 flex flex-col items-center gap-3">
            <div className="relative">
              <div className="w-16 h-16 rounded-full border-2 border-indigo-500/20 flex items-center justify-center">
                <div className="w-10 h-10 rounded-full border-2 border-indigo-500/40 flex items-center justify-center">
                  <div className="w-4 h-4 rounded-full bg-indigo-500/60 animate-ping" />
                </div>
              </div>
            </div>
            <p className="text-white/30 text-xs font-mono text-center">Mapping vantage points around the landmark…</p>
          </div>
        )}

        {/* ── Phase 3: Discovery frames grid (2-col, larger) ── */}
        {discoveryFrames.length > 0 && (
          <FrameSection
            label="Discovery"
            count={discoveryFrames.length}
            frames={discoveryFrames}
            mapsApiKey={mapsApiKey}
            accentColor="rgba(255,255,255,0.04)"
            showPlaceholder={phaseNum === 3 && !isDone}
            columns={2}
          />
        )}

        {/* ── Contact sheet (collapsible) ── */}
        <AnimatePresence>
          {contactSheet && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl overflow-hidden"
              style={{ border: '1px solid rgba(99,102,241,0.2)', background: 'rgba(99,102,241,0.05)' }}
            >
              <button
                className="w-full flex items-center gap-2 px-3 py-2 text-left"
                style={{ borderBottom: contactSheetExpanded ? '1px solid rgba(99,102,241,0.1)' : 'none' }}
                onClick={() => setContactSheetExpanded(v => !v)}
              >
                <ScanSearch className="w-3.5 h-3.5 text-indigo-400/60 shrink-0" />
                <p className="text-[10px] font-mono text-indigo-300/60 uppercase tracking-widest flex-1">
                  {isAnalyzing ? (
                    <span className="flex items-center gap-1.5">
                      <Loader className="w-2.5 h-2.5 animate-spin" />
                      Gemini analyzing all frames…
                    </span>
                  ) : rankedFrames.length > 0 ? (
                    `${rankedFrames.length} frames ranked`
                  ) : 'Contact sheet'}
                </p>
                <span className="text-[10px] text-indigo-400/40 font-mono">{contactSheetExpanded ? '▲' : '▼'}</span>
              </button>
              <AnimatePresence>
                {contactSheetExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <img
                      src={`data:image/jpeg;base64,${contactSheet}`}
                      alt="Contact sheet — all frames side by side"
                      className="w-full object-contain"
                      style={{ maxHeight: 300, display: 'block' }}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Candidate summary bar (shown after ranking) ── */}
        <AnimatePresence>
          {candidateFrames.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl px-3 py-2.5 flex items-center gap-2.5"
              style={{ background: 'rgba(251,191,36,0.05)', border: '1px solid rgba(251,191,36,0.18)' }}
            >
              <Star className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-mono text-amber-300/80 font-semibold uppercase tracking-widest">
                  {candidateFrames.length} candidate{candidateFrames.length > 1 ? 's' : ''} selected for refinement
                </p>
                <p className="text-[9px] font-mono text-amber-200/40 mt-0.5 truncate">
                  Scores: {candidateFrames.map(f => `${f.score ?? '?'}/10`).join(', ')} — requesting closer + zoomed shots
                </p>
              </div>
              <TrendingUp className="w-3.5 h-3.5 text-amber-400/50 shrink-0" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Phase 4A: FOV Refinement — grouped by candidate ── */}
        {refinementFrames.length > 0 && (
          <RefinementSection
            label="FOV Refinement"
            frames={refinementFrames}
            discoveryFrames={discoveryFrames}
            mapsApiKey={mapsApiKey}
            accentColor="rgba(99,102,241,0.06)"
            accentBorder="rgba(99,102,241,0.2)"
            labelColor="#818cf8"
            showPlaceholder={phaseNum === 4 && !isDone && approachFrames.length === 0}
            icon={<Zap className="w-3 h-3" />}
            description="Optical zoom variations from each candidate vantage"
          />
        )}

        {/* ── Phase 4B: Approach Vector — moves physically closer ── */}
        {approachFrames.length > 0 && (
          <RefinementSection
            label="Approach Vector"
            frames={approachFrames}
            discoveryFrames={discoveryFrames}
            mapsApiKey={mapsApiKey}
            accentColor="rgba(251,191,36,0.05)"
            accentBorder="rgba(251,191,36,0.2)"
            labelColor="#fbbf24"
            showPlaceholder={phaseNum === 4 && !isDone}
            icon={<Navigation className="w-3 h-3" />}
            description="Physically moved closer to increase target prominence"
          />
        )}

        {/* ── Winner banner ── */}
        <AnimatePresence>
          {isDone && winner && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl overflow-hidden"
              style={{ border: '1px solid rgba(16,185,129,0.3)', background: 'rgba(16,185,129,0.06)' }}
            >
              <div className="relative">
                <img
                  src={svThumb(winner.pano_id, winner.heading, winner.fov, winner.pitch, mapsApiKey, '800x533')}
                  alt="Best frame"
                  className="w-full object-cover rounded-t-xl"
                  style={{ height: 200 }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent rounded-t-xl" />
                <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between">
                  <span className="text-xl">👑</span>
                  <div className="flex items-center gap-1.5">
                    {winner.score !== undefined && (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg"
                        style={{ background: scoreColor(winner.score).bg, color: '#fff' }}>
                        {winner.score}/10
                      </span>
                    )}
                    {winner.prominence_pct !== undefined && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-lg"
                        style={{ background: 'rgba(0,0,0,0.6)', color: 'rgba(255,255,255,0.7)' }}>
                        {winner.prominence_pct}% prominence
                      </span>
                    )}
                  </div>
                </div>
              </div>
              {winner.narration && (
                <div className="px-3 py-2.5">
                  <p className="text-[11px] text-white/50 italic leading-relaxed">
                    "{winner.narration}"
                  </p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Error ── */}
        {error && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
            style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <p className="text-[11px] text-red-400/80 font-mono">{error}</p>
          </div>
        )}
      </div>

      {/* ── Footer stats ── */}
      {frames.length > 0 && (
        <div className="px-4 py-2.5 flex items-center gap-4"
          style={{ borderTop: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.02)' }}>
          <span className="text-[10px] font-mono text-white/30">
            <span className="text-white/55">{discoveryFrames.length}</span> discovered
          </span>
          {candidateFrames.length > 0 && (
            <span className="text-[10px] font-mono text-amber-400/60 flex items-center gap-1">
              <Star className="w-2.5 h-2.5" />
              <span className="text-amber-300/80">{candidateFrames.length}</span> candidates
            </span>
          )}
          {refinementFrames.length > 0 && (
            <span className="text-[10px] font-mono text-indigo-400/50">
              <span className="text-indigo-300/70">{refinementFrames.length}</span> refined
            </span>
          )}
          {approachFrames.length > 0 && (
            <span className="text-[10px] font-mono text-amber-400/50">
              <span className="text-amber-300/70">{approachFrames.length}</span> approach
            </span>
          )}
          <span className="text-[10px] font-mono text-white/30">
            <span className="text-white/55">{rankedFrames.length}</span> ranked
          </span>
          {isDone && winner?.score !== undefined && (
            <span className="ml-auto text-[10px] font-mono text-emerald-400/70">
              ✓ Scout complete
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ── End ExplorerLiveFeed ─────────────────────────────────────────────────────

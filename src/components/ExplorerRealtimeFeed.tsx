/**
 * ExplorerRealtimeFeed.tsx
 *
 * Same visual design as ExplorerLiveFeed but subscribes to
 * scout_progress via Supabase Realtime instead of SSE.
 * Used when the real cron-walker is triggered from AdminQueue.
 *
 * Visual flow:
 *  Phase 1-2 → radar animation (ring discovery)
 *  Phase 3   → 2-col grid of large thumbnails, appearing one by one
 *  contact_sheet event → "What Gemini sees" composite image
 *  ranked    → Score badges overlaid on each thumbnail
 *  done      → Winner banner with full thumbnail + score + narration
 */

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader, CheckCircle, AlertCircle, ScanSearch, Target, TrendingUp } from 'lucide-react';
import { useExplorerRealtime, type ExplorerProgressEvent } from '../hooks/useExplorerRealtime';
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

// ── Types ─────────────────────────────────────────────────────────────────────

interface ExplorerRealtimeFeedProps {
  sessionId: string;
  locationName: string;
  mapsApiKey: string;
  onDone?: (summary: { total_frames: number; best_frame?: CapturedFrame }) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ExplorerRealtimeFeed({
  sessionId,
  locationName,
  mapsApiKey,
  onDone,
}: ExplorerRealtimeFeedProps) {
  const { events, error: realtimeError, elapsedSeconds } = useExplorerRealtime(sessionId);

  const [phaseNum, setPhaseNum] = useState<number>(0);
  const [phaseMsg, setPhaseMsg] = useState<string>('Initializing…');
  const [frames, setFrames] = useState<CapturedFrame[]>([]);
  const [contactSheet, setContactSheet] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [winner, setWinner] = useState<CapturedFrame | null>(null);
  
  const candidatePanosRef = useRef<string[]>([]);
  const activeRefinementParentRef = useRef<string | null>(null);
  
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const processedCount = useRef(0);

  // Process new events as they arrive
  useEffect(() => {
    for (let i = processedCount.current; i < events.length; i++) {
      applyEvent(events[i]);
    }
    processedCount.current = events.length;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events.length]);

  function applyEvent(event: ExplorerProgressEvent) {
    switch (event.type) {
      case 'phase':
        setPhaseNum(event.phase ?? 0);
        setPhaseMsg(event.message ?? '');

        // When entering phase 4, rank candidates
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

      case 'frame_captured': {
        const f = event.frame;
        if (!f?.pano_id) break;

        setFrames(prev => {
          if (prev.find(x => x.pano_id === f.pano_id && x.phase === 'discovery')) return prev;
          return [...prev, {
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
        });
        break;
      }

      case 'contact_sheet':
        if (event.contact_sheet_base64) {
          setContactSheet(event.contact_sheet_base64);
          setIsAnalyzing(true);
          setPhaseMsg('Gemini is analyzing the contact sheet…');
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

        let parentPanoId: string | undefined;
        if (phase === 'refinement') {
          if (candidatePanosRef.current.includes(f.pano_id)) {
            activeRefinementParentRef.current = f.pano_id;
          }
          parentPanoId = f.pano_id;
        } else {
          parentPanoId = activeRefinementParentRef.current ?? candidatePanosRef.current[0];
        }

        setFrames(prev => {
          const exists = prev.find(x => x.pano_id === f.pano_id && x.fov === f.fov && x.phase === phase);
          if (exists) return prev;

          return [...prev, {
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
        });
        break;
      }

      case 'done': {
        setIsAnalyzing(false);
        setIsDone(true);
        const f = event.frame;
        const totalFrames = frames.length;
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
          setTimeout(() => onDoneRef.current?.({ total_frames: totalFrames + 1, best_frame: w }), 1000);
        } else {
          setTimeout(() => onDoneRef.current?.({ total_frames: totalFrames }), 1000);
        }
        break;
      }
    }
  }

  // ── Derived state ──────────────────────────────────────────────────────────

  const discoveryFrames = frames.filter(f => f.phase === 'discovery');
  const refinementFrames = frames.filter(f => f.phase === 'refinement');
  const approachFrames = frames.filter(f => f.phase === 'approach');
  const rankedFrames = frames.filter(f => f.score !== undefined);
  const candidateFrames = discoveryFrames.filter(f => f.is_candidate);

  const error = realtimeError;

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
      <div className="px-4 py-3 flex items-center justify-between gap-3"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="relative shrink-0">
            {!isDone && !error && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            )}
            <span className="text-lg leading-none">🛸</span>
          </div>
          <div className="min-w-0">
            <p className="text-white/90 font-semibold text-sm leading-tight">Explorer Scout — Live</p>
            <p className="text-white/35 text-[10px] font-mono truncate">{locationName}
              <span className="ml-2 opacity-40">via Realtime</span>
            </p>
          </div>
        </div>
        <div className="shrink-0">
          {isDone ? (
            <span className="flex items-center gap-1 text-[11px] font-mono text-emerald-400">
              <CheckCircle className="w-3.5 h-3.5" /> {elapsedSeconds}s
            </span>
          ) : error ? (
            <span className="flex items-center gap-1 text-[11px] font-mono text-red-400">
              <AlertCircle className="w-3.5 h-3.5" /> Error
            </span>
          ) : (
            <span className="text-[11px] font-mono text-white/25 flex items-center gap-1">
              <Loader className="w-3 h-3 animate-spin" /> {elapsedSeconds}s
            </span>
          )}
        </div>
      </div>

      {/* ── Phase indicator ── */}
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

        {/* ── Contact sheet ── */}
        <AnimatePresence>
          {contactSheet && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className="rounded-xl overflow-hidden"
              style={{ border: '1px solid rgba(99,102,241,0.2)', background: 'rgba(99,102,241,0.05)' }}>
              <div className="flex items-center gap-2 px-3 py-2"
                style={{ borderBottom: '1px solid rgba(99,102,241,0.1)' }}>
                <ScanSearch className="w-3.5 h-3.5 text-indigo-400/60" />
                <p className="text-[10px] font-mono text-indigo-300/60 uppercase tracking-widest">
                  {isAnalyzing ? (
                    <span className="flex items-center gap-1.5">
                      <Loader className="w-2.5 h-2.5 animate-spin" />
                      Gemini is analyzing all frames…
                    </span>
                  ) : rankedFrames.length > 0 ? `${rankedFrames.length} frames ranked` : 'Contact sheet'}
                </p>
              </div>
              <img
                src={`data:image/jpeg;base64,${contactSheet}`}
                alt="Contact sheet"
                className="w-full object-contain block"
                style={{ maxHeight: 260 }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Phase 4A: Refinement brackets ── */}
        {candidateFrames.length > 0 && (
          <RefinementSection
            label="Refinement"
            icon={<Target className="w-3.5 h-3.5" />}
            description="Brackets (N/S/E/W) of top candidates"
            frames={refinementFrames}
            discoveryFrames={discoveryFrames}
            mapsApiKey={mapsApiKey}
            accentColor="rgba(99,102,241,0.04)"
            accentBorder="rgba(99,102,241,0.15)"
            labelColor="rgba(129,140,248,0.9)"
            showPlaceholder={phaseNum === 4 && approachFrames.length === 0 && !isDone}
          />
        )}

        {/* ── Phase 4B: Approach vectors ── */}
        {approachFrames.length > 0 && (
          <RefinementSection
            label="Approach Vectors"
            icon={<TrendingUp className="w-3.5 h-3.5" />}
            description="Moving closer to landmark"
            frames={approachFrames}
            discoveryFrames={discoveryFrames}
            mapsApiKey={mapsApiKey}
            accentColor="rgba(251,191,36,0.04)"
            accentBorder="rgba(251,191,36,0.15)"
            labelColor="rgba(251,191,36,0.9)"
            showPlaceholder={phaseNum === 4 && !isDone}
          />
        )}

        {/* ── Winner banner ── */}
        <AnimatePresence>
          {isDone && winner && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className="rounded-xl overflow-hidden mt-2"
              style={{ border: '2px solid rgba(16,185,129,0.5)', background: 'rgba(16,185,129,0.06)', boxShadow: '0 8px 32px rgba(16,185,129,0.15)' }}>
              <div className="relative">
                <img
                  src={svThumb(winner.pano_id, winner.heading, winner.fov, winner.pitch, mapsApiKey)}
                  alt="Winner"
                  className="w-full object-cover rounded-t-xl"
                  style={{ height: 180 }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent rounded-t-xl" />
                <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl drop-shadow-md">👑</span>
                    <div>
                      <p className="text-[10px] font-mono text-emerald-400 font-bold uppercase tracking-widest mb-0.5" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>Selected Frame</p>
                      <p className="text-white text-sm font-semibold truncate" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>
                        {winner.prominence_pct}% Prominence
                      </p>
                    </div>
                  </div>
                  {winner.score !== undefined && (
                    <span className="text-xs font-bold px-2 py-1 rounded-lg"
                      style={{ background: scoreColor(winner.score).bg, color: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
                      {winner.score}/10
                    </span>
                  )}
                </div>
              </div>
              {winner.narration && (
                <div className="px-4 py-3 border-t border-emerald-500/20">
                  <p className="text-xs text-emerald-100/70 italic leading-relaxed font-serif">"{winner.narration}"</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {error && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl mt-2"
            style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <p className="text-[11px] text-red-400/80 font-mono">{error}</p>
          </div>
        )}
      </div>

      {/* Footer */}
      {frames.length > 0 && (
        <div className="px-4 py-2.5 flex items-center gap-4 mt-auto"
          style={{ borderTop: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.02)' }}>
          <span className="text-[10px] font-mono text-white/30">
            <span className="text-white/55">{frames.length}</span> captured
          </span>
          <span className="text-[10px] font-mono text-white/30">
            <span className="text-white/55">{rankedFrames.length}</span> analyzed
          </span>
          {isDone && (
            <span className="ml-auto text-[10px] font-mono text-emerald-400/70">✓ Scout complete</span>
          )}
        </div>
      )}
    </div>
  );
}

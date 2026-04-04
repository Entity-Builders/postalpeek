/**
 * ExplorerRealtimeFeed.tsx
 *
 * Admin feed panel for the REAL cron-walker run (not the pilot simulator).
 * Subscribes to postalpeek_scout_progress via Supabase Realtime using a
 * scout_session_id that the admin generates and passes to the cron invocation.
 *
 * Renders the exact same visual filmstrip as ExplorerLiveFeed.
 */

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader, CheckCircle, AlertCircle, Eye, Compass, Zap } from 'lucide-react';
import { useExplorerRealtime, type ExplorerProgressEvent } from '../hooks/useExplorerRealtime';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ExplorerFrame {
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
  event_type: 'ring_point' | 'frame_captured' | 'ranked' | 'refinement' | 'done';
}

interface ExplorerPhase {
  phase: 1 | 2 | 3 | 4;
  message: string;
  ring_radius_m?: number;
}

interface ExplorerRealtimeFeedProps {
  sessionId: string;
  locationName: string;
  mapsApiKey: string;
  onDone?: () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function svThumb(panoId: string, heading: number, fov: number, pitch: number, mapsKey: string) {
  return `https://maps.googleapis.com/maps/api/streetview?size=160x110&pano=${panoId}&heading=${Math.round(heading)}&pitch=${Math.round(pitch)}&fov=${fov}&key=${mapsKey}`;
}

function prominenceColor(pct: number) {
  if (pct >= 35) return { bg: 'rgba(16,185,129,0.85)', text: '#ecfdf5' };
  if (pct >= 15) return { bg: 'rgba(245,158,11,0.85)', text: '#fffbeb' };
  return { bg: 'rgba(239,68,68,0.7)', text: '#fef2f2' };
}

function phaseLabel(phase: number) {
  switch (phase) {
    case 1: return { icon: <Compass className="w-3 h-3" />, label: 'Classifying size', color: 'text-purple-300' };
    case 2: return { icon: <Compass className="w-3 h-3" />, label: 'Discovering ring', color: 'text-blue-300' };
    case 3: return { icon: <Eye className="w-3 h-3" />, label: 'Capturing & ranking', color: 'text-amber-300' };
    case 4: return { icon: <Zap className="w-3 h-3" />, label: 'Refining FOV', color: 'text-emerald-300' };
    default: return { icon: <Loader className="w-3 h-3" />, label: 'Processing', color: 'text-white/40' };
  }
}

function toFrame(
  src: ExplorerProgressEvent['frame'] | undefined,
  eventType: ExplorerFrame['event_type'],
): ExplorerFrame | null {
  if (!src?.pano_id) return null;
  return {
    pano_id: src.pano_id,
    heading: src.heading ?? 0,
    fov: src.fov ?? 90,
    pitch: src.pitch ?? 0,
    lat: src.lat ?? 0,
    lng: src.lng ?? 0,
    lens_type: src.lens_type,
    status: src.status,
    prominence_pct: src.prominence_pct,
    narration: src.narration,
    score: src.score,
    is_winner: src.is_winner,
    event_type: eventType,
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ExplorerRealtimeFeed({
  sessionId,
  locationName,
  mapsApiKey,
  onDone,
}: ExplorerRealtimeFeedProps) {
  const { events, isDone, error, elapsedSeconds } = useExplorerRealtime(sessionId);
  const [phase, setPhase] = useState<ExplorerPhase | null>(null);
  const [frames, setFrames] = useState<ExplorerFrame[]>([]);
  const [bestFrame, setBestFrame] = useState<ExplorerFrame | null>(null);
  const [contactSheet, setContactSheet] = useState<string | null>(null);
  const filmstripRef = useRef<HTMLDivElement>(null);
  const onDoneCalledRef = useRef(false);

  // Scroll filmstrip to latest
  const scrollToEnd = () => {
    if (filmstripRef.current) {
      filmstripRef.current.scrollTo({ left: filmstripRef.current.scrollWidth, behavior: 'smooth' });
    }
  };

  // Process each new event into the visual state
  useEffect(() => {
    if (events.length === 0) return;
    const latest = events[events.length - 1];
    applyEvent(latest);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events.length]);

  function applyEvent(event: ExplorerProgressEvent) {
    switch (event.type) {
      case 'phase':
        setPhase({ phase: event.phase ?? 1, message: event.message ?? '', ring_radius_m: event.ring_radius_m });
        break;

      case 'contact_sheet':
        if (event.contact_sheet_base64) setContactSheet(event.contact_sheet_base64);
        break;

      case 'ring_point': {
        const frame = toFrame(event.frame, 'ring_point');
        if (!frame) break;
        setFrames(prev => {
          if (prev.find(f => f.pano_id === frame.pano_id && f.event_type === 'ring_point')) return prev;
          return [...prev, frame];
        });
        setTimeout(scrollToEnd, 50);
        break;
      }

      case 'frame_captured': {
        const frame = toFrame(event.frame, 'frame_captured');
        if (!frame) break;
        setFrames(prev => {
          const withoutRing = prev.filter(f => !(f.pano_id === frame.pano_id && f.event_type === 'ring_point'));
          if (withoutRing.find(f => f.pano_id === frame.pano_id && f.event_type === 'frame_captured')) return prev;
          return [...withoutRing, frame];
        });
        setTimeout(scrollToEnd, 50);
        break;
      }

      case 'ranked': {
        const incoming = event.frame;
        if (!incoming?.pano_id) break;
        setFrames(prev => prev.map(f =>
          f.pano_id === incoming.pano_id
            ? { ...f, ...toFrame(incoming, 'ranked')! }
            : f
        ));
        break;
      }

      case 'refinement': {
        const frame = toFrame(event.frame, 'refinement');
        if (!frame) break;
        setFrames(prev => {
          if (prev.find(f => f.pano_id === frame.pano_id && f.fov === frame.fov && f.event_type === 'refinement')) return prev;
          return [...prev, frame];
        });
        setTimeout(scrollToEnd, 50);
        break;
      }

      case 'done': {
        const winner = toFrame(event.frame, 'done');
        if (winner) {
          winner.is_winner = true;
          setBestFrame(winner);
          setFrames(prev => prev.map(f =>
            f.pano_id === winner.pano_id
              ? { ...f, is_winner: true }
              : f
          ));
        }
        break;
      }
    }
  }

  useEffect(() => {
    if (isDone && !onDoneCalledRef.current) {
      onDoneCalledRef.current = true;
      onDone?.();
    }
  }, [isDone, onDone]);

  const capturedCount = frames.filter(f => ['frame_captured', 'ranked', 'refinement'].includes(f.event_type)).length;
  const rankedCount = frames.filter(f => f.event_type === 'ranked').length;
  const currentPhaseInfo = phase ? phaseLabel(phase.phase) : null;

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: 'rgba(15,15,28,0.95)', border: '1px solid rgba(99,102,241,0.2)' }}
    >
      {/* ── Header ── */}
      <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: 'rgba(99,102,241,0.15)' }}>
        <div className="flex items-center gap-2.5">
          <div className="relative">
            {!isDone && !error && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-400 rounded-full animate-ping" />
            )}
            <span className="text-base">🛸</span>
          </div>
          <div>
            <p className="text-white/90 text-sm font-semibold leading-tight">Explorer Scout — Live</p>
            <p className="text-white/40 text-[10px] font-mono truncate max-w-[200px]">{locationName}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[9px] font-mono text-white/20 hidden sm:block">
            via Realtime
          </span>
          {isDone ? (
            <span className="flex items-center gap-1 text-[10px] font-mono text-emerald-400">
              <CheckCircle className="w-3 h-3" /> done · {elapsedSeconds}s
            </span>
          ) : error ? (
            <span className="flex items-center gap-1 text-[10px] font-mono text-red-400">
              <AlertCircle className="w-3 h-3" /> error
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[10px] font-mono text-white/30">
              <Loader className="w-3 h-3 animate-spin" /> {elapsedSeconds}s
            </span>
          )}
        </div>
      </div>

      {/* ── Phase indicator ── */}
      {phase && (
        <div className="px-4 py-2 flex items-center gap-2" style={{ background: 'rgba(99,102,241,0.06)' }}>
          <span className={`flex items-center gap-1 ${currentPhaseInfo?.color ?? 'text-white/40'}`}>
            {currentPhaseInfo?.icon}
            <span className="text-[10px] font-mono font-semibold uppercase tracking-wide">
              Phase {phase.phase} · {currentPhaseInfo?.label}
            </span>
          </span>
          <span className="text-[10px] text-white/30 font-mono truncate ml-1">{phase.message}</span>
          {phase.ring_radius_m && (
            <span className="ml-auto text-[10px] font-mono text-indigo-400/60 shrink-0">
              ⊙ {phase.ring_radius_m}m
            </span>
          )}
        </div>
      )}

      {/* ── Filmstrip ── */}
      <div
        ref={filmstripRef}
        className="flex gap-2 px-3 py-3 overflow-x-auto"
        style={{ scrollbarWidth: 'thin', minHeight: 110 }}
      >
        <AnimatePresence initial={false}>
          {frames.map((frame, idx) => {
            const isCapturing = frame.event_type === 'ring_point';
            const isRefined = frame.event_type === 'refinement';
            const hasScore = frame.status && !['ring_point', 'frame_captured'].includes(frame.event_type);
            const pct = frame.prominence_pct ?? 0;
            const pColor = prominenceColor(pct);

            return (
              <motion.div
                key={`${frame.pano_id}-${frame.fov}-${idx}`}
                initial={{ opacity: 0, scale: 0.85, x: 20 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                transition={{ duration: 0.2 }}
                className="relative shrink-0 rounded-lg overflow-hidden"
                style={{
                  width: isCapturing ? 72 : 96,
                  height: isCapturing ? 50 : 68,
                  border: frame.is_winner
                    ? '2px solid rgba(16,185,129,0.7)'
                    : isRefined
                      ? '1.5px solid rgba(99,102,241,0.4)'
                      : '1px solid rgba(255,255,255,0.08)',
                  boxShadow: frame.is_winner ? '0 0 12px rgba(16,185,129,0.35)' : 'none',
                  background: 'rgba(255,255,255,0.04)',
                }}
                title={frame.narration ?? frame.lens_type ?? `Frame ${idx + 1}`}
              >
                {isCapturing ? (
                  <div className="w-full h-full flex items-center justify-center">
                    <Loader className="w-3.5 h-3.5 text-white/20 animate-spin" />
                  </div>
                ) : (
                  <img
                    src={svThumb(frame.pano_id, frame.heading, frame.fov, frame.pitch, mapsApiKey)}
                    alt={frame.lens_type ?? `Frame ${idx + 1}`}
                    className="w-full h-full object-cover"
                    loading="eager"
                  />
                )}

                {frame.is_winner && (
                  <div className="absolute top-0.5 right-0.5 text-[11px] leading-none drop-shadow">👑</div>
                )}
                {hasScore && pct > 0 && (
                  <div
                    className="absolute bottom-0.5 left-0.5 text-[7px] font-mono px-1 rounded leading-tight"
                    style={{ background: pColor.bg, color: pColor.text }}
                  >
                    {pct}%
                  </div>
                )}
                <div
                  className="absolute top-0.5 left-0.5 text-[7px] font-mono px-0.5 rounded leading-tight"
                  style={{ background: 'rgba(0,0,0,0.65)', color: isRefined ? 'rgba(99,102,241,0.9)' : 'rgba(255,255,255,0.4)' }}
                >
                  {isRefined ? `r${frame.fov}` : frame.fov}°
                </div>
                {frame.status === 'perfect' && (
                  <div className="absolute bottom-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-400" />
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>

        {!isDone && !error && (
          <motion.div
            key="pulse"
            animate={{ opacity: [0.3, 0.7, 0.3] }}
            transition={{ duration: 1.2, repeat: Infinity }}
            className="shrink-0 w-16 h-[68px] rounded-lg flex items-center justify-center"
            style={{ border: '1px dashed rgba(99,102,241,0.3)', background: 'rgba(99,102,241,0.04)' }}
          >
            <Loader className="w-4 h-4 text-indigo-400/50 animate-spin" />
          </motion.div>
        )}
      </div>

      {/* ── Contact Sheet Preview ── */}
      {contactSheet && (
        <div className="px-3 py-2" style={{ background: 'rgba(99,102,241,0.04)', borderTop: '1px solid rgba(99,102,241,0.12)' }}>
          <p className="text-[9px] font-mono text-indigo-300/50 mb-1.5 uppercase tracking-widest">🔍 What Gemini sees</p>
          <img
            src={`data:image/jpeg;base64,${contactSheet}`}
            alt="Contact sheet"
            className="w-full rounded-lg object-contain"
            style={{ maxHeight: 220, border: '1px solid rgba(255,255,255,0.07)' }}
          />
        </div>
      )}

      {/* ── Stats ── */}
      <div className="px-4 py-2 border-t flex items-center gap-4" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
        <span className="text-[10px] font-mono text-white/30">
          <span className="text-white/60">{capturedCount}</span> captured
        </span>
        <span className="text-[10px] font-mono text-white/30">
          <span className="text-white/60">{rankedCount}</span> ranked
        </span>
        {bestFrame && (
          <span className="text-[10px] font-mono text-emerald-400/70 ml-auto">
            👑 best: {bestFrame.prominence_pct ?? 0}% prominence
          </span>
        )}
      </div>

      {/* ── Winner narration ── */}
      <AnimatePresence>
        {isDone && bestFrame?.narration && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            className="px-4 pb-3 overflow-hidden"
          >
            <p className="text-[11px] text-indigo-200/50 italic leading-relaxed border-l-2 pl-2" style={{ borderColor: 'rgba(99,102,241,0.3)' }}>
              "{bestFrame.narration}"
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Error ── */}
      {error && (
        <div className="px-4 pb-3 flex items-center gap-2">
          <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
          <p className="text-[11px] text-red-400/70 font-mono">{error}</p>
        </div>
      )}
    </div>
  );
}

/**
 * ExplorerLiveFeed.tsx
 *
 * Streams Explorer v2 progress in real-time via SSE from postalpeek-camera-preview.
 *
 * Visual flow (single screen, no duplicate representations):
 *
 *  Phase 1-2  →  Ring discovery + size classification status
 *  Phase 3    →  Grid of captured thumbnails growing as frames arrive
 *  contact_sheet event → Show composite image "what Gemini sees"
 *  ranked     →  Overlay score badges on each thumbnail in the grid
 *  done       →  Winner banner + narration
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader, CheckCircle, AlertCircle, Compass, Zap, Eye, ScanSearch } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

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

interface CapturedFrame {
  pano_id: string;
  heading: number;
  fov: number;
  pitch: number;
  lat: number;
  lng: number;
  index: number; // 1-based
  score?: number;
  prominence_pct?: number;
  narration?: string;
  is_winner?: boolean;
  status?: string;
}

interface ExplorerLiveFeedProps {
  locationName: string;
  lat: number;
  lng: number;
  mapsApiKey: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  onDone?: (summary: { total_frames: number; best_frame?: CapturedFrame }) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function svThumb(panoId: string, heading: number, fov: number, pitch: number, mapsKey: string) {
  return `https://maps.googleapis.com/maps/api/streetview?size=400x266&pano=${panoId}&heading=${Math.round(heading)}&pitch=${Math.round(pitch)}&fov=${fov}&key=${mapsKey}`;
}

function scoreColor(score: number) {
  if (score >= 7) return { bg: '#10b981', text: '#fff' };
  if (score >= 5) return { bg: '#f59e0b', text: '#fff' };
  return { bg: '#ef4444', text: '#fff' };
}

function phaseConfig(phase: number, msg: string) {
  switch (phase) {
    case 1: return { icon: <Compass className="w-4 h-4" />, color: 'text-purple-400', bg: 'rgba(147,51,234,0.1)', border: 'rgba(147,51,234,0.25)' };
    case 2: return { icon: <Compass className="w-4 h-4" />, color: 'text-blue-400', bg: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.25)' };
    case 3: return { icon: <Eye className="w-4 h-4" />, color: 'text-amber-400', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.25)' };
    case 4: return { icon: <Zap className="w-4 h-4" />, color: 'text-emerald-400', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.25)' };
    default: return { icon: <Loader className="w-4 h-4 animate-spin" />, color: 'text-white/30', bg: 'transparent', border: 'transparent' };
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

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
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [winner, setWinner] = useState<CapturedFrame | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(Date.now());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  // ── Event handler ──────────────────────────────────────────────────────────

  const handleEvent = useCallback((event: ExplorerProgressEvent) => {
    switch (event.type) {
      case 'phase':
        setPhaseNum(event.phase ?? 0);
        setPhaseMsg(event.message ?? '');
        break;

      case 'ring_point':
        // Just phase info, no visual action needed
        break;

      case 'frame_captured': {
        const f = event.frame;
        if (!f?.pano_id) break;
        setFrames(prev => {
          if (prev.find(x => x.pano_id === f.pano_id)) return prev;
          return [...prev, {
            pano_id: f.pano_id,
            heading: f.heading,
            fov: f.fov,
            pitch: f.pitch,
            lat: f.lat,
            lng: f.lng,
            index: prev.length + 1,
          }];
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
          x.pano_id === f.pano_id
            ? { ...x, score: f.score, prominence_pct: f.prominence_pct, narration: f.narration, is_winner: f.is_winner, status: f.status }
            : x
        ));
        break;
      }

      case 'refinement': {
        const f = event.frame;
        if (!f?.pano_id) break;
        setFrames(prev => {
          const exists = prev.find(x => x.pano_id === f.pano_id && x.fov === f.fov);
          if (exists) return prev;
          return [...prev, {
            pano_id: f.pano_id,
            heading: f.heading,
            fov: f.fov,
            pitch: f.pitch,
            lat: f.lat,
            lng: f.lng,
            index: prev.length + 1,
            score: f.score,
            prominence_pct: f.prominence_pct,
            narration: f.narration,
            is_winner: f.is_winner,
            status: f.status,
          }];
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
            score: f.score, prominence_pct: f.prominence_pct,
            narration: f.narration, is_winner: true,
          };
          setWinner(w);
          setFrames(prev => prev.map(x => x.pano_id === f.pano_id ? { ...x, is_winner: true } : x));
          onDoneRef.current?.({ total_frames: frames.length + 1, best_frame: w });
        }
        break;
      }
    }
  }, [frames.length]);

  // ── SSE connection ─────────────────────────────────────────────────────────

  useEffect(() => {
    startRef.current = Date.now();
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 1000);

    const fnUrl = `${supabaseUrl}/functions/v1/postalpeek-camera-preview`;
    const body = JSON.stringify({ lat, lng, stream: true });

    let es: EventSource | null = null;

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
      es?.close();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [lat, lng, supabaseUrl, supabaseAnonKey, handleEvent]);

  // ── Derived state ──────────────────────────────────────────────────────────

  const rankedFrames = frames.filter(f => f.score !== undefined);
  const pConfig = phaseConfig(phaseNum, phaseMsg);
  const sortedForDisplay = [...frames].sort((a, b) => (b.score ?? -1) - (a.score ?? -1));

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

      {/* ── Phase indicator ── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`${phaseNum}-${phaseMsg.slice(0, 20)}`}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="mx-3 mt-3 mb-1 px-3 py-2 rounded-xl flex items-center gap-2.5"
          style={{ background: pConfig.bg, border: `1px solid ${pConfig.border}` }}
        >
          <span className={pConfig.color}>{pConfig.icon}</span>
          <p className={`text-[11px] font-mono font-medium truncate ${pConfig.color}`}>
            {phaseNum > 0 && <span className="opacity-60 mr-1.5">PHASE {phaseNum} ·</span>}
            {phaseMsg}
          </p>
        </motion.div>
      </AnimatePresence>

      {/* ── Main content area ── */}
      <div className="px-3 pb-3 flex flex-col gap-3 mt-2">

        {/* ── State: Early phases (ring discovery) — just show phase info ── */}
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

        {/* ── State: Frames captured — show thumbnail grid ── */}
        {frames.length > 0 && !contactSheet && (
          <>
            <p className="text-[9px] font-mono text-white/25 uppercase tracking-widest px-0.5">
              {frames.length} frame{frames.length > 1 ? 's' : ''} captured
            </p>
            <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
              <AnimatePresence initial={false}>
                {frames.map((frame, idx) => (
                  <motion.div
                    key={`${frame.pano_id}-${frame.fov}`}
                    initial={{ opacity: 0, scale: 0.92 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.25, delay: idx * 0.04 }}
                    className="relative rounded-xl overflow-hidden"
                    style={{
                      aspectRatio: '3/2',
                      border: frame.is_winner
                        ? '2px solid #10b981'
                        : '1px solid rgba(255,255,255,0.08)',
                      boxShadow: frame.is_winner ? '0 0 16px rgba(16,185,129,0.3)' : 'none',
                    }}
                  >
                    <img
                      src={svThumb(frame.pano_id, frame.heading, frame.fov, frame.pitch, mapsApiKey)}
                      alt={`Frame ${frame.index}`}
                      className="w-full h-full object-cover"
                      loading="eager"
                    />
                    {/* Frame index badge */}
                    <div className="absolute top-1.5 left-1.5 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded"
                      style={{ background: 'rgba(0,0,0,0.7)', color: 'rgba(255,255,255,0.6)' }}>
                      {idx + 1}
                    </div>
                    {/* FOV badge */}
                    <div className="absolute top-1.5 right-1.5 text-[9px] font-mono px-1.5 py-0.5 rounded"
                      style={{ background: 'rgba(0,0,0,0.6)', color: 'rgba(255,255,255,0.4)' }}>
                      {frame.fov}°
                    </div>
                    {/* Score badge (when ranked) */}
                    {frame.score !== undefined && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.7 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="absolute bottom-1.5 right-1.5 text-[11px] font-bold px-2 py-0.5 rounded-lg"
                        style={{ background: scoreColor(frame.score).bg, color: scoreColor(frame.score).text }}
                      >
                        {frame.score}/10
                      </motion.div>
                    )}
                    {/* Prominence badge */}
                    {frame.prominence_pct !== undefined && frame.prominence_pct > 0 && (
                      <div className="absolute bottom-1.5 left-1.5 text-[9px] font-mono px-1.5 py-0.5 rounded"
                        style={{ background: 'rgba(0,0,0,0.65)', color: 'rgba(255,255,255,0.55)' }}>
                        {frame.prominence_pct}%
                      </div>
                    )}
                    {/* Winner crown */}
                    {frame.is_winner && (
                      <div className="absolute top-0 right-0 left-0 h-1 rounded-t-xl" style={{ background: '#10b981' }} />
                    )}
                  </motion.div>
                ))}
                {/* Placeholder for in-progress */}
                {!isDone && (
                  <motion.div
                    key="placeholder"
                    animate={{ opacity: [0.3, 0.6, 0.3] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    className="rounded-xl flex items-center justify-center"
                    style={{
                      aspectRatio: '3/2',
                      border: '1px dashed rgba(99,102,241,0.3)',
                      background: 'rgba(99,102,241,0.04)',
                    }}
                  >
                    <Loader className="w-5 h-5 text-indigo-400/30 animate-spin" />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </>
        )}

        {/* ── State: Contact sheet ready → show what Gemini sees ── */}
        <AnimatePresence>
          {contactSheet && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl overflow-hidden"
              style={{ border: '1px solid rgba(99,102,241,0.2)', background: 'rgba(99,102,241,0.05)' }}
            >
              <div className="flex items-center gap-2 px-3 py-2" style={{ borderBottom: '1px solid rgba(99,102,241,0.1)' }}>
                <ScanSearch className="w-3.5 h-3.5 text-indigo-400/60" />
                <p className="text-[10px] font-mono text-indigo-300/60 uppercase tracking-widest">
                  {isAnalyzing ? (
                    <span className="flex items-center gap-1.5">
                      <Loader className="w-2.5 h-2.5 animate-spin" />
                      Gemini is analyzing all frames…
                    </span>
                  ) : rankedFrames.length > 0 ? (
                    `${rankedFrames.length} frames ranked`
                  ) : 'Contact sheet'}
                </p>
              </div>
              <img
                src={`data:image/jpeg;base64,${contactSheet}`}
                alt="Contact sheet — all frames side by side"
                className="w-full object-contain"
                style={{ maxHeight: 260, display: 'block' }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── State: Done → Winner banner ── */}
        <AnimatePresence>
          {isDone && winner && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl overflow-hidden"
              style={{ border: '1px solid rgba(16,185,129,0.3)', background: 'rgba(16,185,129,0.06)' }}
            >
              {/* Winner thumbnail */}
              <div className="relative">
                <img
                  src={svThumb(winner.pano_id, winner.heading, winner.fov, winner.pitch, mapsApiKey)}
                  alt="Best frame"
                  className="w-full object-cover rounded-t-xl"
                  style={{ height: 140 }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent rounded-t-xl" />
                <div className="absolute bottom-2 left-3 right-3 flex items-end justify-between">
                  <span className="text-base">👑</span>
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
              {/* Narration */}
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
            <span className="text-white/55">{frames.length}</span> captured
          </span>
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

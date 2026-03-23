import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X, Search, Loader, MapPin, Cloud, Sun, Eye, Star, Clock, Target } from 'lucide-react';
import type { FeedItem } from './Postcard';
import { t, getLang } from '../utils/i18n';

// ── Types ──────────────────────────────────────────────────────────────
interface TagWithBox {
  label: string | { en?: string; es?: string };
  type?: string;
  box_2d?: number[];
  bbox?: number[];
  confidence?: number;
}

function getLabel(label: string | { en?: string; es?: string }): string {
  if (typeof label === 'string') return label;
  const lang = getLang();
  return label?.[lang] || label?.en || label?.es || 'Object';
}

// ── Non-playable tags (abstract elements bad for find-the-object) ────────
const NON_PLAYABLE = new Set([
  'shadow', 'sombra', 'reflection', 'reflejo', 'sky', 'cielo',
  'sunlight', 'luz solar', 'floor', 'suelo', 'ground', 'pavement',
  'horizon', 'horizonte', 'clouds', 'nubes', 'light', 'luz',
  'darkness', 'oscuridad', 'fog', 'niebla', 'mist',
]);

const NON_PLAYABLE_TYPES = new Set(['style', 'scene_details']);

function isPlayableTag(tag: TagWithBox): boolean {
  if (tag.type && NON_PLAYABLE_TYPES.has(tag.type)) return false;
  const en = typeof tag.label === 'object' ? tag.label?.en : tag.label;
  const es = typeof tag.label === 'object' ? tag.label?.es : undefined;
  if (en && NON_PLAYABLE.has(en.toLowerCase())) return false;
  if (es && NON_PLAYABLE.has(es.toLowerCase())) return false;
  return true;
}

// ── Hand-drawn circle SVG ───────────────────────────────────────────────
function HandDrawnCircle({ cx, cy, rx, ry, seed = 0 }: {
  cx: number; cy: number; rx: number; ry: number; seed?: number;
}) {
  const rotation = useMemo(() => ((seed * 137.5) % 12) - 6, [seed]);
  const circumference = Math.PI * 2 * Math.max(rx, ry);

  return (
    <motion.ellipse
      cx={cx}
      cy={cy}
      rx={rx * 1.15}
      ry={ry * 1.15}
      fill="none"
      stroke="rgba(239,68,68,0.75)"
      strokeWidth="2.5"
      strokeLinecap="round"
      transform={`rotate(${rotation} ${cx} ${cy})`}
      initial={{ strokeDasharray: circumference, strokeDashoffset: circumference }}
      animate={{ strokeDashoffset: 0 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      filter="url(#sketchy)"
    />
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Hook: usePostcardGame — encapsulates all game state + logic
// ═══════════════════════════════════════════════════════════════════════
export function usePostcardGame(item: FeedItem) {
  // Track discovered objects by their INDEX in tagsWithBbox, not by label string.
  // This prevents the bug where two tags with the same label (e.g. two "Window")
  // would collide — discovering one would mark both as found, leaving the game stuck.
  const [discoveredIndices, setDiscoveredIndices] = useState<Set<number>>(new Set());
  const [showReward, setShowReward] = useState<string | null>(null);
  const [allFound, setAllFound] = useState(false);
  const [hintIndex, setHintIndex] = useState<number | null>(null);
  const missCountRef = useRef(0);

  // Timer
  const startTimeRef = useRef<number>(Date.now());
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Hint tracking for star rating
  const hintsUsedRef = useRef(0);
  const [hintsUsed, setHintsUsed] = useState(0);

  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [liveTags, setLiveTags] = useState<TagWithBox[] | null>(null);

  const existingTags = useMemo(() => {
    const raw = item.illustration_tags as unknown as TagWithBox[] | null;
    if (!raw || !Array.isArray(raw)) return [];
    return raw.filter(t => {
      const coords = t.box_2d ?? t.bbox;
      if (!coords || !Array.isArray(coords) || coords.length !== 4) return false;
      return isPlayableTag(t);
    });
  }, [item.illustration_tags]);

  const tagsWithBbox = liveTags ?? existingTags;
  const totalObjects = tagsWithBbox.length;
  const needsScan = existingTags.length === 0 && !liveTags;

  // Current target is the first undiscovered tag BY INDEX
  const currentTargetIndex = useMemo(() => {
    const idx = tagsWithBbox.findIndex((_t, i) => !discoveredIndices.has(i));
    return idx >= 0 ? idx : null;
  }, [tagsWithBbox, discoveredIndices]);

  const currentTarget = currentTargetIndex !== null
    ? getLabel(tagsWithBbox[currentTargetIndex].label)
    : null;

  // Auto-scan
  useEffect(() => {
    if (!needsScan) return;
    let cancelled = false;
    async function runScan() {
      setIsScanning(true);
      setScanError(null);
      try {
        const baseUrl = import.meta.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321';
        const res = await fetch(`${baseUrl}/functions/v1/postalpeek-semantic-segment`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', apikey: import.meta.env.VITE_SUPABASE_ANON_KEY || '' },
          body: JSON.stringify({ image_url: item.illustration_url, postcard_id: item.id }),
        });
        if (!res.ok) throw new Error(`Scan failed (${res.status})`);
        const data = await res.json();
        if (cancelled) return;
        const scanned = (data.layers || []).filter((t: TagWithBox) => {
          const coords = t.box_2d ?? t.bbox;
          return coords && Array.isArray(coords) && coords.length === 4;
        });
        setLiveTags(scanned);
      } catch (err) {
        if (!cancelled) setScanError(err instanceof Error ? err.message : 'Scan failed');
      } finally {
        if (!cancelled) setIsScanning(false);
      }
    }
    runScan();
    return () => { cancelled = true; };
  }, [needsScan, item.illustration_url, item.id]);

  // Click handler
  const handleImageClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation(); // ← prevent zoom/clean toggle
    if (totalObjects === 0 || currentTargetIndex === null) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = ((e.clientX - rect.left) / rect.width) * 1000;
    const clickY = ((e.clientY - rect.top) / rect.height) * 1000;

    const PAD_FACTOR = 0.2;
    const MIN_PAD = 15;
    const targetTag = tagsWithBbox[currentTargetIndex];
    if (!targetTag) return;
    const coords = targetTag.box_2d ?? targetTag.bbox;
    if (!coords) return;
    const [ymin, xmin, ymax, xmax] = coords;
    const boxW = xmax - xmin;
    const boxH = ymax - ymin;
    const padX = Math.max(boxW * PAD_FACTOR, MIN_PAD);
    const padY = Math.max(boxH * PAD_FACTOR, MIN_PAD);

    const isHit = clickX >= (xmin - padX) && clickX <= (xmax + padX) &&
                  clickY >= (ymin - padY) && clickY <= (ymax + padY);

    const targetLabel = getLabel(targetTag.label);

    if (isHit) {
      const newDiscovered = new Set([...discoveredIndices, currentTargetIndex]);
      setDiscoveredIndices(newDiscovered);
      missCountRef.current = 0;
      setHintIndex(null);

      const isComplete = newDiscovered.size >= totalObjects;
      if (isComplete) {
        // Final discovery: special toast + longer duration
        setShowReward('__ALL_FOUND__');
        setTimeout(() => setShowReward(null), 3500);
        // Freeze timer
        setElapsedSeconds(Math.round((Date.now() - startTimeRef.current) / 1000));
        setHintsUsed(hintsUsedRef.current);
        setTimeout(() => setAllFound(true), 600);
      } else {
        setShowReward(targetLabel);
        setTimeout(() => setShowReward(null), 2500);
      }
    } else {
      missCountRef.current += 1;
      if (missCountRef.current >= 4 && hintIndex === null) {
        setHintIndex(currentTargetIndex);
        hintsUsedRef.current += 1;
        missCountRef.current = 0;
        setTimeout(() => setHintIndex(null), 1500);
      }
    }
  }, [tagsWithBbox, discoveredIndices, totalObjects, currentTargetIndex, hintIndex]);

  return {
    discoveredIndices, showReward, allFound, hintIndex,
    isScanning, scanError, tagsWithBbox, totalObjects, currentTarget,
    handleImageClick, elapsedSeconds, hintsUsed,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// Component 1: GameImageOverlay — renders INSIDE the image container
// ═══════════════════════════════════════════════════════════════════════
interface GameImageOverlayProps {
  game: ReturnType<typeof usePostcardGame>;
}

export function GameImageOverlay({ game }: GameImageOverlayProps) {
  const { isScanning, tagsWithBbox, discoveredIndices, hintIndex, handleImageClick } = game;

  return (
    <div
      className={`absolute inset-0 z-20 ${game.allFound ? 'cursor-default' : 'cursor-crosshair'}`}
      onClick={handleImageClick}
    >
      {/* Scanning shimmer */}
      {isScanning && (
        <div className="absolute inset-0 z-30 pointer-events-none">
          <div
            className="w-full h-full animate-pulse"
            style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.1) 0%, rgba(217,119,6,0.15) 50%, rgba(245,158,11,0.05) 100%)' }}
          />
          {/* Centered scanning indicator */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-black/50 backdrop-blur-sm">
              <Loader className="w-4 h-4 text-amber-400 animate-spin" />
              <span className="text-white text-xs font-medium">
                {t({ es: 'Analizando...', en: 'Analyzing...' })}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* SVG overlay for circles + hints */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none z-30"
        viewBox="0 0 1000 1000"
        preserveAspectRatio="none"
      >
        <defs>
          <filter id="sketchy" x="-5%" y="-5%" width="110%" height="110%">
            <feTurbulence type="turbulence" baseFrequency="0.03" numOctaves="3" result="turbulence" seed={42} />
            <feDisplacementMap in="SourceGraphic" in2="turbulence" scale="3" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>

        {tagsWithBbox.map((tag, idx) => {
          const coords = tag.box_2d ?? tag.bbox;
          if (!coords) return null;
          const [ymin, xmin, ymax, xmax] = coords;
          if (!discoveredIndices.has(idx)) return null;
          const cx = (xmin + xmax) / 2;
          const cy = (ymin + ymax) / 2;
          const rx = (xmax - xmin) / 2;
          const ry = (ymax - ymin) / 2;
          return <HandDrawnCircle key={`circle-${idx}`} cx={cx} cy={cy} rx={rx} ry={ry} seed={idx} />;
        })}

        {hintIndex !== null && (() => {
          const tag = tagsWithBbox[hintIndex];
          if (!tag) return null;
          const coords = tag.box_2d ?? tag.bbox;
          if (!coords) return null;
          const [ymin, xmin, ymax, xmax] = coords;
          return (
            <motion.ellipse
              key={`hint-${hintIndex}`}
              cx={(xmin + xmax) / 2} cy={(ymin + ymax) / 2}
              rx={(xmax - xmin) / 2 * 1.3} ry={(ymax - ymin) / 2 * 1.3}
              fill="rgba(245,158,11,0.15)"
              stroke="rgba(245,158,11,0.6)"
              strokeWidth="2"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.8, 0.2, 0.8, 0.2, 0.8, 0] }}
              transition={{ duration: 1.5, ease: 'easeInOut' }}
            />
          );
        })()}
      </svg>

      {/* Discovery toast */}
      <AnimatePresence>
        {game.showReward && (
          <motion.div
            key={game.showReward}
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className="absolute top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-full shadow-2xl backdrop-blur-md"
            style={{
              background: game.showReward === '__ALL_FOUND__'
                ? 'linear-gradient(135deg, rgba(16,185,129,0.9) 0%, rgba(5,150,105,0.95) 100%)'
                : 'linear-gradient(135deg, rgba(245,158,11,0.85) 0%, rgba(217,119,6,0.95) 100%)',
              border: '1px solid rgba(255,255,255,0.25)',
            }}
          >
            {game.showReward === '__ALL_FOUND__' ? (
              <>
                <span className="text-lg">🎉</span>
                <span className="text-white font-bold text-sm tracking-tight">
                  {t({ es: '¡Completado!', en: 'All Found!' })}
                </span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-white animate-pulse" />
                <span className="text-white font-bold text-sm tracking-tight">{game.showReward}</span>
                <span className="text-white/70 text-xs">+1 ⭐</span>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Component 2: GameBottomPanel — renders WHERE action bar normally goes
// ═══════════════════════════════════════════════════════════════════════
interface GameBottomPanelProps {
  item: FeedItem;
  game: ReturnType<typeof usePostcardGame>;
  onClose: () => void;
}

export function GameBottomPanel({ item, game, onClose }: GameBottomPanelProps) {
  const { isScanning, scanError, totalObjects, discoveredIndices, currentTarget, allFound, elapsedSeconds, hintsUsed } = game;
  const progress = totalObjects > 0 ? (discoveredIndices.size / totalObjects) * 100 : 0;

  // Star rating based on hints used
  const starRating = hintsUsed === 0 ? 3 : hintsUsed <= 2 ? 2 : 1;

  // Format elapsed time
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  // Build facts from item metadata
  const facts: { icon: React.ReactNode; text: string }[] = [];
  const desc = typeof item.description === 'string'
    ? item.description
    : (item.description as { en?: string; es?: string })?.en || (item.description as { en?: string; es?: string })?.es;
  if (desc) facts.push({ icon: <MapPin className="w-3 h-3" />, text: desc });
  if (item.scene_type) facts.push({ icon: <Eye className="w-3 h-3" />, text: item.scene_type.replace(/_/g, ' ') });
  if (item.time_of_day) facts.push({ icon: <Sun className="w-3 h-3" />, text: item.time_of_day.replace(/_/g, ' ') });
  if (item.weather) facts.push({ icon: <Cloud className="w-3 h-3" />, text: item.weather.replace(/_/g, ' ') });
  if (item.aesthetic_vibes?.length) {
    facts.push({ icon: <Sparkles className="w-3 h-3" />, text: item.aesthetic_vibes.slice(0, 3).join(', ') });
  }
  if (facts.length === 0) {
    facts.push({ icon: <MapPin className="w-3 h-3" />, text: `${item.city}, ${item.country}` });
  }

  // ── All Found: Minimal bar with Listo button below green line ──
  if (allFound) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-2 md:mt-3 px-1 pb-1 shrink-0"
      >
        {/* Green completed progress bar */}
        <div className="mb-2">
          <div className="w-full h-1.5 rounded-full bg-stone-200 overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ background: 'linear-gradient(90deg, #10b981, #059669)' }}
              initial={{ width: 0 }}
              animate={{ width: '100%' }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          </div>
        </div>

        {/* Compact stats + stars + Listo button */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="flex items-center gap-3"
        >
          <div className="flex items-center gap-1.5">
            <Target className="w-3.5 h-3.5 text-emerald-500" />
            <span className="text-stone-700 text-xs font-bold tabular-nums">{totalObjects}/{totalObjects}</span>
          </div>
          <div className="w-px h-3 bg-stone-200" />
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-stone-400" />
            <span className="text-stone-600 text-xs font-medium tabular-nums">{formatTime(elapsedSeconds)}</span>
          </div>
          <div className="w-px h-3 bg-stone-200" />
          <div className="flex items-center gap-0.5">
            {[1, 2, 3].map((i) => (
              <Star
                key={i}
                className={`w-3.5 h-3.5 ${
                  i <= starRating ? 'text-amber-400 fill-amber-400' : 'text-stone-300'
                }`}
              />
            ))}
          </div>

          {/* Spacer + Listo button aligned right */}
          <div className="flex-1" />
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="flex items-center gap-1 px-3.5 py-1.5 rounded-full text-[11px] font-bold text-white transition-all hover:brightness-110 shadow-md"
            style={{
              background: 'linear-gradient(135deg, #10b981, #059669)',
              boxShadow: '0 2px 8px rgba(16,185,129,0.3)',
            }}
          >
            {t({ es: 'Listo', en: 'Done' })} ✨
          </button>
        </motion.div>
      </motion.div>
    );
  }

  // ── In-progress: normal game panel ──
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      className="mt-2 md:mt-3 px-1 pb-1 shrink-0"
    >
      {/* ─── Progress bar ─── */}
      <div className="mb-2">
        <div className="flex items-center justify-between mb-1">
          {/* Current target */}
          {isScanning ? (
            <div className="flex items-center gap-1.5 text-amber-600 text-xs font-medium">
              <Loader className="w-3 h-3 animate-spin" />
              <span>{t({ es: 'Analizando...', en: 'Analyzing...' })}</span>
            </div>
          ) : currentTarget ? (
            <motion.div
              key={currentTarget}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-1.5"
            >
              <Search className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-stone-800 text-xs font-semibold">
                {t({ es: 'Busca:', en: 'Find:' })} <span className="text-amber-600">{currentTarget}</span>
              </span>
            </motion.div>
          ) : null}

          {/* Score + Exit */}
          <div className="flex items-center gap-2 shrink-0">
            {totalObjects > 0 && !isScanning && (
              <span className="text-xs font-bold text-stone-500 tabular-nums">
                {discoveredIndices.size}/{totalObjects}
              </span>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="flex items-center gap-1 px-2 py-1 rounded-full bg-stone-200 hover:bg-stone-300 text-stone-500 text-[11px] font-semibold transition-all"
            >
              <X className="w-3 h-3" />
              {t({ es: 'Salir', en: 'Exit' })}
            </button>
          </div>
        </div>

        {/* Visual progress bar */}
        {totalObjects > 0 && !isScanning && (
          <div className="w-full h-1.5 rounded-full bg-stone-200 overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ background: 'linear-gradient(90deg, #f59e0b, #d97706)' }}
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            />
          </div>
        )}

        {/* Scanning progress placeholder */}
        {isScanning && (
          <div className="w-full h-1.5 rounded-full bg-stone-200 overflow-hidden">
            <div className="h-full w-1/3 rounded-full bg-amber-400/60 animate-pulse" />
          </div>
        )}

        {scanError && <p className="text-red-500 text-[11px] mt-1">{scanError}</p>}
      </div>

      {/* ─── Facts / Know about this place ─── */}
      <div className="flex flex-col gap-1 mt-1">
        {facts.slice(0, 3).map((fact, i) => (
          <div key={i} className="flex items-start gap-1.5 text-stone-500 text-[11px] leading-snug">
            <span className="text-stone-400 flex-shrink-0 mt-0.5">{fact.icon}</span>
            <span className="capitalize" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{fact.text}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

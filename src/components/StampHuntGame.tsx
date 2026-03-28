/**
 * StampHuntGame.tsx
 *
 * "¿Dónde está el Sello?" mini-game.
 * A "Where's Waldo?" style game where the player finds the PostalPeek stamp
 * hidden in the postcard illustration.
 *
 * Architecture: useStampHunt hook + StampHuntOverlay + StampHuntBottomPanel
 * (same pattern as PostcardGame.tsx and PostcardPuzzle.tsx)
 */
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, Stamp, Sparkles } from 'lucide-react';
import { PostalPeekStampSVG } from './ui/PostalPeekStampSVG';
import type { FeedItem } from './Postcard';
import { NextGameCountdown } from './NextGameCountdown';
import { t } from '../utils/i18n';

// ── Seeded random from string (deterministic positions per postcard) ────
function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return Math.abs(hash);
}

function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) & 0xffffffff;
    return (state >>> 0) / 0xffffffff;
  };
}

// ── Stamp position & difficulty ─────────────────────────────────────────
interface StampPlacement {
  /** X position 0–1 (percentage of image width) */
  x: number;
  /** Y position 0–1 (percentage of image height) */
  y: number;
  /** Stamp size as fraction of image width (0.04 = small, 0.08 = large) */
  size: number;
  /** Rotation in degrees */
  rotation: number;
  /** Difficulty tier */
  difficulty: 'easy' | 'medium' | 'hard';
}

function computeStampPlacement(postcardId: string): StampPlacement {
  const hash = hashCode(postcardId);
  const rng = seededRandom(hash);

  // Keep stamp away from edges (10%–90% range)
  const x = 0.10 + rng() * 0.80;
  const y = 0.10 + rng() * 0.80;
  const rotation = (rng() * 30) - 15; // -15° to +15°

  // Difficulty based on hash modulo
  const difficultyRoll = hash % 100;
  let difficulty: 'easy' | 'medium' | 'hard';
  let size: number;

  if (difficultyRoll < 30) {
    difficulty = 'easy';
    size = 0.09 + rng() * 0.02; // 9–11% of width
  } else if (difficultyRoll < 75) {
    difficulty = 'medium';
    size = 0.06 + rng() * 0.02; // 6–8% of width
  } else {
    difficulty = 'hard';
    size = 0.04 + rng() * 0.015; // 4–5.5% of width
  }

  return { x, y, size, rotation, difficulty };
}



// ═══════════════════════════════════════════════════════════════════════
// Hook: useStampHunt
// ═══════════════════════════════════════════════════════════════════════
export function useStampHunt(item: FeedItem) {
  // Random placement each time the component mounts (different per play session)
  const [placement] = useState(() => computeStampPlacement(item.id + Math.random().toString()));

  const [found, setFound] = useState(false);
  const [tapsCount, setTapsCount] = useState(0);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [hintActive, setHintActive] = useState(false);
  const [showReward, setShowReward] = useState(false);
  const missCountRef = useRef(0);
  const hintsUsedRef = useRef(0);

  // Timer
  const startTimeRef = useRef<number>(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Start timer on mount
  useEffect(() => {
    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => {
      setElapsedSeconds(Math.round((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [item.id]);

  // Auto-hint at 60 seconds
  useEffect(() => {
    if (found) return;
    if (elapsedSeconds >= 60 && !hintActive && hintsUsedRef.current === 0) {
      setHintActive(true);
      hintsUsedRef.current += 1;
      setTimeout(() => setHintActive(false), 3000);
    }
  }, [elapsedSeconds, found, hintActive]);

  const handleImageClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (found) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = (e.clientX - rect.left) / rect.width;
    const clickY = (e.clientY - rect.top) / rect.height;

    setTapsCount(prev => prev + 1);

    // Check if click is within stamp area (with generous tolerance)
    const tolerance = placement.size * 0.8; // generous hit area
    const dx = clickX - placement.x;
    const dy = clickY - placement.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist <= tolerance) {
      // Found it!
      setFound(true);
      setShowReward(true);
      setElapsedSeconds(Math.round((Date.now() - startTimeRef.current) / 1000));
      setHintsUsed(hintsUsedRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
      setTimeout(() => setShowReward(false), 3500);
    } else {
      // Miss
      missCountRef.current += 1;
      if (missCountRef.current >= 5 && !hintActive) {
        setHintActive(true);
        hintsUsedRef.current += 1;
        missCountRef.current = 0;
        setTimeout(() => setHintActive(false), 2000);
      }
    }
  }, [found, placement, hintActive]);

  return {
    placement,
    found,
    tapsCount,
    hintsUsed,
    hintActive,
    showReward,
    elapsedSeconds,
    handleImageClick,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// Component: StampHuntOverlay — renders over the image area
// ═══════════════════════════════════════════════════════════════════════

/** Zoom level inside the loupe circle */
const LOUPE_ZOOM = 2.5;
/** Radius of the visible loupe circle in px */
const LOUPE_RADIUS = 50;

interface StampHuntOverlayProps {
  hunt: ReturnType<typeof useStampHunt>;
  imageUrl: string;
}

export function StampHuntOverlay({ hunt, imageUrl }: StampHuntOverlayProps) {
  const { placement, found, hintActive, handleImageClick, showReward } = hunt;
  const containerRef = useRef<HTMLDivElement>(null);
  const lensRef = useRef<HTMLImageElement>(null);

  // ── Loupe lens tracking (ref-based, zero re-renders) ──
  const updateLens = useCallback((clientX: number, clientY: number) => {
    const container = containerRef.current;
    const lens = lensRef.current;
    if (!container || !lens || found) return;

    const rect = container.getBoundingClientRect();
    const rx = (clientX - rect.left) / rect.width;
    const ry = (clientY - rect.top) / rect.height;

    if (rx < 0 || rx > 1 || ry < 0 || ry > 1) {
      lens.style.opacity = '0';
      return;
    }

    const ox = rx * rect.width;
    const oy = ry * rect.height;
    const tx = (clientX - rect.left) - ox * LOUPE_ZOOM;
    const ty = (clientY - rect.top) - oy * LOUPE_ZOOM;

    lens.style.opacity = '1';
    lens.style.width = `${rect.width}px`;
    lens.style.height = `${rect.height}px`;
    lens.style.clipPath = `circle(${LOUPE_RADIUS}px at ${clientX - rect.left}px ${clientY - rect.top}px)`;
    lens.style.transform = `translate(${tx}px, ${ty}px) scale(${LOUPE_ZOOM})`;
    lens.style.transformOrigin = '0 0';
  }, [found]);

  const hideLens = useCallback(() => {
    if (lensRef.current) lensRef.current.style.opacity = '0';
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    updateLens(e.clientX, e.clientY);
  }, [updateLens]);

  // Block scroll via a native non-passive listener (React touch events are passive by default,
  // so e.preventDefault() in the synthetic handler is silently ignored by the browser).
  useEffect(() => {
    const el = containerRef.current;
    if (!el || found) return;

    const blockScroll = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        e.preventDefault();
        updateLens(e.touches[0].clientX, e.touches[0].clientY);
      }
    };

    el.addEventListener('touchmove', blockScroll, { passive: false });
    return () => el.removeEventListener('touchmove', blockScroll);
  }, [found, updateLens]);

  // Kept as a no-op to satisfy the JSX onTouchMove prop (actual work is in the effect above)
  const handleTouchMove = useCallback(() => {
    // handled by native non-passive listener above
  }, []);

  // Stamp rendered as a percentage-positioned element
  const stampStyle: React.CSSProperties = {
    position: 'absolute',
    left: `${placement.x * 100}%`,
    top: `${placement.y * 100}%`,
    width: `${placement.size * 100}%`,
    transform: `translate(-50%, -50%) rotate(${placement.rotation}deg)`,
    // Camouflage: blend into illustration
    mixBlendMode: 'multiply',
    opacity: found ? 1 : 0.25,
    transition: found ? 'opacity 0.3s ease, transform 0.5s ease' : 'none',
    pointerEvents: 'none',
    zIndex: 25,
    aspectRatio: '1',
  };

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 z-20 ${found ? 'cursor-default' : 'cursor-crosshair'}`}
      onClick={handleImageClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={hideLens}
      onTouchMove={handleTouchMove}
      onTouchEnd={hideLens}
      style={{ touchAction: 'none' }}
    >
      {/* The hidden stamp */}
      <div style={stampStyle}>
        <motion.div
          animate={found ? {
            scale: [1, 1.6, 1.2],
            opacity: [0.25, 1, 1],
            rotate: [placement.rotation, placement.rotation + 10, placement.rotation],
          } : {}}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          <PostalPeekStampSVG className="w-full h-full" />
        </motion.div>
      </div>

      {/* Loupe lens — zoomed image clipped to circle following cursor */}
      {!found && imageUrl && (
        <img
          ref={lensRef}
          src={imageUrl}
          alt=""
          draggable={false}
          className="absolute top-0 left-0 pointer-events-none select-none will-change-transform"
          style={{
            opacity: 0,
            transition: 'opacity 0.15s ease-out',
            objectFit: 'cover',
            zIndex: 22,
          }}
        />
      )}

      {/* Hint glow */}
      {hintActive && !found && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.6, 0.2, 0.6, 0.2, 0.6, 0] }}
          transition={{ duration: 2, ease: 'easeInOut' }}
          className="absolute rounded-full pointer-events-none"
          style={{
            left: `${placement.x * 100}%`,
            top: `${placement.y * 100}%`,
            width: `${placement.size * 200}%`,
            height: `${placement.size * 200}%`,
            transform: 'translate(-50%, -50%)',
            background: 'radial-gradient(circle, rgba(245,158,11,0.4) 0%, transparent 70%)',
            zIndex: 24,
          }}
        />
      )}

      {/* Discovery toast */}
      <AnimatePresence>
        {showReward && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className="absolute top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-full shadow-2xl backdrop-blur-md"
            style={{
              background: 'linear-gradient(135deg, rgba(180,60,50,0.9) 0%, rgba(140,40,35,0.95) 100%)',
              border: '1px solid rgba(255,255,255,0.25)',
            }}
          >
            <span className="text-lg">📮</span>
            <span className="text-white font-bold text-sm tracking-tight">
              {t({ es: '¡Sello Encontrado!', en: 'Stamp Found!' })}
            </span>
            <span className="text-white/70 text-xs">+1 📮</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Component: StampHuntBottomPanel — shows during stamp hunt
// ═══════════════════════════════════════════════════════════════════════
interface StampHuntBottomPanelProps {
  item: FeedItem;
  hunt: ReturnType<typeof useStampHunt>;
  onClose: () => void;
}

export function StampHuntBottomPanel({ hunt, onClose }: StampHuntBottomPanelProps) {
  const { found, tapsCount, hintsUsed, placement } = hunt;

  // Star rating: 3 = no hints, 2 = 1 hint, 1 = 2+ hints
  const starRating = hintsUsed === 0 ? 3 : hintsUsed <= 1 ? 2 : 1;



  const difficultyLabel = {
    easy: t({ es: 'Fácil', en: 'Easy' }),
    medium: t({ es: 'Medio', en: 'Medium' }),
    hard: t({ es: 'Difícil', en: 'Hard' }),
  }[placement.difficulty];

  const difficultyColor = {
    easy: 'text-emerald-600',
    medium: 'text-amber-600',
    hard: 'text-rose-600',
  }[placement.difficulty];

  // ── Complete state ──
  if (found) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm mx-auto pointer-events-auto bg-white/95 backdrop-blur-md rounded-2xl p-3 shadow-lg border border-white/50"
      >
        {/* Red completed progress bar */}
        <div className="mb-2">
          <div className="w-full h-1.5 rounded-full bg-stone-200 overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ background: 'linear-gradient(90deg, #b43c32, #8c2823)' }}
              initial={{ width: 0 }}
              animate={{ width: '100%' }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          </div>
        </div>

        {/* Compact stats + Listo button */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="flex items-center gap-3"
        >
          <div className="flex items-center gap-1.5">
            <Stamp className="w-3.5 h-3.5 text-red-700" />
            <span className="text-stone-700 text-xs font-bold tabular-nums">
              {tapsCount} {t({ es: 'toques', en: 'taps' })}
            </span>
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

          <div className="flex-1" />
          <NextGameCountdown seconds={3} onAdvance={onClose} />
        </motion.div>
      </motion.div>
    );
  }

  // ── In-progress state ──
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      className="w-full max-w-sm mx-auto pointer-events-auto bg-white/95 backdrop-blur-md rounded-2xl p-4 shadow-lg border border-white/50"
    >
      {/* Progress hint */}
      <div className="mb-2">
        <div className="flex items-center justify-between mb-1">
          <motion.div
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-1.5"
          >
            <Stamp className="w-3.5 h-3.5 text-red-700" />
            <span className="text-stone-800 text-xs font-semibold">
              {t({ es: 'Encuentra el sello', en: 'Find the stamp' })} 📮
            </span>
            <span className={`text-[10px] font-medium ${difficultyColor}`}>
              ({difficultyLabel})
            </span>
          </motion.div>

        </div>

        {/* Taps indicator */}
        <div className="flex items-center gap-2">
          <div className="w-full h-1.5 rounded-full bg-stone-200 overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ background: 'linear-gradient(90deg, #b43c32, #8c2823)' }}
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(tapsCount * 10, 95)}%` }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            />
          </div>
        </div>
      </div>

      {/* Tap count + hint tip */}
      <div className="flex items-start gap-1.5 text-stone-500 text-[11px] leading-snug">
        <span className="text-stone-400 flex-shrink-0 mt-0.5">
          <Sparkles className="w-3 h-3" />
        </span>
        <span>
          {tapsCount === 0
            ? t({ es: 'Toca la imagen para buscar el sello', en: 'Tap the image to search for the stamp' })
            : t({
                es: `${tapsCount} ${tapsCount === 1 ? 'toque' : 'toques'}. ¡Sigue buscando!`,
                en: `${tapsCount} ${tapsCount === 1 ? 'tap' : 'taps'}. Keep looking!`,
              })}
        </span>
      </div>
    </motion.div>
  );
}

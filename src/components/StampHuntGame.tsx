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
import React, { useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, Stamp, Sparkles } from 'lucide-react';
import { useStampHunt } from '../hooks/useStampHunt';
import { PostalPeekStampSVG } from './ui/PostalPeekStampSVG';
import type { FeedItem } from './Postcard';
import { NextGameCountdown } from './NextGameCountdown';
import { GameTimerBar } from './GameTimerBar';
import { t } from '../utils/i18n';

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
  const { placement, found, hintActive, handleImageClick, showReward, status } = hunt;
  const isLost = status === 'lost';
  const isRevealed = found || isLost;
  const containerRef = useRef<HTMLDivElement>(null);
  const lensRef = useRef<HTMLImageElement>(null);
  const loupeStampRef = useRef<HTMLDivElement>(null);

  // ── Loupe lens tracking (ref-based, zero re-renders) ──
  const updateLens = useCallback((clientX: number, clientY: number) => {
    const container = containerRef.current;
    const lens = lensRef.current;
    const loupeStamp = loupeStampRef.current;
    if (!container || !lens || isRevealed) return;

    const rect = container.getBoundingClientRect();
    const rx = (clientX - rect.left) / rect.width;
    const ry = (clientY - rect.top) / rect.height;

    if (rx < 0 || rx > 1 || ry < 0 || ry > 1) {
      lens.style.opacity = '0';
      if (loupeStamp) loupeStamp.style.opacity = '0';
      return;
    }

    const ox = rx * rect.width;
    const oy = ry * rect.height;
    const tx = (clientX - rect.left) - ox * LOUPE_ZOOM;
    const ty = (clientY - rect.top) - oy * LOUPE_ZOOM;

    const clipPath = `circle(${LOUPE_RADIUS}px at ${clientX - rect.left}px ${clientY - rect.top}px)`;
    const transform = `translate(${tx}px, ${ty}px) scale(${LOUPE_ZOOM})`;

    lens.style.opacity = '1';
    lens.style.width = `${rect.width}px`;
    lens.style.height = `${rect.height}px`;
    lens.style.clipPath = clipPath;
    lens.style.transform = transform;
    lens.style.transformOrigin = '0 0';

    // Mirror the same transform onto the loupe stamp layer
    if (loupeStamp) {
      loupeStamp.style.opacity = '1';
      loupeStamp.style.width = `${rect.width}px`;
      loupeStamp.style.height = `${rect.height}px`;
      loupeStamp.style.clipPath = clipPath;
      loupeStamp.style.transform = transform;
      loupeStamp.style.transformOrigin = '0 0';
    }
  }, [isRevealed]);

  const hideLens = useCallback(() => {
    if (lensRef.current) lensRef.current.style.opacity = '0';
    if (loupeStampRef.current) loupeStampRef.current.style.opacity = '0';
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    updateLens(e.clientX, e.clientY);
  }, [updateLens]);

  // Block scroll via a native non-passive listener (React touch events are passive by default,
  // so e.preventDefault() in the synthetic handler is silently ignored by the browser).
  useEffect(() => {
    const el = containerRef.current;
    if (!el || isRevealed) return;

    const blockScroll = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        e.preventDefault();
        updateLens(e.touches[0].clientX, e.touches[0].clientY);
      }
    };

    el.addEventListener('touchmove', blockScroll, { passive: false });
    return () => el.removeEventListener('touchmove', blockScroll);
  }, [isRevealed, updateLens]);

  // Kept as a no-op to satisfy the JSX onTouchMove prop (actual work is in the effect above)
  const handleTouchMove = useCallback(() => {
    // handled by native non-passive listener above
  }, []);

  // Stamp rendered as a percentage-positioned element
  // z-index must be ABOVE the loupe lens (15) so it's never covered
  const stampStyle: React.CSSProperties = {
    position: 'absolute',
    left: `${placement.x * 100}%`,
    top: `${placement.y * 100}%`,
    width: `${placement.size * 100}%`,
    transform: `translate(-50%, -50%) rotate(${placement.rotation}deg)`,
    // Camouflage: blend into illustration when hiding, stand out when revealed
    mixBlendMode: isRevealed ? 'normal' : 'multiply',
    filter: isRevealed ? 'drop-shadow(0px 10px 15px rgba(0,0,0,0.5))' : 'none',
    opacity: isRevealed ? 1 : 0.25,
    transition: isRevealed ? 'opacity 0.3s ease, transform 0.5s ease, filter 0.3s ease' : 'none',
    pointerEvents: 'none',
    zIndex: 20,
    aspectRatio: '1',
  };

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 z-20 ${isRevealed ? 'cursor-default' : 'cursor-crosshair'}`}
      onClick={handleImageClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={hideLens}
      onTouchMove={handleTouchMove}
      onTouchEnd={hideLens}
      style={{ touchAction: 'none' }}
    >
      {/* Loupe lens — zoomed background image */}
      {!isRevealed && imageUrl && (
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
            zIndex: 15,
          }}
        />
      )}

      {/* Loupe stamp — same transform/clip as loupe but renders the stamp magnified */}
      {!isRevealed && (
        <div
          ref={loupeStampRef}
          className="absolute top-0 left-0 pointer-events-none select-none will-change-transform"
          style={{ opacity: 0, zIndex: 16 }}
        >
          <div
            style={{
              position: 'absolute',
              left: `${placement.x * 100}%`,
              top: `${placement.y * 100}%`,
              width: `${placement.size * 100}%`,
              transform: `translate(-50%, -50%) rotate(${placement.rotation}deg)`,
              mixBlendMode: 'multiply',
              opacity: 0.25,
              aspectRatio: '1',
            }}
          >
            <PostalPeekStampSVG className="w-full h-full" />
          </div>
        </div>
      )}

      {/* The hidden stamp — rendered AFTER loupe so it always paints on top */}
      <div style={stampStyle}>
        <motion.div
          animate={isRevealed ? {
            scale: [1, 1.6, 1.2],
            opacity: [0.25, 1, 1],
            rotate: [placement.rotation, placement.rotation + 10, placement.rotation],
          } : {}}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          <PostalPeekStampSVG className="w-full h-full" />
        </motion.div>
      </div>

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
  hunt: Omit<ReturnType<typeof useStampHunt>, 'overlayProps'>;
  onClose: (won: boolean, elapsedSeconds: number) => void;
  failLabel?: { es: string; en: string };
}

export function StampHuntBottomPanel({ hunt, onClose, failLabel }: StampHuntBottomPanelProps) {
  const { found, tapsCount, hintsUsed, placement, elapsedSeconds, status } = hunt;

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
  if (found || status === 'won') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm mx-auto pointer-events-auto bg-white/95 backdrop-blur-md rounded-2xl p-3 shadow-lg border border-red-500/30"
      >
        <GameTimerBar elapsedSeconds={elapsedSeconds} maxSeconds={15} status="won" />

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
          <NextGameCountdown seconds={3} onAdvance={() => onClose(true, elapsedSeconds)} />
        </motion.div>
      </motion.div>
    );
  }

  // ── Lost state ──
  if (status === 'lost') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm mx-auto pointer-events-auto bg-white/95 backdrop-blur-md rounded-2xl p-3 shadow-lg border border-red-500/50"
      >
        <GameTimerBar elapsedSeconds={elapsedSeconds} maxSeconds={15} status="lost" />
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="flex items-center justify-between mt-2"
        >
          <div className="flex items-center gap-1.5 text-red-600 px-2">
            <span className="text-xl">👎</span>
            <span className="text-sm font-bold">{t({ es: '¡Intenta más rápido!', en: 'Try faster!' })}</span>
          </div>
          <button
            onClick={() => onClose(false, elapsedSeconds)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-stone-900 text-white font-bold text-sm"
          >
            {failLabel ? t(failLabel) : t({ es: 'Continuar', en: 'Continue' })}
          </button>
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

        {/* Visual Timer Bar */}
        <GameTimerBar elapsedSeconds={elapsedSeconds} maxSeconds={15} status={status} />
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

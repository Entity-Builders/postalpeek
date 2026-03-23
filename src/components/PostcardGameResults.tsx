/**
 * PostcardGameResults.tsx
 *
 * The "back" of the postcard during game mode.
 * Shown when the player finds all objects — the card flips to reveal
 * game stats + generation metadata in a classic postcard reverse style.
 */
import React from 'react';
import { motion } from 'framer-motion';
import { Star, Clock, Target } from 'lucide-react';
import type { FeedItem } from './Postcard';
import { t, useLang } from '../utils/i18n';

interface PostcardGameResultsProps {
  item: FeedItem;
  gameType?: 'hunt' | 'puzzle';
  totalObjects: number;
  elapsedSeconds: number;
  hintsUsed: number;
  moves?: number;
}

export function PostcardGameResults({
  item,
  gameType = 'hunt',
  totalObjects,
  elapsedSeconds,
  hintsUsed,
  moves,
}: PostcardGameResultsProps) {
  useLang();

  const starRating = gameType === 'puzzle'
    ? (moves != null && moves <= 12 ? 3 : moves != null && moves <= 20 ? 2 : 1)
    : (hintsUsed === 0 ? 3 : hintsUsed <= 2 ? 2 : 1);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  // ── Extract generation metadata ──
  const meta = item.generation_metadata;
  const storytelling = meta?.storytelling;
  const didYouKnow = storytelling?.did_you_know;

  const desc =
    typeof item.description === 'string'
      ? item.description
      : (item.description as { en?: string; es?: string })?.en ||
        (item.description as { en?: string; es?: string })?.es ||
        '';

  return (
    <div
      className="absolute inset-0 w-full h-full flex flex-col"
      onClick={(e) => e.stopPropagation()}
      style={{
        backfaceVisibility: 'hidden',
        WebkitBackfaceVisibility: 'hidden',
        transform: 'rotateY(180deg)',
        WebkitTransform: 'rotateY(180deg)',
      }}
    >
      {/* Paper background */}
      <div className="absolute inset-0 bg-[#fdfbf7] rounded-sm overflow-hidden">
        {/* Paper texture */}
        <div
          className="absolute inset-0 opacity-[0.03] pointer-events-none mix-blend-multiply"
          style={{
            backgroundImage:
              'url("https://www.transparenttextures.com/patterns/cream-paper.png")',
          }}
        />
      </div>

      {/* Content — scrollable, padded */}
      <div className="relative flex flex-col w-full h-full p-4 md:p-6 overflow-y-auto text-stone-800">
        {/* ── Header: "¡Ganaste la Postal!" ── */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-center mb-4"
        >
          <span className="text-2xl md:text-3xl">{gameType === 'puzzle' ? '🧩' : '🏆'}</span>
          <h2 className="text-base md:text-lg font-bold text-stone-800 mt-1">
            {gameType === 'puzzle'
              ? t({ es: '¡Armaste la Postal!', en: 'You Assembled the Postcard!' })
              : t({ es: '¡Ganaste la Postal!', en: 'You Won the Postcard!' })}
          </h2>
          <p className="text-[10px] text-stone-400 font-mono uppercase tracking-widest mt-0.5">
            {item.city}, {item.country}
          </p>
        </motion.div>

        {/* ── Stats row ── */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4 }}
          className="flex items-center justify-center gap-4 md:gap-6 py-3 px-4 rounded-xl bg-stone-100/80 border border-stone-200/60 mb-4"
        >
          {/* Objects / Moves */}
          <div className="flex flex-col items-center gap-0.5">
            <Target className="w-4 h-4 text-emerald-500" />
            <span className="text-sm font-bold text-stone-800 tabular-nums">
              {gameType === 'puzzle' ? `${moves ?? 0}` : `${totalObjects}/${totalObjects}`}
            </span>
            <span className="text-[9px] text-stone-400 uppercase tracking-wider">
              {gameType === 'puzzle'
                ? t({ es: 'Movimientos', en: 'Moves' })
                : t({ es: 'Objetos', en: 'Objects' })}
            </span>
          </div>

          <div className="w-px h-8 bg-stone-200" />

          {/* Time */}
          <div className="flex flex-col items-center gap-0.5">
            <Clock className="w-4 h-4 text-stone-400" />
            <span className="text-sm font-bold text-stone-800 tabular-nums">
              {formatTime(elapsedSeconds)}
            </span>
            <span className="text-[9px] text-stone-400 uppercase tracking-wider">
              {t({ es: 'Tiempo', en: 'Time' })}
            </span>
          </div>

          <div className="w-px h-8 bg-stone-200" />

          {/* Stars */}
          <div className="flex flex-col items-center gap-0.5">
            <div className="flex gap-0.5">
              {[1, 2, 3].map((i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0, rotate: -90 }}
                  animate={{ opacity: 1, scale: 1, rotate: 0 }}
                  transition={{ delay: 0.6 + i * 0.2, type: 'spring', stiffness: 300 }}
                >
                  <Star
                    className={`w-4 h-4 ${
                      i <= starRating
                        ? 'text-amber-400 fill-amber-400'
                        : 'text-stone-300'
                    }`}
                  />
                </motion.div>
              ))}
            </div>
            <span className="text-[9px] text-stone-400 uppercase tracking-wider mt-1">
              {t({ es: 'Estrellas', en: 'Stars' })}
            </span>
          </div>

        </motion.div>

        {/* ── Divider with postmark feel ── */}
        <div className="flex items-center gap-2 mb-3">
          <div className="flex-1 h-px bg-stone-200" />
          <span className="text-[9px] text-stone-300 font-mono uppercase tracking-widest">
            {t({ es: 'Sobre esta postal', en: 'About this postcard' })}
          </span>
          <div className="flex-1 h-px bg-stone-200" />
        </div>

        {/* ── Generation Metadata ── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="flex flex-col gap-2 flex-1 min-h-0"
        >
          {/* Did you know? — takes all remaining space */}
          {didYouKnow && (
            <div className="bg-amber-50/80 rounded-lg p-3 border border-amber-100/60 flex-1 min-h-0 overflow-y-auto">
              <p className="text-[9px] text-amber-700 font-bold uppercase tracking-wider mb-1">
                💡 {t({ es: '¿Sabías que...?', en: 'Did you know...?' })}
              </p>
              <p className="text-xs text-stone-700 leading-relaxed">
                {t(didYouKnow)}
              </p>
            </div>
          )}

          {/* Description — only when no did_you_know */}
          {!didYouKnow && desc && (
            <p className="font-poetic italic text-sm text-stone-700 leading-relaxed">
              "{t(item.description)}"
            </p>
          )}
        </motion.div>
      </div>
    </div>
  );
}

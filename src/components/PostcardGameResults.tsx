/**
 * PostcardGameResults.tsx
 *
 * The "back" of the postcard during game mode.
 * Shown when the player completes a mini-game — the card flips to reveal
 * game stats, album info, and place facts in a classic postcard reverse style.
 */
import React from 'react';
import { motion } from 'framer-motion';
import { Star, Target, MapPin, Sparkles, Eye, Cloud, Sun, BookOpen } from 'lucide-react';
import type { FeedItem } from './Postcard';
import { t, useLang } from '../utils/i18n';

interface PostcardGameResultsProps {
  item: FeedItem;
  gameType?: 'hunt' | 'puzzle' | 'stamp';
  totalObjects: number;
  hintsUsed: number;
  moves?: number;
  taps?: number;
  /** Album info */
  albumTitle?: string;
  albumSequence?: number;
  albumTotal?: number;
}

export function PostcardGameResults({
  item,
  gameType = 'hunt',
  hintsUsed,
  moves,
  taps,
  albumTitle,
  albumSequence,
  albumTotal,
}: PostcardGameResultsProps) {
  useLang();

  const starRating = gameType === 'puzzle'
    ? (moves != null && moves <= 12 ? 3 : moves != null && moves <= 20 ? 2 : 1)
    : (hintsUsed === 0 ? 3 : hintsUsed <= 2 ? 2 : 1);

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

  // ── Place details for "About" section ──
  const placeDetails: { icon: React.ReactNode; label: string }[] = [];
  if (item.scene_type) placeDetails.push({ icon: <Eye className="w-3 h-3" />, label: item.scene_type.replace(/_/g, ' ') });
  if (item.weather) placeDetails.push({ icon: <Cloud className="w-3 h-3" />, label: item.weather.replace(/_/g, ' ') });
  if (item.time_of_day) placeDetails.push({ icon: <Sun className="w-3 h-3" />, label: item.time_of_day.replace(/_/g, ' ') });
  if (item.architecture_style) placeDetails.push({ icon: <MapPin className="w-3 h-3" />, label: item.architecture_style });
  if (item.aesthetic_vibes?.length) placeDetails.push({ icon: <Sparkles className="w-3 h-3" />, label: item.aesthetic_vibes.slice(0, 3).join(', ') });

  const hasAlbum = !!albumTitle;

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
        <div
          className="absolute inset-0 opacity-[0.03] pointer-events-none mix-blend-multiply"
          style={{
            backgroundImage:
              'url("https://www.transparenttextures.com/patterns/cream-paper.png")',
          }}
        />
      </div>

      {/* Content — scrollable, padded */}
      <div className="relative flex flex-col w-full h-full p-4 md:p-5 overflow-y-auto text-stone-800">
        {/* ── Section 1: Header ── */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-center mb-3"
        >
          <span className="text-2xl">
            {gameType === 'stamp' ? '📮' : gameType === 'puzzle' ? '🧩' : '🔍'}
          </span>
          <h2 className="text-sm md:text-base font-bold text-stone-800 mt-1">
            {gameType === 'stamp'
              ? t({ es: '¡Sello Encontrado!', en: 'Stamp Found!' })
              : gameType === 'puzzle'
                ? t({ es: '¡Puzzle Armado!', en: 'Puzzle Complete!' })
                : t({ es: '¡Encontrado!', en: 'Found it!' })}
          </h2>
          <p className="text-[10px] text-stone-400 font-mono uppercase tracking-widest mt-0.5">
            {item.city}, {item.country}
          </p>
        </motion.div>

        {/* ── Section 2: Compact Stats Row ── */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.35 }}
          className="flex items-center justify-center gap-4 py-2.5 px-3 rounded-xl bg-stone-100/80 border border-stone-200/60 mb-3"
        >
          {/* Objects / Moves / Taps */}
          <div className="flex flex-col items-center gap-0.5">
            <Target className="w-3.5 h-3.5 text-emerald-500" />
            <span className="text-xs font-bold text-stone-800 tabular-nums">
              {gameType === 'stamp' ? `${taps ?? 0}` : gameType === 'puzzle' ? `${moves ?? 0}` : '✓'}
            </span>
            <span className="text-[8px] text-stone-400 uppercase tracking-wider">
              {gameType === 'stamp'
                ? t({ es: 'Toques', en: 'Taps' })
                : gameType === 'puzzle'
                  ? t({ es: 'Mov.', en: 'Moves' })
                  : t({ es: 'Listo', en: 'Done' })}
            </span>
          </div>

          <div className="w-px h-7 bg-stone-200" />

          {/* Stars */}
          <div className="flex flex-col items-center gap-0.5">
            <div className="flex gap-0.5">
              {[1, 2, 3].map((i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0, rotate: -90 }}
                  animate={{ opacity: 1, scale: 1, rotate: 0 }}
                  transition={{ delay: 0.5 + i * 0.15, type: 'spring', stiffness: 300 }}
                >
                  <Star
                    className={`w-3.5 h-3.5 ${
                      i <= starRating
                        ? 'text-amber-400 fill-amber-400'
                        : 'text-stone-300'
                    }`}
                  />
                </motion.div>
              ))}
            </div>
            <span className="text-[8px] text-stone-400 uppercase tracking-wider mt-0.5">
              {t({ es: 'Estrellas', en: 'Stars' })}
            </span>
          </div>
        </motion.div>

        {/* ── Section 3: Rich Content Area ── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="flex flex-col gap-2.5 flex-1 min-h-0"
        >
          {/* Album info badge */}
          {hasAlbum && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50/80 border border-blue-100/60">
              <BookOpen className="w-4 h-4 text-blue-500 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-blue-800 truncate">
                  📚 {albumTitle}
                </p>
                {albumSequence != null && albumTotal != null && (
                  <p className="text-[10px] text-blue-500 mt-0.5">
                    {t({ es: 'Parada', en: 'Stop' })} {albumSequence} {t({ es: 'de', en: 'of' })} {albumTotal}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Did you know? */}
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

          {/* Place details — shown when no "did you know" available */}
          {!didYouKnow && placeDetails.length > 0 && (
            <div className="bg-stone-50/80 rounded-lg p-3 border border-stone-200/60 flex-1 min-h-0 overflow-y-auto">
              <p className="text-[9px] text-stone-500 font-bold uppercase tracking-wider mb-1.5">
                📍 {t({ es: 'Sobre este lugar', en: 'About this place' })}
              </p>
              <div className="flex flex-col gap-1.5">
                {placeDetails.map((detail, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-xs text-stone-600">
                    <span className="text-stone-400 flex-shrink-0">{detail.icon}</span>
                    <span className="capitalize">{detail.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Description — only when no metadata sections at all */}
          {!didYouKnow && placeDetails.length === 0 && desc && (
            <p className="font-poetic italic text-sm text-stone-600 leading-relaxed text-center px-2">
              "{t(item.description)}"
            </p>
          )}
        </motion.div>
      </div>
    </div>
  );
}

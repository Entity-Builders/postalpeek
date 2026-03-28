/**
 * PostcardGameResults.tsx
 *
 * The "back" of the postcard during game mode.
 * Shown when the player completes a mini-game — the card flips to reveal
 * game stats, album info, and place facts in a classic postcard reverse style.
 */
import React from 'react';
import { motion } from 'framer-motion';
import { BookOpen } from 'lucide-react';
import type { FeedItem } from './Postcard';
import { t, useLang } from '../utils/i18n';
import { useRiddles } from '../hooks/useRiddles';

interface PostcardGameResultsProps {
  item: FeedItem;
  gameType?: 'hunt' | 'puzzle' | 'stamp';
  targetLabel?: string;
  targetEnLabel?: string;
  /** Album info */
  albumTitle?: string;
  albumSequence?: number;
  albumTotal?: number;
  onOpenAlbum?: (albumId: string) => void;
}

export function PostcardGameResults({
  item,
  gameType = 'hunt',
  targetLabel,
  targetEnLabel,
  albumTitle,
  albumSequence,
  albumTotal,
  onOpenAlbum,
}: PostcardGameResultsProps) {
  useLang();

  // ── Extract generation metadata ──
  const meta = item.generation_metadata;
  const storytelling = meta?.storytelling;
  const didYouKnow = storytelling?.did_you_know;

  const { riddles } = useRiddles(item.id);
  const riddleText = targetEnLabel ? riddles.get(targetEnLabel)?.text : undefined;

  const desc =
    typeof item.description === 'string'
      ? item.description
      : (item.description as { en?: string; es?: string })?.en ||
        (item.description as { en?: string; es?: string })?.es ||
        '';

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
          <h2 className="text-sm md:text-base font-bold text-stone-800 mt-1 capitalize">
            {gameType === 'stamp'
              ? t({ es: '¡Sello Encontrado!', en: 'Stamp Found!' })
              : gameType === 'puzzle'
                ? t({ es: '¡Puzzle Armado!', en: 'Puzzle Complete!' })
                : targetLabel 
                  ? targetLabel.replace(/_/g, ' ')
                  : t({ es: '¡Encontrado!', en: 'Found it!' })}
          </h2>
          {riddleText && (
             <p className="text-xs text-amber-600 font-medium italic mt-2 px-6">
              "{riddleText}"
            </p>
          )}
          <p className="text-[10px] text-stone-400 font-mono uppercase tracking-widest mt-1.5">
            {item.city}, {item.country}
          </p>
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
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (item.album_id && onOpenAlbum) {
                  onOpenAlbum(item.album_id);
                }
              }}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50/80 border border-blue-100/60 hover:bg-blue-100 transition-colors w-full text-left"
            >
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
            </button>
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

          {/* Description — only when no metadata sections at all */}
          {!didYouKnow && desc && (
            <p className="font-poetic italic text-sm text-stone-600 leading-relaxed text-center px-2">
              "{t(item.description)}"
            </p>
          )}
        </motion.div>
      </div>
    </div>
  );
}

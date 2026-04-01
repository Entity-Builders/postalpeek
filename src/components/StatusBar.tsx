import React from 'react';
import { motion } from 'framer-motion';
import { BookOpen, Dice5, Mail, Trophy } from 'lucide-react';
import { PostalPeekStampSVG } from './ui/PostalPeekStampSVG';
import type { Album } from '../hooks/useAlbums';
import { useLang, t } from '../utils/i18n';

interface StatusBarProps {
  /** All albums with progress */
  albums: Album[];
  /** Callback when the user taps the focused album section */
  onAlbumTap: (album: Album) => void;
  /** Callback when the user taps the Albums count button */
  onAlbumsTap: () => void;
  /** Total postcards owned by the user */
  collectionCount: number;
  /** Current stamp balances by rarity */
  stampBalances: {
    common: number;
    rare: number;
    epic: number;
    legendary: number;
  };
  /** Callback to open the game */
  onPlayTap: () => void;
  /** Callback to open the collection */
  onCollectionTap: () => void;
  /** Callback when user taps the stamp balance widget */
  onStampTap?: () => void;
}

/**
 * Pick the "focused" album:
 * 1. The one with the most progress (highest collected_slots / total_slots ratio, not yet complete)
 * 2. If all are complete or none exist → null
 */
function pickFocusedAlbum(albums: Album[]): Album | null {
  const incomplete = albums.filter(
    (a) => a.completed_at === null && a.total_slots > 0,
  );
  if (incomplete.length === 0) return albums.length > 0 ? albums[0] : null;

  return incomplete.reduce((best, a) => {
    const ratio = a.collected_slots / a.total_slots;
    const bestRatio = best.collected_slots / best.total_slots;
    return ratio > bestRatio ? a : best;
  }, incomplete[0]);
}

export function StatusBar({
  albums,
  onAlbumTap,
  onAlbumsTap,
  collectionCount,
  stampBalances,
  onPlayTap,
  onCollectionTap,
  onStampTap,
}: StatusBarProps) {
  const lang = useLang();

  const focused = pickFocusedAlbum(albums);
  const progress =
    focused && focused.total_slots > 0
      ? Math.round((focused.collected_slots / focused.total_slots) * 100)
      : 0;

  const canPlay = collectionCount > 0;

  return (
    <motion.div
      initial={{ y: 80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 80, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 280, damping: 26, delay: 0.3 }}
      className='fixed bottom-0 left-0 right-0 z-[60] px-3 pb-[env(safe-area-inset-bottom,8px)]'
    >
      <div className='max-w-lg mx-auto bg-stone-900/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/10 overflow-hidden'>
        <div className='flex items-stretch divide-x divide-white/10'>
          {/* ── Album en Foco ── */}
          <button
            onClick={() => focused && onAlbumTap(focused)}
            className='flex-[2] flex items-center gap-2.5 px-3.5 py-3 text-left hover:bg-white/5 transition-colors min-w-0 cursor-pointer'
          >
            <div className='w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center shrink-0'>
              <Trophy className='w-4 h-4 text-amber-400' />
            </div>
            <div className='min-w-0 flex-1'>
              {focused ? (
                <>
                  <p className='text-[10px] text-white/50 font-medium uppercase tracking-wider leading-none mb-0.5'>
                    {t({ es: 'Álbum', en: 'Album' }, lang)}
                  </p>
                  <p className='text-xs text-white font-semibold truncate leading-tight'>
                    {t(focused.title, lang)}
                  </p>
                  <div className='flex items-center gap-1.5 mt-1'>
                    <div className='flex-1 h-1 bg-white/10 rounded-full overflow-hidden'>
                      <div
                        className='h-full bg-amber-400 rounded-full transition-all duration-500'
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <span className='text-[9px] text-white/40 font-mono shrink-0'>
                      {focused.collected_slots}/{focused.total_slots}
                    </span>
                  </div>
                </>
              ) : (
                <p className='text-xs text-white/60 font-medium'>
                  {t({ es: 'Sin álbumes', en: 'No albums' }, lang)}
                </p>
              )}
            </div>
          </button>

          {/* ── Play CTA ── */}
          <button
            onClick={canPlay ? onPlayTap : undefined}
            disabled={!canPlay}
            title={
              !canPlay
                ? t(
                    {
                      es: 'Necesitás al menos una postal para jugar',
                      en: 'You need at least one card to play',
                    },
                    lang,
                  )
                : undefined
            }
            className={`flex-1 flex flex-col items-center justify-center px-4 py-3 transition-colors ${
              canPlay
                ? 'hover:bg-white/5 cursor-pointer'
                : 'opacity-40 cursor-not-allowed'
            }`}
          >
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center mb-0.5 ${
                canPlay ? 'bg-blue-500/20' : 'bg-white/10'
              }`}
            >
              <Dice5
                className={`w-4 h-4 ${canPlay ? 'text-blue-400' : 'text-white/30'}`}
              />
            </div>
            <span className='text-[9px] text-white/50 font-semibold uppercase tracking-wider'>
              {t({ es: 'Jugar', en: 'Play' }, lang)}
            </span>
          </button>

          {/* ── Collection count ── */}
          <button
            onClick={onCollectionTap}
            className='flex-1 flex flex-col items-center justify-center px-4 py-3 hover:bg-white/5 transition-colors cursor-pointer'
          >
            <div className='w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center mb-0.5'>
              <Mail className='w-4 h-4 text-emerald-400' />
            </div>
            <span className='text-[9px] text-white/50 font-semibold uppercase tracking-wider'>
              {collectionCount > 0 ? (
                <span className='text-white/70'>{collectionCount}</span>
              ) : (
                '0'
              )}{' '}
              {t({ es: 'postales', en: 'cards' }, lang)}
            </span>
          </button>

          {/* ── Albums count ── */}
          <button
            onClick={onAlbumsTap}
            className='flex-1 flex flex-col items-center justify-center px-4 py-3 hover:bg-white/5 transition-colors cursor-pointer'
          >
            <div className='w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center mb-0.5'>
              <BookOpen className='w-4 h-4 text-amber-400' />
            </div>
            <span className='text-[9px] text-white/50 font-semibold uppercase tracking-wider'>
              {(() => {
                const opened = albums.filter((a) => a.collected_slots > 0).length;
                return opened > 0 ? (
                  <span className='text-white/70'>{opened}</span>
                ) : (
                  '0'
                );
              })()}{' '}
              {t({ es: 'álbumes', en: 'albums' }, lang)}
            </span>
          </button>

          {/* ── Stamp balances ── */}
          <button
            onClick={onStampTap}
            className='flex-1 flex flex-col items-center justify-center px-4 py-3 hover:bg-white/5 transition-colors cursor-pointer min-w-[70px]'
          >
            <div className='w-9 h-9 flex flex-col justify-center items-center gap-[2px] mb-0.5'>
              <div className="flex gap-[2px]">
                <div className="flex items-center gap-[1px] bg-stone-800/80 px-1 rounded-sm border border-white/5">
                  <PostalPeekStampSVG rarity="common" className='w-2.5 h-2.5 text-stone-300' />
                  <span className='text-[8px] font-mono text-white/80 leading-none'>{stampBalances.common}</span>
                </div>
                <div className="flex items-center gap-[1px] bg-stone-800/80 px-1 rounded-sm border border-white/5">
                  <PostalPeekStampSVG rarity="rare" className='w-2.5 h-2.5 text-blue-400' />
                  <span className='text-[8px] font-mono text-white/80 leading-none'>{stampBalances.rare}</span>
                </div>
              </div>
              <div className="flex gap-[2px]">
                <div className="flex items-center gap-[1px] bg-stone-800/80 px-1 rounded-sm border border-white/5">
                  <PostalPeekStampSVG rarity="epic" className='w-2.5 h-2.5 text-purple-400' />
                  <span className='text-[8px] font-mono text-white/80 leading-none'>{stampBalances.epic}</span>
                </div>
                <div className="flex items-center gap-[1px] bg-stone-800/80 px-1 rounded-sm border border-white/5">
                  <PostalPeekStampSVG rarity="legendary" className='w-2.5 h-2.5 text-amber-400' />
                  <span className='text-[8px] font-mono text-white/80 leading-none'>{stampBalances.legendary}</span>
                </div>
              </div>
            </div>
            <span className='text-[9px] font-semibold uppercase tracking-wider text-white/50'>
              {t({ es: 'sellos', en: 'stamps' }, lang)}
            </span>
          </button>
        </div>
      </div>
    </motion.div>
  );
}

import React from 'react';
import { motion } from 'framer-motion';
import { Trophy, Dice5, Mail } from 'lucide-react';
import { PostalPeekStampSVG } from './ui/PostalPeekStampSVG';
import type { Album } from '../hooks/useAlbums';
import { useLang, t } from '../utils/i18n';

interface StatusBarProps {
  /** All albums with progress */
  albums: Album[];
  /** Total postcards owned by the user */
  collectionCount: number;
  /** Current stamp balance */
  stampBalance: number;
  /** Callback when the user taps the album section */
  onAlbumTap: (album: Album) => void;
  /** Callback to open the game */
  onPlayTap: () => void;
  /** Callback to open the collection */
  onCollectionTap: () => void;
  /** Callback when user taps the stamp balance widget */
  onStampTap?: () => void;
}

/**
 * Pick the "focused" album for the StatusBar.
 * Rules:
 * 1. Prefer albums in progress (collected_slots > 0)
 * 2. If multiple are in progress, pick the one closest to completion
 * 3. If none are started, pick the first incomplete album (so the user sees something to work on)
 * 4. If all are complete or none exist → null
 */
function pickFocusedAlbum(albums: Album[]): Album | null {
  const incomplete = albums.filter((a) => a.completed_at === null && a.total_slots > 0);
  if (incomplete.length === 0) return null;

  const inProgress = incomplete.filter((a) => a.collected_slots > 0);
  if (inProgress.length === 0) return incomplete[0];

  return inProgress.reduce((best, a) => {
    const ratio = a.collected_slots / a.total_slots;
    const bestRatio = best.collected_slots / best.total_slots;
    return ratio > bestRatio ? a : best;
  }, inProgress[0]);
}

export function StatusBar({
  albums,
  collectionCount,
  stampBalance,
  onAlbumTap,
  onPlayTap,
  onCollectionTap,
  onStampTap,
}: StatusBarProps) {
  const lang = useLang();
  const focused = pickFocusedAlbum(albums);
  
  // Count of albums the user has actually started or completed
  const userAlbumsCount = albums.filter(a => a.collected_slots > 0 || a.completed_at !== null).length;

  const progress =
    focused && focused.total_slots > 0
      ? Math.round((focused.collected_slots / focused.total_slots) * 100)
      : 0;
  const canPlay = focused !== null && focused.collected_slots > 0;

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
                  <div className='flex items-center gap-1.5 mb-0.5'>
                    <p className='text-[10px] text-white/50 font-medium uppercase tracking-wider leading-none'>
                      {t({ es: 'Mis Álbumes', en: 'My Albums' }, lang)}
                    </p>
                    {userAlbumsCount > 0 && (
                      <span className='px-1.5 py-[1px] rounded bg-white/10 text-[8px] font-bold text-white/70 leading-none'>
                        {userAlbumsCount}
                      </span>
                    )}
                  </div>
                  <p className='text-xs text-white font-semibold truncate leading-tight'>
                    {focused.title}
                  </p>
                  {/* Mini progress bar */}
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
                <div className='flex items-center gap-1.5'>
                  <p className='text-xs text-white/60 font-medium'>
                    {userAlbumsCount === 0
                      ? t({ es: 'Sin álbumes', en: 'No albums' }, lang)
                      : t({ es: 'Todo completo 🎉', en: 'All complete 🎉' }, lang)}
                  </p>
                  {userAlbumsCount > 0 && (
                    <span className='px-1.5 py-[1px] rounded bg-white/10 text-[8px] font-bold text-white/70 leading-none'>
                      {userAlbumsCount}
                    </span>
                  )}
                </div>
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
                      es: 'Necesitás al menos una postal en el álbum',
                      en: 'You need at least one card in the album',
                    },
                    lang,
                  )
                : undefined
            }
            className={`flex flex-col items-center justify-center px-4 py-3 transition-colors ${
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
            className='flex flex-col items-center justify-center px-4 py-3 hover:bg-white/5 transition-colors cursor-pointer'
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

          {/* ── Stamp balance ── */}
          <button
            onClick={onStampTap}
            className='flex flex-col items-center justify-center px-4 py-3 hover:bg-white/5 transition-colors cursor-pointer'
          >
            <div className='w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center mb-0.5'>
              <PostalPeekStampSVG className='w-4 h-4 text-amber-400' />
            </div>
            <motion.span
              key={stampBalance}
              initial={{
                scale: stampBalance === 0 ? 1 : 1.4,
                color: stampBalance === 0 ? 'rgba(255,255,255,0.5)' : '#fbbf24',
              }}
              animate={{ scale: 1, color: 'rgba(255,255,255,0.5)' }}
              transition={{ type: 'spring', stiffness: 400, damping: 20 }}
              className='text-[9px] font-semibold uppercase tracking-wider'
            >
              <span className='text-white/70'>{stampBalance}</span>{' '}
              {t({ es: 'sellos', en: 'stamps' }, lang)}
            </motion.span>
          </button>
        </div>
      </div>
    </motion.div>
  );
}

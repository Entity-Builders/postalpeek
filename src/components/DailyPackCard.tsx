import React, { useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Trophy } from 'lucide-react';
import type { FeedItem } from './Postcard';
import { Postcard } from './Postcard';
import { useSignedImage } from '../utils/useSignedImage';
import { WIDTHS } from '../utils/imageUtils';
import type { User } from '@supabase/supabase-js';
import { analytics } from '../lib/analytics';

interface DailyPackCardProps {
  item: FeedItem;
  cardIndex: number;
  totalCards: number;
  isActive: boolean;
  isRevealed: boolean;
  onReveal: () => void;
  /** Album euphoria */
  isInAlbum: boolean;
  /** Full Postcard props */
  user: User | null;
  isAdmin: boolean;
  favoriteIds: Set<string>;
  toggleFavorite: (id: string) => void;
  claimedIds: Set<string>;
  onClaimPostcard?: (postcardId: string) => void;
  isClaimLoading: boolean;
  albumPostcardIds: Set<string>;
  setShowAuthGate: (val: boolean) => void;
  setPendingFavoriteId: (id: string | null) => void;
}

export function DailyPackCard({
  item,
  cardIndex,
  totalCards,
  isActive,
  isRevealed,
  onReveal,
  isInAlbum,
  user,
  isAdmin,
  favoriteIds,
  toggleFavorite,
  claimedIds,
  onClaimPostcard,
  isClaimLoading,
  albumPostcardIds,
  setShowAuthGate,
  setPendingFavoriteId,
}: DailyPackCardProps) {

  // Pre-load a blurred version for the cover
  const blurUrl = useSignedImage(item.illustration_url, {
    width: WIDTHS.mobile, // Need enough resolution for blurring to look good
    quality: 60,
  });

  const handleReveal = useCallback(() => {
    if (isRevealed) return;
    onReveal();
    analytics.track('daily_pack_card_revealed', {
      postcard_id: item.id,
      card_index: cardIndex,
      is_album_card: isInAlbum,
      country: item.country,
      city: item.city,
    });
  }, [isRevealed, onReveal, item, cardIndex, isInAlbum]);

  return (
    <div className='w-full h-full flex flex-col items-center justify-center'>
      {/* Pack counter badge */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className='mb-3 text-center z-20'
      >
        <div className='inline-flex items-center gap-2 bg-black/40 backdrop-blur-md text-white/90 px-3 py-1.5 rounded-full text-xs font-medium border border-white/10 shadow-lg'>
          <Sparkles className='w-3.5 h-3.5 text-amber-300' />
          <span>Sobre Diario · Postal {cardIndex + 1} de {totalCards}</span>
          <Sparkles className='w-3.5 h-3.5 text-amber-300' />
        </div>
      </motion.div>

      {/* Card container with optional album glow */}
      <div
        className='relative w-[95vw] max-w-[480px] md:max-w-[520px] mx-auto'
        style={{ aspectRatio: '4/5' }}
      >
        {/* Album euphoria: animated golden glow ring */}
        {isInAlbum && (
          <div className='absolute -inset-1.5 z-0 rounded-[14px] overflow-hidden pointer-events-none'>
            <div
              className='absolute inset-0 rounded-[14px]'
              style={{
                background: 'linear-gradient(135deg, #f59e0b, #ef4444, #f59e0b, #eab308, #f59e0b)',
                backgroundSize: '400% 400%',
                animation: 'albumGlow 3s ease-in-out infinite',
              }}
            />
            <style>{`
              @keyframes albumGlow {
                0%, 100% { background-position: 0% 50%; }
                50% { background-position: 100% 50%; }
              }
            `}</style>
          </div>
        )}

        {/* Album badge */}
        {isInAlbum && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.4, type: 'spring', stiffness: 300, damping: 20 }}
            className='absolute -top-3 left-1/2 -translate-x-1/2 z-30'
          >
            <div className='flex items-center gap-1.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg border border-amber-300/30'>
              <Trophy className='w-3.5 h-3.5' />
              <span>¡Carta de Álbum!</span>
            </div>
          </motion.div>
        )}

        {/* The actual card area */}
        <div
          className='relative w-full h-full bg-white overflow-hidden z-10'
          style={{
            boxShadow: '0 8px 30px rgba(0,0,0,0.12), inset 0 0 0 1px rgba(0,0,0,0.05)',
            padding: '8px 8px 32px 8px',
            borderRadius: '12px',
          }}
        >
          <AnimatePresence mode='wait'>
            {!isRevealed ? (
              /* ─── UNREVEALED: Blurred cover ─── */
              <motion.button
                key='cover'
                className='w-full h-full rounded-md overflow-hidden relative cursor-pointer'
                onClick={handleReveal}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3 }}
              >
                {/* The actual image, heavily blurred */}
                {blurUrl && (
                  <img
                    src={blurUrl}
                    alt=''
                    className='absolute inset-0 w-full h-full object-cover'
                    style={{
                      filter: 'blur(28px) saturate(1.3) brightness(0.85)',
                      transform: 'scale(1.15)', // prevent blur edges showing
                    }}
                    loading='eager'
                    draggable={false}
                  />
                )}

                {/* Overlay gradient */}
                <div className='absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/30 z-10' />

                {/* Tap to reveal CTA */}
                <div className='absolute inset-0 z-20 flex flex-col items-center justify-center gap-3'>
                  <motion.div
                    animate={{ scale: [1, 1.15, 1], opacity: [0.8, 1, 0.8] }}
                    transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                    className='w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30 shadow-lg'
                  >
                    <Sparkles className='w-8 h-8 text-white drop-shadow-md' />
                  </motion.div>
                  <span className='text-white font-semibold text-base drop-shadow-md tracking-wide'>
                    Toca para revelar
                  </span>
                  <span className='text-white/60 text-sm'>
                    Postal #{cardIndex + 1}
                  </span>
                </div>

                {/* Shimmer sweep animation */}
                <div className='absolute inset-0 z-10 pointer-events-none overflow-hidden'>
                  <div
                    className='absolute w-[200%] h-full -left-full'
                    style={{
                      background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.15) 50%, transparent 100%)',
                      animation: 'shimmerSweep 3s ease-in-out infinite',
                    }}
                  />
                  <style>{`
                    @keyframes shimmerSweep {
                      0% { transform: translateX(-50%); }
                      100% { transform: translateX(100%); }
                    }
                  `}</style>
                </div>
              </motion.button>
            ) : (
              /* ─── REVEALED: Full Postcard component ─── */
              <motion.div
                key='revealed'
                className='w-full h-full'
                initial={{ opacity: 0, scale: 1.02 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              >
                <Postcard
                  item={item}
                  isActive={isActive}
                  isAdmin={isAdmin}
                  isPriority={true}
                  favoriteIds={favoriteIds}
                  onToggleFavorite={user ? toggleFavorite : undefined}
                  isClaimedByMe={claimedIds.has(item.id)}
                  isClaimed={!!item.owner_id}
                  onClaimPostcard={user ? onClaimPostcard : undefined}
                  isClaimLoading={isClaimLoading}
                  isInAlbum={albumPostcardIds.has(item.id)}
                  onAuthRequired={
                    !user
                      ? (postcardId) => {
                          setPendingFavoriteId(postcardId);
                          setShowAuthGate(true);
                        }
                      : undefined
                  }
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

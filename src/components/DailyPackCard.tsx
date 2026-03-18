import React, { useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Trophy } from 'lucide-react';
import type { FeedItem } from './Postcard';
import { Postcard } from './Postcard';
import type { User } from '@supabase/supabase-js';
import { analytics } from '../lib/analytics';

export type RevealMode = 'tap' | 'auto-scroll' | 'cascade';

interface DailyPackCardProps {
  item: FeedItem;
  cardIndex: number;
  totalCards: number;
  isActive: boolean;
  isRevealed: boolean;
  onReveal: () => void;
  /** Reveal UX variant */
  revealMode: RevealMode;
  /** Delay in ms before auto-revealing (cascade mode only) */
  cascadeDelay?: number;
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
  revealMode,
  cascadeDelay = 0,
  isInAlbum,
  user,
  isAdmin,
  favoriteIds,
  toggleFavorite,
  claimedIds,
  isClaimLoading,
  albumPostcardIds,
  setShowAuthGate,
  setPendingFavoriteId,
}: DailyPackCardProps) {

  // Auto-scroll mode: reveal when slide becomes active
  useEffect(() => {
    if (revealMode === 'auto-scroll' && isActive && !isRevealed) {
      onReveal();
    }
  }, [revealMode, isActive, isRevealed, onReveal]);

  // Cascade mode: reveal after a stagger delay
  useEffect(() => {
    if (revealMode === 'cascade' && !isRevealed) {
      const timer = setTimeout(() => onReveal(), cascadeDelay);
      return () => clearTimeout(timer);
    }
  }, [revealMode, isRevealed, onReveal, cascadeDelay]);

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
          {/* Always render the real Postcard — when unrevealed it's blurred via CSS */}
          <motion.div
            className='w-full h-full [&>div]:!opacity-100'
            animate={{
              filter: isRevealed ? 'blur(0px)' : 'blur(16px)',
              scale: isRevealed ? 1 : 1.08,
            }}
            initial={{ filter: 'blur(16px)', scale: 1.08 }}
            transition={{ type: 'spring', stiffness: 200, damping: 18, mass: 0.8 }}
            style={{ pointerEvents: isRevealed ? 'auto' : 'none', overflow: 'hidden' }}
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
              onClaimPostcard={undefined}
              isClaimLoading={isClaimLoading}
              isInAlbum={albumPostcardIds.has(item.id)}
              hideActions={true}
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

          {/* Tap-to-reveal overlay — only visible in tap mode when unrevealed */}
          <AnimatePresence>
            {!isRevealed && revealMode === 'tap' && (
              <motion.button
                key='reveal-overlay'
                className='absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 cursor-pointer rounded-md'
                onClick={handleReveal}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4 }}
              >
                {/* Subtle dark overlay for text contrast */}
                <div className='absolute inset-0 bg-black/10 rounded-md' />

                {/* Sparkle icon */}
                <motion.div
                  animate={{ scale: [1, 1.15, 1], opacity: [0.8, 1, 0.8] }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                  className='relative w-16 h-16 rounded-full bg-white/25 backdrop-blur-sm flex items-center justify-center border border-white/40 shadow-lg'
                >
                  <Sparkles className='w-8 h-8 text-white drop-shadow-md' />
                </motion.div>
                <span className='relative text-white font-semibold text-base drop-shadow-lg tracking-wide'>
                  Toca para revelar
                </span>
                <span className='relative text-white/70 text-sm drop-shadow'>
                  Postal #{cardIndex + 1}
                </span>

                {/* Shimmer sweep */}
                <div className='absolute inset-0 pointer-events-none overflow-hidden rounded-md'>
                  <div
                    className='absolute w-[200%] h-full -left-full'
                    style={{
                      background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.12) 50%, transparent 100%)',
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
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

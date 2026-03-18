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

  // Cascade mode: first card (index 0) requires tap; rest auto-reveal with stagger
  useEffect(() => {
    if (revealMode === 'cascade' && !isRevealed && cardIndex > 0) {
      const timer = setTimeout(() => onReveal(), cascadeDelay);
      return () => clearTimeout(timer);
    }
  }, [revealMode, isRevealed, onReveal, cascadeDelay, cardIndex]);

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
      {/* Card container with pack border */}
      <div
        className='relative w-[95vw] max-w-[480px] md:max-w-[520px] mx-auto'
        style={{ aspectRatio: '4/5' }}
      >
        {/* Pack card border — animated dark frame */}
        <div className='absolute -inset-1.5 z-0 rounded-[14px] overflow-hidden pointer-events-none'>
          <div
            className='absolute inset-0 rounded-[14px]'
            style={{
              background: 'linear-gradient(135deg, #1c1917, #44403c, #1c1917, #57534e, #1c1917)',
              backgroundSize: '400% 400%',
              animation: 'packBorder 4s ease-in-out infinite',
            }}
          />
          <style>{`
            @keyframes packBorder {
              0%, 100% { background-position: 0% 50%; }
              50% { background-position: 100% 50%; }
            }
          `}</style>
        </div>

        {/* Tab badge — fused with top-left corner of the border */}
        <motion.div
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 300, damping: 25 }}
          className='absolute -top-1.5 left-2 z-20'
        >
          <div className='flex items-center gap-1.5 bg-stone-900 text-white/90 pl-2.5 pr-3 py-1 rounded-b-lg text-[11px] font-medium shadow-md'>
            <Sparkles className='w-3 h-3 text-amber-400' />
            <span>Sobre Diario · {cardIndex + 1}/{totalCards}</span>
          </div>
        </motion.div>

        {/* Album badge with neon amber glow */}
        {isInAlbum && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.4, type: 'spring', stiffness: 300, damping: 20 }}
            className='absolute -top-3 left-1/2 -translate-x-1/2 z-30'
          >
            <div className='relative'>
              {/* Amber neon glow */}
              <motion.div
                className='absolute inset-0 rounded-full'
                style={{
                  background: 'linear-gradient(90deg, #f59e0b, #ef4444, #f59e0b)',
                  backgroundSize: '200% 100%',
                  filter: 'blur(10px)',
                }}
                animate={{
                  backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
                  opacity: [0.6, 1, 0.6],
                  scale: [1, 1.1, 1],
                }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              />
              <div className='relative flex items-center gap-1.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg border border-amber-300/30'>
                <Trophy className='w-3.5 h-3.5' />
                <span>¡Carta de Álbum!</span>
              </div>
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

          {/* Tap-to-reveal overlay — visible for tap mode + first card in cascade */}
          <AnimatePresence>
            {!isRevealed && (revealMode === 'tap' || (revealMode === 'cascade' && cardIndex === 0)) && (
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

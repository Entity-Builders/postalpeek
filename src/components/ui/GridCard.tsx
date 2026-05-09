import { CircleUserRound } from 'lucide-react';
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { FeedItem } from '../Postcard';
import type { User } from '@supabase/supabase-js';
import { WIDTHS } from '../../utils/imageUtils';
import { useSignedImage, useSignedSrcSet } from '../../utils/useSignedImage';
import { t, useLang } from '../../utils/i18n';
import { RarityBadge } from './RarityBadge';
import { PostcardChin } from './PostcardChin';
import { PostcardBack } from '../PostcardBack';

import type { CardLayout } from './cardLayout';

/* ──────────────────────────────────────────────────────────────────
   Grid Card — postcard-style with white frame & chin
   ────────────────────────────────────────────────────────────────── */

interface GridCardProps {
  item: FeedItem;
  index: number;
  layout: CardLayout;
  onClick: () => void;
  isClaimedByMe?: boolean;
  viewMode?: 'grid' | 'feed';
  onClaimPostcard?: (id: string, rarity: 'common' | 'rare' | 'epic' | 'legendary') => void;
  user?: User | null;
}

/** Above-fold cards get framer-motion entry animation; below-fold cards render instantly */
const ANIMATE_THRESHOLD = 12;

export const GridCard = React.memo(function GridCard({
  item,
  index,
  layout,
  onClick,
  isClaimedByMe,
  onClaimPostcard,
  user,
}: GridCardProps) {
  const hasOwner = !!item.owner_id || !!isClaimedByMe;
  const imgUrl = useSignedImage(item.illustration_url, { width: WIDTHS.grid });
  const srcSet = useSignedSrcSet(
    item.illustration_url,
    WIDTHS.gridSrcSet as unknown as number[],
  );
  const placeholderUrl = useSignedImage(item.illustration_url, {
    width: WIDTHS.blur,
    quality: 15,
  });

  const avatarUrl = user?.user_metadata?.avatar_url;
  const name = user?.user_metadata?.name || user?.user_metadata?.full_name || user?.email?.split('@')[0];
  const initial = typeof name === 'string' && name.length > 0 ? name.charAt(0).toUpperCase() : '?';

  const [loaded, setLoaded] = React.useState(false);
  const lang = useLang();

  const [isFlipped, setIsFlipped] = React.useState(false);

  // Polaroid url for the back of the card (disabled in grid mode to save data)
  const polaroidUrl = '';

  const categoryLabel =
    typeof item.category === 'string' ? item.category : t(item.category, lang);

  const { aspectRatio, monumental } = layout;

  /* Masonry breakpoints → column widths (approx):
     5 cols @ ≥1536 ≈ 20vw,  4 cols @ ≥1280 ≈ 25vw,
     3 cols @ ≥1024 ≈ 33vw,  2 cols @ ≥640  ≈ 50vw */
  const sizes = '(min-width:1024px) 33vw, 50vw';

  // ── Scroll-vs-tap detection ───────────────────────────────────────
  const DRAG_THRESHOLD = 8;
  const touchStartRef = React.useRef<{ x: number; y: number } | null>(null);
  const wasDragRef = React.useRef(false);
  const preventClickUntilRef = React.useRef(0);

  const handleTouchStart = React.useCallback((e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStartRef.current = { x: t.clientX, y: t.clientY };
    wasDragRef.current = false;
  }, []);

  const handleTouchMove = React.useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const t = e.touches[0];
    const dx = Math.abs(t.clientX - touchStartRef.current.x);
    const dy = Math.abs(t.clientY - touchStartRef.current.y);
    if (dx > DRAG_THRESHOLD || dy > DRAG_THRESHOLD) {
      wasDragRef.current = true;
    }
  }, []);

  const handleTouchEnd = React.useCallback(() => {
    if (wasDragRef.current) {
      preventClickUntilRef.current = Date.now() + 400;
    }
  }, []);

  const handleClick = React.useCallback(() => {
    if (wasDragRef.current) return;
    if (Date.now() < preventClickUntilRef.current) return;
    onClick();
  }, [onClick]);

  const Wrapper = index < ANIMATE_THRESHOLD ? motion.div : 'div';
  const animProps =
    index < ANIMATE_THRESHOLD
      ? {
          initial: { opacity: 0, y: 16 },
          animate: { opacity: 1, y: 0 },
          transition: {
            duration: 0.35,
            delay: Math.min(index * 0.04, 0.6),
            ease: 'easeOut' as const,
          },
        }
      : {};

  return (
    <Wrapper
      className='relative cursor-pointer group'
      style={{ display: 'inline-block', width: '100%', perspective: '1000px', WebkitPerspective: '1000px' }}
      onClick={handleClick}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      {...animProps}
    >
      <motion.div
        className="w-full h-full relative"
        style={{ transformStyle: 'preserve-3d', WebkitTransformStyle: 'preserve-3d' }}
        animate={{ rotateY: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 28, duration: 0.1 }}
      >
        {/* ── Postcard frame (Front) ── */}
        <div
          className={`relative overflow-hidden rounded-lg bg-white
            transition-shadow duration-200 group-hover:shadow-[0_6px_24px_rgba(0,0,0,0.18)]
            ${
              monumental
                ? 'shadow-[0_2px_16px_rgba(180,130,50,0.25)] ring-1 ring-amber-400/30'
                : 'shadow-[0_2px_12px_rgba(0,0,0,0.10)]'
            }`}
          style={{
            padding: '5px 5px 0 5px',
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            transform: 'translateZ(1px)',
            WebkitTransform: 'translateZ(1px)',
          }}
        >
          {/* ── Image area ── */}
          <div
            className='relative w-full overflow-hidden rounded-sm bg-stone-200'
            style={{ aspectRatio }}
          >
            {placeholderUrl && !loaded && (
              <img
                src={placeholderUrl}
                alt=''
                aria-hidden
                className='absolute inset-0 w-full h-full object-cover blur-md scale-105'
              />
            )}

            {imgUrl && (
              <img
                src={imgUrl}
                srcSet={srcSet || undefined}
                sizes={sizes}
                alt={categoryLabel}
                className={`absolute inset-0 w-full h-full object-cover block transition-all duration-700 ${loaded ? 'opacity-100' : 'opacity-0'}`}
                onLoad={() => setLoaded(true)}
                loading={index < 12 ? 'eager' : 'lazy'}
              />
            )}

            <div
              className='absolute bottom-0 left-0 right-0 px-2.5 pt-6 pb-2
              bg-gradient-to-t from-black/35 via-black/10 to-transparent pointer-events-none'
            />


            {/* Owner / creator badge */}
            <AnimatePresence>
              {isClaimedByMe && user ? (
                <motion.div
                  key="owned"
                  initial={{ opacity: 0, scale: 0.8, y: -6 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ duration: 0.2, type: 'spring', stiffness: 400, damping: 25 }}
                  className='absolute top-1.5 left-1.5 flex items-center gap-1.5 bg-black/50 backdrop-blur-md text-white/90 text-[10px] font-semibold pr-2 pl-1.5 py-1 rounded-full pointer-events-none z-20 border border-white/10 shadow-md'
                >
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="" className="w-4 h-4 rounded-full object-cover" />
                  ) : (
                    <div className="w-4 h-4 shadow-inner rounded-full bg-amber-500 flex items-center justify-center text-[9px] text-white">
                      {initial}
                    </div>
                  )}
                  <span className="truncate max-w-[80px]">{name}</span>
                </motion.div>
              ) : item.creator_name ? (
                <motion.div
                  key="creator"
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className='absolute top-1.5 left-1.5 flex items-center gap-1 bg-black/40 backdrop-blur-sm text-white/80 text-[10px] font-semibold px-2 py-1 rounded-full pointer-events-none z-20'
                >
                  <CircleUserRound className='w-3 h-3 opacity-60' />
                  <span className="truncate max-w-[80px]">@{item.creator_name}</span>
                </motion.div>
              ) : null}
            </AnimatePresence>

            {item.rarity && <RarityBadge rarity={item.rarity} variant='grid' />}
          </div>
          <PostcardChin
            item={item}
            hasOwner={hasOwner}
            isClaimedByMe={isClaimedByMe}
            isTriviaLocked={!hasOwner && !!item.generation_metadata?.trivia}
            onClick={onClick}
            onClaim={onClaimPostcard ? (rarity) => onClaimPostcard(item.id, rarity) : undefined}
          />
        </div>

        {/* ── Postcard Back ── */}
        <PostcardBack
          item={item}
          polaroidUrl={polaroidUrl}
          handleImageError={() => {}}
          isActive={false}
          isGridMode={true}
          isClaimedByMe={isClaimedByMe}
          onClaimPostcard={onClaimPostcard}
        />
      </motion.div>
    </Wrapper>
  );
});

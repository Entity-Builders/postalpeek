import React from 'react';
import { motion } from 'framer-motion';
import type { FeedItem } from '../Postcard';
import { WIDTHS } from '../../utils/imageUtils';
import { useSignedImage, useSignedSrcSet } from '../../utils/useSignedImage';
import { t, useLang } from '../../utils/i18n';
import { RarityBadge } from './RarityBadge';
import { PostcardChin } from './PostcardChin';

import type { CardLayout } from './cardLayout';

/* ──────────────────────────────────────────────────────────────────
   Grid Card — postcard-style with white frame & chin
   ────────────────────────────────────────────────────────────────── */

interface GridCardProps {
  item: FeedItem;
  index: number;
  layout: CardLayout;
  onClick: () => void;
  isClaimed?: boolean;
  viewMode?: 'grid' | 'feed';
}

/** Above-fold cards get framer-motion entry animation; below-fold cards render instantly */
const ANIMATE_THRESHOLD = 12;

export const GridCard = React.memo(function GridCard({ item, index, layout, onClick, isClaimed }: GridCardProps) {
  const imgUrl = useSignedImage(item.illustration_url, { width: WIDTHS.grid });
  const srcSet = useSignedSrcSet(item.illustration_url, WIDTHS.gridSrcSet as unknown as number[]);
  const placeholderUrl = useSignedImage(item.illustration_url, { width: WIDTHS.blur, quality: 15 });

  const [loaded, setLoaded] = React.useState(false);
  const lang = useLang();

  const categoryLabel = typeof item.category === 'string' ? item.category : t(item.category, lang);

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
  const animProps = index < ANIMATE_THRESHOLD
    ? {
        initial: { opacity: 0, y: 16 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.35, delay: Math.min(index * 0.04, 0.6), ease: 'easeOut' as const },
      }
    : {};

  return (
    <Wrapper
      className="relative cursor-pointer group"
      style={{ display: 'inline-block', width: '100%' }}
      onClick={handleClick}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      {...animProps}
    >
      {/* ── Postcard frame ── */}
      <div
        className={`relative overflow-hidden rounded-lg bg-white
          transition-shadow duration-200 group-hover:shadow-[0_6px_24px_rgba(0,0,0,0.18)]
          ${monumental
            ? 'shadow-[0_2px_16px_rgba(180,130,50,0.25)] ring-1 ring-amber-400/30'
            : 'shadow-[0_2px_12px_rgba(0,0,0,0.10)]'
          }`}
        style={{
          padding: '5px 5px 0 5px',
        }}
      >
        {/* ── Image area ── */}
        <div
          className="relative w-full overflow-hidden rounded-sm bg-stone-200"
          style={{ aspectRatio }}
        >
          {placeholderUrl && !loaded && (
            <img
              src={placeholderUrl}
              alt=""
              aria-hidden
              className="absolute inset-0 w-full h-full object-cover blur-md scale-105"
            />
          )}

          {imgUrl && (
            <img
              src={imgUrl}
              srcSet={srcSet || undefined}
              sizes={sizes}
              alt={categoryLabel}
              className={`absolute inset-0 w-full h-full object-cover block transition-all duration-500 ${loaded ? 'opacity-100' : 'opacity-0'}`}
              onLoad={() => setLoaded(true)}
              loading={index < 12 ? 'eager' : 'lazy'}
            />
          )}

          <div className="absolute bottom-0 left-0 right-0 px-2.5 pt-6 pb-2
            bg-gradient-to-t from-black/35 via-black/10 to-transparent pointer-events-none" />

          {item.rarity && <RarityBadge rarity={item.rarity} variant='grid' />}
        </div>
        {/* ── PostcardChin — unified chin (storytelling + city + actions) ── */}
        <PostcardChin
          item={item}
          isClaimed={isClaimed}
          isTriviaLocked={!isClaimed && !!item.generation_metadata?.trivia}
          onClick={onClick}
        />
      </div>
    </Wrapper>
  );
});

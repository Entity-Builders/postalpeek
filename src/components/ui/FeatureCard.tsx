import React from 'react';
import { motion } from 'framer-motion';
import type { FeedItem } from '../Postcard';
import { WIDTHS } from '../../utils/imageUtils';
import { useSignedImage, useSignedSrcSet } from '../../utils/useSignedImage';
import { t } from '../../utils/i18n';
import { RarityBadge } from './RarityBadge';
import { CityLabel } from './CityLabel';

/* ──────────────────────────────────────────────────────────────────
   Feature Card — full-width panoramic card for monumental postcards
   ────────────────────────────────────────────────────────────────── */

interface FeatureCardProps {
  item: FeedItem;
  index: number;
  onClick: () => void;
}

/** Above-fold feature cards get entry animation */
const ANIMATE_THRESHOLD = 4;

export const FeatureCard = React.memo(function FeatureCard({ item, index, onClick }: FeatureCardProps) {
  const imgUrl = useSignedImage(item.illustration_url, { width: WIDTHS.desktop });
  const srcSet = useSignedSrcSet(item.illustration_url, [WIDTHS.mobile, WIDTHS.tablet, WIDTHS.desktop]);
  const placeholderUrl = useSignedImage(item.illustration_url, { width: WIDTHS.blur, quality: 15 });

  const [loaded, setLoaded] = React.useState(false);

  const categoryLabel = typeof item.category === 'string' ? item.category : t(item.category);

  /* Responsive sizes — full-width card */
  const sizes = '(min-width:1280px) 80vw, 95vw';

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
        initial: { opacity: 0, y: 20 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.45, delay: 0.1, ease: 'easeOut' as const },
      }
    : {};

  return (
    <Wrapper
      className="relative cursor-pointer group w-full"
      onClick={handleClick}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      {...animProps}
    >
      <div
        className="relative overflow-hidden rounded-2xl bg-stone-200
          shadow-[0_2px_12px_rgba(0,0,0,0.12)]
          transition-shadow duration-200 group-hover:shadow-[0_6px_28px_rgba(0,0,0,0.25)]"
      >
        <div
          className="relative w-full overflow-hidden"
          style={{ aspectRatio: '21/9' }}
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
              className={`w-full h-full object-cover block transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
              onLoad={() => setLoaded(true)}
              loading="lazy"
            />
          )}

          {/* Panoramic gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/30 via-transparent to-transparent" />

          {/* City + Category label */}
          <div className="absolute bottom-0 left-0 right-0 px-4 pb-3 md:px-6 md:pb-4 flex items-end justify-between">
            <div className="flex flex-col gap-0.5">
              <p className="text-white/80 text-[10px] md:text-xs font-semibold uppercase tracking-wider">
                {categoryLabel}
              </p>
              <CityLabel city={item.city} variant='scrim' />
            </div>
          </div>

          {item.rarity && <RarityBadge rarity={item.rarity} variant='grid' />}
        </div>
      </div>
    </Wrapper>
  );
});

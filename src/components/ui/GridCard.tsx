import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import type { FeedItem } from '../Postcard';
import { WIDTHS } from '../../utils/imageUtils';
import { useSignedImage, useSignedSrcSet } from '../../utils/useSignedImage';
import { t, useLang } from '../../utils/i18n';
import { RarityBadge } from './RarityBadge';

/* ── Storytelling fact helpers (shared with StorytellingPreview) ── */
const FACT_EMOJI: Record<string, string> = {
  historical: '🏛️', architectural: '🏗️', cultural: '🎭',
  gastronomic: '🍽️', natural: '🌿', artistic: '🎨',
};

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
  const storytelling = item.generation_metadata?.storytelling;
  const trivia = item.generation_metadata?.trivia;
  const isTriviaLocked = !!trivia && !isClaimed;

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
            <>
              <img
                src={imgUrl}
                srcSet={srcSet || undefined}
                sizes={sizes}
                alt={categoryLabel}
                className={`absolute inset-0 w-full h-full object-cover block transition-all duration-500 ${loaded ? 'opacity-100' : 'opacity-0'} ${isTriviaLocked ? 'blur-md scale-110 saturate-50 brightness-90' : ''}`}
                onLoad={() => setLoaded(true)}
                loading={index < 12 ? 'eager' : 'lazy'}
              />
              {isTriviaLocked && loaded && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/10">
                  <div className="bg-stone-900/60 backdrop-blur-md rounded-full w-12 h-12 flex items-center justify-center border border-white/20 shadow-2xl">
                    <span className="text-xl" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }}>✨</span>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Storytelling overlay — prominent while loading, fades out on load */}
          <AnimatePresence>
            {storytelling && !loaded && (
              <motion.div
                key="storytelling-loading"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.3 }}
                className="absolute inset-0 z-20 flex flex-col justify-end p-3 pointer-events-none"
              >
                <div className="bg-black/50 backdrop-blur-sm rounded-lg px-3 py-2 border border-white/10">
                  <span className="inline-block text-[9px] font-bold text-amber-300 uppercase tracking-wider mb-0.5">
                    {FACT_EMOJI[storytelling.fact_type] || '📖'}{' '}
                    {storytelling.fact_type || t({ es: 'Dato', en: 'Fact' }, lang)}
                  </span>
                  <p className="text-[10px] text-white/90 leading-snug line-clamp-2">
                    💡 {t(storytelling.did_you_know, lang)}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Persistent storytelling badge — small emoji after load */}
          {storytelling && loaded && (
            <div className="absolute top-1.5 left-1.5 z-20">
              <span className="bg-black/40 backdrop-blur-sm text-[10px] px-1.5 py-0.5 rounded-full border border-white/15 shadow-sm"
                title={t({ es: 'Tiene dato curioso', en: 'Has fun fact' }, lang)}
              >
                {FACT_EMOJI[storytelling.fact_type] || '📖'}
              </span>
            </div>
          )}

          <div className="absolute bottom-0 left-0 right-0 px-2.5 pt-6 pb-2
            bg-gradient-to-t from-black/35 via-black/10 to-transparent pointer-events-none" />

          {item.rarity && <RarityBadge rarity={item.rarity} variant='grid' />}
        </div>

        {/* ── Postcard chin — city name + CTA ── */}
        <div className="flex items-center justify-between px-1.5 py-2 min-h-[28px]">
          {isTriviaLocked ? (
            <span className="flex items-center gap-1 text-[10px] font-semibold text-violet-600">
              <Sparkles className="w-3 h-3 animate-pulse" />
              {t({ es: 'Descubrirla', en: 'Discover it' })}
            </span>
          ) : (
            <p className="text-stone-500 text-[10px] font-medium leading-tight truncate">
              {item.city}
            </p>
          )}
          {!isTriviaLocked && !isClaimed && (
            <Sparkles className="w-3 h-3 text-violet-400 opacity-60 animate-pulse flex-shrink-0" />
          )}
        </div>
      </div>
    </Wrapper>
  );
});

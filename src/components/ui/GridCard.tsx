import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { FeedItem } from '../Postcard';
import { WIDTHS } from '../../utils/imageUtils';
import { useSignedImage, useSignedSrcSet } from '../../utils/useSignedImage';
import { t } from '../../utils/i18n';
import { RarityBadge } from './RarityBadge';
import { CityLabel } from './CityLabel';

/* ── Storytelling fact helpers (shared with StorytellingPreview) ── */
const FACT_EMOJI: Record<string, string> = {
  historical: '🏛️', architectural: '🏗️', cultural: '🎭',
  gastronomic: '🍽️', natural: '🌿', artistic: '🎨',
};

/* ──────────────────────────────────────────────────────────────────
   Layout helpers — computed once and cached
   ────────────────────────────────────────────────────────────────── */

export interface CardLayout {
  aspectRatio: string;
  showCaption: boolean;
}

/** Deterministic hash → 0-1 float from a string */
function hashToFloat(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h % 1000) / 1000;
}

/** Aspect-ratio buckets for Pinterest-style height variation */
const ASPECT_RATIOS = [
  '3/4',   // tall
  '4/5',   // medium-tall
  '1/1',   // square
  '5/4',   // slightly wide
  '2/3',   // tallest
] as const;

/** Normalize a category object/string into a searchable lowercase string */
function normCategory(catObj: string | { en?: string; es?: string } | undefined): string {
  let category = '';
  if (typeof catObj === 'string') {
    category = catObj.toLowerCase();
  } else if (catObj) {
    category = [catObj.en, catObj.es].filter(Boolean).join(' ').toLowerCase();
  }
  return category.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/** Scene types that qualify a postcard as "monumental" (full-width in grid) */
const MONUMENTAL_SCENE_TYPES = new Set([
  'historic_center', 'plaza', 'monument', 'landmark',
  'cathedral', 'church', 'palace', 'temple', 'castle',
]);

/** Category keywords that qualify a postcard as "monumental" */
const MONUMENTAL_KEYWORDS = [
  'monument', 'landmark', 'architecture', 'arquitectura',
  'historical', 'historico', 'iglesia', 'church',
  'cathedral', 'catedral', 'palace', 'palacio',
  'temple', 'templo', 'castle', 'castillo',
  'basilica', 'basilica', 'centro historico', 'historic center',
];

/** Returns true if this postcard should display as a full-width feature card */
export function isMonumentalCard(item: FeedItem): boolean {
  // Check scene_type
  const scene = (item.scene_type || '').toLowerCase().trim();
  if (MONUMENTAL_SCENE_TYPES.has(scene)) return true;

  // Check rarity
  if (item.rarity === 'legendary' || item.rarity === 'epic') return true;

  // Check category keywords
  const catNorm = normCategory(item.category);
  return MONUMENTAL_KEYWORDS.some(kw => catNorm.includes(kw));
}

/** Precalculate layout for a single item (pure, no side effects) */
export function computeCardLayout(itemOrId: FeedItem | string): CardLayout {
  const isItem = typeof itemOrId !== 'string';
  const id = isItem ? itemOrId.id : itemOrId;
  const h = hashToFloat(id);
  
  let aspectRatio = ASPECT_RATIOS[Math.floor(h * ASPECT_RATIOS.length)];
  let showCaption = h > 0.45;

  if (isItem) {
    const categoryNorm = normCategory(itemOrId.category);
    
    // Important = square card, always show caption
    const isImportant = isMonumentalCard(itemOrId);

    const isBasic = 
      itemOrId.rarity === 'common' || 
      categoryNorm.includes('street') || 
      categoryNorm.includes('calle') ||
      categoryNorm.includes('object') ||
      categoryNorm.includes('objeto') ||
      categoryNorm.includes('everyday') ||
      categoryNorm.includes('cotidiano') ||
      categoryNorm.includes('vida');

    if (isImportant) {
      aspectRatio = '1/1';
      showCaption = true;
    } else if (isBasic) {
      const shortRatios = ['1/1', '5/4', '4/5'] as const;
      aspectRatio = shortRatios[Math.floor(h * shortRatios.length)];
      showCaption = h > 0.7;
    }
  }

  return { aspectRatio, showCaption };
}

/* ──────────────────────────────────────────────────────────────────
   Grid Card — memoized, with precalculated layout
   ────────────────────────────────────────────────────────────────── */

interface GridCardProps {
  item: FeedItem;
  index: number;
  layout: CardLayout;
  onClick: () => void;
}

/** Above-fold cards get framer-motion entry animation; below-fold cards render instantly */
const ANIMATE_THRESHOLD = 12;

export const GridCard = React.memo(function GridCard({ item, index, layout, onClick }: GridCardProps) {
  const imgUrl = useSignedImage(item.illustration_url, { width: WIDTHS.grid });
  const srcSet = useSignedSrcSet(item.illustration_url, WIDTHS.gridSrcSet as unknown as number[]);
  const placeholderUrl = useSignedImage(item.illustration_url, { width: WIDTHS.blur, quality: 15 });

  const [loaded, setLoaded] = React.useState(false);

  const categoryLabel = typeof item.category === 'string' ? item.category : t(item.category);
  const storytelling = item.generation_metadata?.storytelling;

  const { aspectRatio, showCaption } = layout;

  /* Masonry breakpoints → column widths (approx):
     5 cols @ ≥1536 ≈ 20vw,  4 cols @ ≥1280 ≈ 25vw,
     3 cols @ ≥1024 ≈ 33vw,  2 cols @ ≥640  ≈ 50vw */
  const sizes = '(min-width:1536px) 20vw, (min-width:1280px) 25vw, (min-width:1024px) 33vw, 50vw';

  // ── Scroll-vs-tap detection ───────────────────────────────────────
  // Distance threshold: if the finger moves more than this many px, it's a drag.
  const DRAG_THRESHOLD = 8;
  const touchStartRef = React.useRef<{ x: number; y: number } | null>(null);
  const wasDragRef = React.useRef(false);
  // Timestamp until which click events should be suppressed (covers edge cases
  // where the browser fires a synthetic click AFTER touchend).
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
      // Block any synthetic click the browser might fire for the next 400ms
      preventClickUntilRef.current = Date.now() + 400;
    }
  }, []);

  const handleClick = React.useCallback((e: React.MouseEvent) => {
    // Block if this click comes from a touch-drag sequence
    if (wasDragRef.current) return;
    // Block stray synthetic clicks after a detected drag
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
      <div
        className="relative overflow-hidden rounded-xl bg-stone-200
          shadow-[0_1px_8px_rgba(0,0,0,0.10)]
          transition-shadow duration-200 group-hover:shadow-[0_4px_20px_rgba(0,0,0,0.22)]"
      >
        <div
          className="relative w-full overflow-hidden"
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
              className={`w-full h-full object-cover block transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
              onLoad={() => setLoaded(true)}
              loading={index < 12 ? 'eager' : 'lazy'}
            />
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
                    {storytelling.fact_type || 'Dato'}
                  </span>
                  <p className="text-[10px] text-white/90 leading-snug line-clamp-2">
                    💡 {t(storytelling.did_you_know)}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Persistent storytelling badge — small emoji after load */}
          {storytelling && loaded && (
            <div className="absolute top-1.5 left-1.5 z-20">
              <span className="bg-black/40 backdrop-blur-sm text-[10px] px-1.5 py-0.5 rounded-full border border-white/15 shadow-sm"
                title="Tiene dato curioso"
              >
                {FACT_EMOJI[storytelling.fact_type] || '📖'}
              </span>
            </div>
          )}

          <div className="absolute bottom-0 left-0 right-0 px-2.5 pt-6 pb-2
            bg-gradient-to-t from-black/55 via-black/20 to-transparent">
            <CityLabel city={item.city} variant='scrim' />
          </div>

          {item.rarity && <RarityBadge rarity={item.rarity} variant='grid' />}
        </div>

        {showCaption && (
          <div className="px-2.5 py-2">
            <p className="text-stone-600 text-[10px] font-semibold leading-tight truncate">
              {categoryLabel}
            </p>
            <CityLabel city={item.city} country={item.country} variant='caption' />
          </div>
        )}
      </div>
    </Wrapper>
  );
});

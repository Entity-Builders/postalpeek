import React from 'react';
import { motion } from 'framer-motion';
import type { FeedItem } from '../Postcard';
import { WIDTHS } from '../../utils/imageUtils';
import { useSignedImage } from '../../utils/useSignedImage';
import { t } from '../../utils/i18n';
import { RarityBadge } from './RarityBadge';
import { CityLabel } from './CityLabel';

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

/** Precalculate layout for a single item (pure, no side effects) */
export function computeCardLayout(itemOrId: FeedItem | string): CardLayout {
  const isItem = typeof itemOrId !== 'string';
  const id = isItem ? itemOrId.id : itemOrId;
  const h = hashToFloat(id);
  
  let aspectRatio = ASPECT_RATIOS[Math.floor(h * ASPECT_RATIOS.length)];
  let showCaption = h > 0.45;

  if (isItem) {
    const rarity = itemOrId.rarity;
    const catObj = itemOrId.category;
    // Build a combined string from ALL available languages for matching
    let category = '';
    if (typeof catObj === 'string') {
      category = catObj.toLowerCase();
    } else if (catObj) {
      category = [catObj.en, catObj.es].filter(Boolean).join(' ').toLowerCase();
    }
    // Normalize accented characters for matching
    const categoryNorm = category.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    
    // Important = square card, always show caption
    const isImportant = 
      rarity === 'legendary' || 
      rarity === 'epic' || 
      categoryNorm.includes('monument') ||
      categoryNorm.includes('landmark') || 
      categoryNorm.includes('architecture') ||
      categoryNorm.includes('arquitectura') ||
      categoryNorm.includes('historical') ||
      categoryNorm.includes('historico') ||
      categoryNorm.includes('iglesia') ||
      categoryNorm.includes('church') ||
      categoryNorm.includes('cathedral') ||
      categoryNorm.includes('catedral') ||
      categoryNorm.includes('palace') ||
      categoryNorm.includes('palacio');

    const isBasic = 
      rarity === 'common' || 
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
  const placeholderUrl = useSignedImage(item.illustration_url, { width: WIDTHS.blur, quality: 15 });

  const [loaded, setLoaded] = React.useState(false);

  const categoryLabel = typeof item.category === 'string' ? item.category : t(item.category);

  const { aspectRatio, showCaption } = layout;

  // ── Scroll-vs-tap detection ───────────────────────────────────────
  const DRAG_THRESHOLD = 10;
  const touchStartRef = React.useRef<{ x: number; y: number } | null>(null);
  const wasDragRef = React.useRef(false);

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

  const handleClick = React.useCallback(() => {
    if (wasDragRef.current) return;
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
              alt={categoryLabel}
              className={`w-full h-full object-cover block transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
              onLoad={() => setLoaded(true)}
              loading={index < 12 ? 'eager' : 'lazy'}
            />
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

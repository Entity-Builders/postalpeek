import React, { useEffect, useRef, useCallback, useMemo } from 'react';
import Masonry from 'react-masonry-css';
import { motion } from 'framer-motion';
import { Loader2, MapPin, Star } from 'lucide-react';
import type { FeedItem } from './Postcard';
import type { User } from '@supabase/supabase-js';
import { cdnImage, WIDTHS } from '../utils/imageUtils';
import { useSignedImage } from '../utils/useSignedImage';
import { t } from '../utils/i18n';
import { analytics } from '../lib/analytics';
import { WalkerFilterMenu } from './WalkerFilterMenu';
import { AuthCTASection } from './AuthCTASection';

/* ──────────────────────────────────────────────────────────────────
   Layout helpers — computed once and cached
   ────────────────────────────────────────────────────────────────── */

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

interface CardLayout {
  aspectRatio: string;
  showCaption: boolean;
}

/** Precalculate layout for a single item (pure, no side effects) */
function computeCardLayout(id: string): CardLayout {
  const h = hashToFloat(id);
  return {
    aspectRatio: ASPECT_RATIOS[Math.floor(h * ASPECT_RATIOS.length)],
    showCaption: h > 0.45,
  };
}

const RARITY_COLORS: Record<string, string> = {
  legendary: 'from-amber-400 to-yellow-300 text-amber-900',
  epic: 'from-purple-500 to-violet-400 text-white',
  rare: 'from-sky-500 to-blue-400 text-white',
  common: 'from-stone-400 to-stone-300 text-stone-700',
};

/* ──────────────────────────────────────────────────────────────────
   Skeleton Card — shows masonry structure before data arrives
   ────────────────────────────────────────────────────────────────── */

const SKELETON_LAYOUTS: CardLayout[] = [
  { aspectRatio: '3/4', showCaption: true },
  { aspectRatio: '1/1', showCaption: false },
  { aspectRatio: '2/3', showCaption: true },
  { aspectRatio: '4/5', showCaption: false },
  { aspectRatio: '5/4', showCaption: true },
  { aspectRatio: '3/4', showCaption: false },
  { aspectRatio: '1/1', showCaption: true },
  { aspectRatio: '2/3', showCaption: false },
  { aspectRatio: '4/5', showCaption: true },
  { aspectRatio: '3/4', showCaption: false },
  { aspectRatio: '5/4', showCaption: true },
  { aspectRatio: '2/3', showCaption: false },
];

function SkeletonCard({ layout, index }: { layout: CardLayout; index: number }) {
  return (
    <div
      className="rounded-xl bg-stone-200 overflow-hidden animate-pulse"
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <div
        className="w-full bg-gradient-to-br from-stone-200 via-stone-300/60 to-stone-200"
        style={{ aspectRatio: layout.aspectRatio }}
      />
      {layout.showCaption && (
        <div className="px-2.5 py-2 space-y-1.5">
          <div className="h-2.5 w-3/4 rounded bg-stone-300/70" />
          <div className="h-2 w-1/2 rounded bg-stone-300/50" />
        </div>
      )}
    </div>
  );
}

function SkeletonGrid() {
  return (
    <>
      <style>{`
        .walker-masonry { display: flex; width: auto; gap: 8px; }
        .walker-masonry_column { display: flex; flex-direction: column; gap: 8px; }
      `}</style>
      <Masonry
        breakpointCols={{ default: 3, 1024: 3, 768: 2, 640: 2 }}
        className="walker-masonry"
        columnClassName="walker-masonry_column"
      >
        {SKELETON_LAYOUTS.map((layout, i) => (
          <SkeletonCard key={i} layout={layout} index={i} />
        ))}
      </Masonry>
    </>
  );
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

const GridCard = React.memo(function GridCard({ item, index, layout, onClick }: GridCardProps) {
  const imgUrl = useSignedImage(item.illustration_url, { width: WIDTHS.mobile });
  const placeholderUrl = cdnImage(item.illustration_url, { width: WIDTHS.blur, quality: 15 });

  const [loaded, setLoaded] = React.useState(false);

  const rarityColor = item.rarity ? RARITY_COLORS[item.rarity] : null;
  const categoryLabel = typeof item.category === 'string' ? item.category : t(item.category);

  const { aspectRatio, showCaption } = layout;

  // ── Scroll-vs-tap detection ───────────────────────────────────────
  // On mobile, scrolling over a card fires onClick after touchend.
  // We track the touch start position and suppress the click if the
  // finger moved more than DRAG_THRESHOLD px (= scroll, not tap).
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
    if (wasDragRef.current) return; // was a scroll, not a tap
    onClick();
  }, [onClick]);

  // Skip framer-motion overhead for off-screen cards
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
      {/* Pinterest card — variable height via aspect-ratio crop */}
      <div
        className="relative overflow-hidden rounded-xl bg-stone-200
          shadow-[0_1px_8px_rgba(0,0,0,0.10)]
          transition-shadow duration-200 group-hover:shadow-[0_4px_20px_rgba(0,0,0,0.22)]"
      >
        {/* Image container with variable aspect ratio */}
        <div
          className="relative w-full overflow-hidden"
          style={{ aspectRatio }}
        >
          {/* Blurred placeholder */}
          {placeholderUrl && !loaded && (
            <img
              src={placeholderUrl}
              alt=""
              aria-hidden
              className="absolute inset-0 w-full h-full object-cover blur-md scale-105"
            />
          )}

          {/* Main illustration — cropped to aspect ratio */}
          {imgUrl && (
            <img
              src={imgUrl}
              alt={categoryLabel}
              className={`w-full h-full object-cover block transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
              onLoad={() => setLoaded(true)}
              loading={index < 6 ? 'eager' : 'lazy'}
            />
          )}

          {/* Bottom scrim + city label */}
          <div className="absolute bottom-0 left-0 right-0 px-2.5 pt-6 pb-2
            bg-gradient-to-t from-black/55 via-black/20 to-transparent">
            <div className="flex items-center gap-1">
              <MapPin className="w-2.5 h-2.5 text-white/80 shrink-0" />
              <p className="text-white/90 text-[10px] font-medium truncate leading-tight drop-shadow-sm">
                {item.city}
              </p>
            </div>
          </div>

          {/* Rarity badge */}
          {item.rarity && item.rarity !== 'common' && rarityColor && (
            <div className={`absolute top-2 left-2 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-gradient-to-r ${rarityColor} shadow-md`}>
              <Star className="w-2 h-2" strokeWidth={2.5} />
              {item.rarity.toUpperCase()}
            </div>
          )}
        </div>

        {/* Optional caption below image — adds more height variation */}
        {showCaption && (
          <div className="px-2.5 py-2">
            <p className="text-stone-600 text-[10px] font-semibold leading-tight truncate">
              {categoryLabel}
            </p>
            <div className="flex items-center gap-1 mt-0.5">
              <MapPin className="w-2 h-2 text-stone-400 shrink-0" />
              <p className="text-stone-400 text-[9px] truncate">
                {item.city}{item.country ? `, ${item.country}` : ''}
              </p>
            </div>
          </div>
        )}
      </div>
    </Wrapper>
  );
});

/* ──────────────────────────────────────────────────────────────────
   Walker Grid — main component
   ────────────────────────────────────────────────────────────────── */

interface WalkerGridProps {
  items: FeedItem[];
  isLoading: boolean;
  hasMore: boolean;
  isFetchingMore: boolean;
  fetchMoreFeed: () => void;
  availableCountries: string[];
  selectedCountry: string | null;
  onSelectCountry: (country: string | null) => void;
  spotlightResults: FeedItem[];
  spotlightQuery: string;
  isSpotlightSearching: boolean;
  onSpotlightSearch: (query: string) => void;
  onSpotlightDismiss: () => void;
  onAuthSuccess: () => void;
  onCardClick: (index: number) => void;
  viewedItems?: FeedItem[];
  user?: User | null;
  unlockedCountries?: Set<string>;
  onOpenAlbumsModal?: () => void;
  onToggleCollection?: () => void;
}

export function WalkerGrid({
  items,
  isLoading,
  hasMore,
  isFetchingMore,
  fetchMoreFeed,
  availableCountries,
  selectedCountry,
  onSelectCountry,
  spotlightResults,
  spotlightQuery,
  isSpotlightSearching,
  onSpotlightSearch,
  onSpotlightDismiss,
  onAuthSuccess,
  onCardClick,
  viewedItems = [],
  user = null,
  unlockedCountries = new Set(),
  onOpenAlbumsModal,
  onToggleCollection,
}: WalkerGridProps) {
  const displayItems = spotlightQuery && spotlightResults.length > 0 ? spotlightResults : items;
  const sentinelRef = useRef<HTMLDivElement>(null);
  const isFetchingRef = useRef(false);

  // ── Precalculated layout map — O(n) only when items change ──
  const layoutMap = useMemo(() => {
    const map = new Map<string, CardLayout>();
    for (const item of displayItems) {
      if (!map.has(item.id)) {
        map.set(item.id, computeCardLayout(item.id));
      }
    }
    return map;
  }, [displayItems]);

  // ── Stable click handlers — avoids new closure per card per render ──
  const handleCardClick = useCallback(
    (index: number, item: FeedItem) => {
      onCardClick(index);
      analytics.track('grid_card_tapped', {
        postcard_id: item.id,
        city: item.city,
        index,
      });
    },
    [onCardClick],
  );

  // Infinite scroll via IntersectionObserver
  useEffect(() => {
    isFetchingRef.current = isFetchingMore;
  }, [isFetchingMore]);

  const handleObserver = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [entry] = entries;
      if (entry.isIntersecting && hasMore && !isFetchingRef.current) {
        fetchMoreFeed();
      }
    },
    [hasMore, fetchMoreFeed],
  );

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(handleObserver, { threshold: 0.1 });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [handleObserver]);

  return (
    <div className="w-full h-full overflow-y-auto overflow-x-hidden" style={{ WebkitOverflowScrolling: 'touch' }}>
      {/* Filter menu */}
      <div className="sticky top-0 z-30 px-3 pt-3 pb-2 bg-gradient-to-b from-[#e6e2da] via-[#e6e2da]/95 to-transparent">
        <div className="max-w-4xl mx-auto">
          <WalkerFilterMenu
            availableCountries={availableCountries}
            unlockedCountries={unlockedCountries}
            selectedCountry={selectedCountry}
            onSelectCountry={onSelectCountry}
            isLoggedIn={!!user}
            onOpenAlbumsModal={onOpenAlbumsModal || (() => {})}
            onToggleCollection={onToggleCollection}
            spotlightQuery={spotlightQuery}
            isSpotlightSearching={isSpotlightSearching}
            onSpotlightSearch={onSpotlightSearch}
            onSpotlightDismiss={onSpotlightDismiss}
          />
        </div>
      </div>

      {/* Pinterest masonry grid */}
      <div className="max-w-4xl mx-auto px-2 pb-2">
        <style>{`
          .walker-masonry { display: flex; width: auto; gap: 8px; }
          .walker-masonry_column { display: flex; flex-direction: column; gap: 8px; }
        `}</style>

        {isLoading ? (
          <SkeletonGrid />
        ) : (
          <Masonry
            breakpointCols={{ default: 3, 1024: 3, 768: 2, 640: 2 }}
            className="walker-masonry"
            columnClassName="walker-masonry_column"
          >
            {displayItems.map((item, index) => (
              <GridCard
                key={item.id}
                item={item}
                index={index}
                layout={layoutMap.get(item.id) || computeCardLayout(item.id)}
                onClick={() => handleCardClick(index, item)}
              />
            ))}
          </Masonry>
        )}
      </div>

      {/* Fetch more sentinel */}
      <div ref={sentinelRef} className="h-4" />

      {isFetchingMore && (
        <div className="flex justify-center py-4">
          <Loader2 className="w-5 h-5 text-stone-400 animate-spin" />
        </div>
      )}

      {/* Auth CTA section — only for anonymous users */}
      {!user && <AuthCTASection onSuccess={onAuthSuccess} viewedItems={viewedItems.length > 0 ? viewedItems : items} />}
    </div>
  );
}

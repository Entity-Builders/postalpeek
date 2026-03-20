import React, { useEffect, useRef, useCallback } from 'react';
import Masonry from 'react-masonry-css';
import { motion } from 'framer-motion';
import { Loader2, MapPin, Star } from 'lucide-react';
import type { FeedItem } from './Postcard';
import { cdnImage, WIDTHS } from '../utils/imageUtils';
import { useSignedImage } from '../utils/useSignedImage';
import { t } from '../utils/i18n';
import { analytics } from '../lib/analytics';
import { WalkerFilterMenu } from './WalkerFilterMenu';
import { AuthCTASection } from './AuthCTASection';




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
  /** Called when a card is tapped — parent handles feed mode transition */
  onCardClick: (index: number) => void;
  /** How many cards the user saw (to show in auth CTA) */
  viewedItems?: FeedItem[];
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
}: WalkerGridProps) {
  const displayItems = spotlightQuery && spotlightResults.length > 0 ? spotlightResults : items;
  const sentinelRef = useRef<HTMLDivElement>(null);
  const isFetchingRef = useRef(false);

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

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-stone-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="w-full h-full overflow-y-auto overflow-x-hidden" style={{ WebkitOverflowScrolling: 'touch' }}>
      {/* Filter menu */}
      <div className="sticky top-0 z-30 px-3 pt-3 pb-2 bg-gradient-to-b from-[#e6e2da] via-[#e6e2da]/95 to-transparent">
        <div className="max-w-4xl mx-auto">
          <WalkerFilterMenu
            availableCountries={availableCountries}
            unlockedCountries={new Set()} // anonymous users have no unlocked countries
            selectedCountry={selectedCountry}
            onSelectCountry={onSelectCountry}
            isLoggedIn={false}
            onOpenAlbumsModal={() => {}}
            spotlightQuery={spotlightQuery}
            isSpotlightSearching={isSpotlightSearching}
            onSpotlightSearch={onSpotlightSearch}
            onSpotlightDismiss={onSpotlightDismiss}
          />
        </div>
      </div>

      {/* Pinterest masonry grid — react-masonry-css handles layout shifts */}
      <div className="max-w-4xl mx-auto px-2 pb-2">
        <style>{`
          .walker-masonry { display: flex; width: auto; gap: 8px; }
          .walker-masonry_column { display: flex; flex-direction: column; gap: 8px; }
        `}</style>
        <Masonry
          breakpointCols={{ default: 4, 1024: 4, 768: 3, 640: 2 }}
          className="walker-masonry"
          columnClassName="walker-masonry_column"
        >
          {displayItems.map((item, index) => (
            <GridCard
              key={item.id}
              item={item}
              index={index}
              onClick={() => {
                onCardClick(index);
                analytics.track('grid_card_tapped', {
                  postcard_id: item.id,
                  city: item.city,
                  index,
                });
              }}
            />
          ))}
        </Masonry>
      </div>

      {/* Fetch more sentinel */}
      <div ref={sentinelRef} className="h-4" />

      {isFetchingMore && (
        <div className="flex justify-center py-4">
          <Loader2 className="w-5 h-5 text-stone-400 animate-spin" />
        </div>
      )}

      {/* Auth CTA section */}
      <AuthCTASection onSuccess={onAuthSuccess} viewedItems={viewedItems.length > 0 ? viewedItems : items} />
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────
   Grid Card
   ────────────────────────────────────────────────────────────────── */

interface GridCardProps {
  item: FeedItem;
  index: number;
  onClick: () => void;
}

const RARITY_COLORS: Record<string, string> = {
  legendary: 'from-amber-400 to-yellow-300 text-amber-900',
  epic: 'from-purple-500 to-violet-400 text-white',
  rare: 'from-sky-500 to-blue-400 text-white',
  common: 'from-stone-400 to-stone-300 text-stone-700',
};

function GridCard({ item, index, onClick }: GridCardProps) {
  const imgUrl = useSignedImage(item.illustration_url, { width: WIDTHS.mobile });
  const placeholderUrl = cdnImage(item.illustration_url, { width: WIDTHS.blur, quality: 15 });

  const [loaded, setLoaded] = React.useState(false);

  const rarityColor = item.rarity ? RARITY_COLORS[item.rarity] : null;
  const categoryLabel = typeof item.category === 'string' ? item.category : t(item.category);

  return (
    <motion.div
      className="relative cursor-pointer group"
      style={{ display: 'inline-block', width: '100%' }}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(index * 0.04, 0.6), ease: 'easeOut' }}
      onClick={onClick}
    >
      {/* Pinterest card — full bleed image, rounded corners, overlay */}
      <div
        className="relative overflow-hidden rounded-xl bg-stone-200
          shadow-[0_1px_8px_rgba(0,0,0,0.10)]
          transition-shadow duration-200 group-hover:shadow-[0_4px_20px_rgba(0,0,0,0.22)]"
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

        {/* Main illustration — natural aspect ratio */}
        {imgUrl && (
          <img
            src={imgUrl}
            alt={categoryLabel}
            className={`w-full h-auto block transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
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
    </motion.div>
  );
}

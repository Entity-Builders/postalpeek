import React, { useEffect, useRef, useCallback, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { FeedItem } from './Postcard';
import type { User } from '@supabase/supabase-js';
import { analytics } from '../lib/analytics';
import { WalkerFilterMenu } from './WalkerFilterMenu';
import { AuthCTASection } from './AuthCTASection';
import { SkeletonGrid } from './ui/SkeletonCard';
import { GridCard } from './ui/GridCard';
import { type CardLayout, computeCardLayout } from './ui/cardLayout';
import { WalkerWelcome } from './WalkerWelcome';
import { WalkerWelcomeAnimated } from './WalkerWelcomeAnimated';
import { useNavigate } from 'react-router-dom';
import { checkStreetViewAvailability } from './explorer-utils';

const USE_NEW_WELCOME = true; // Temporary flag for A/B testing onboarding UX
import { markWelcomeSeen } from '../utils/welcomeStorage';
import { motion } from 'framer-motion';
import { useStampContext } from '../contexts/StampContext';

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
  showWelcome?: boolean;
  previewCards?: FeedItem[];
  claimedIds?: Set<string>;
  viewMode: 'grid' | 'feed';
  onToggleViewMode: () => void;
  onClaimPostcard?: (id: string, rarity: 'common' | 'rare' | 'epic' | 'legendary') => void;
  profileWidgetNode?: React.ReactNode;
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
  showWelcome = false,
  previewCards = [],
  claimedIds = new Set<string>(),
  viewMode,
  onToggleViewMode,
  onClaimPostcard,
  profileWidgetNode,
}: WalkerGridProps) {
  const navigate = useNavigate();
  const displayItems = spotlightQuery && spotlightResults.length > 0 ? spotlightResults : items;
  const sentinelRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isFetchingRef = useRef(false);

  const { addLocalStamps } = useStampContext();

  // ── Reset scroll to top when filter/search changes ──
  useEffect(() => {
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [selectedCountry, spotlightQuery]);

  // ── Precalculated layout map — O(n) only when items change ──
  const layoutMap = useMemo(() => {
    const map = new Map<string, CardLayout>();
    for (const item of displayItems) {
      if (!map.has(item.id)) {
        map.set(item.id, computeCardLayout(item));
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
      const canFetchMore = user ? hasMore : false;
      if (entry.isIntersecting && canFetchMore && !isFetchingRef.current) {
        fetchMoreFeed();
      }
    },
    [hasMore, fetchMoreFeed, user],
  );

  useEffect(() => {
    const sentinel = sentinelRef.current;
    const scrollRoot = scrollContainerRef.current;
    if (!sentinel || !scrollRoot) return;
    // root = scrollable container so rootMargin works within it
    // rootMargin: prefetch 600px before the user actually reaches the bottom
    const observer = new IntersectionObserver(handleObserver, {
      root: scrollRoot,
      threshold: 0.1,
      rootMargin: '0px 0px 600px 0px',
    });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [handleObserver]);

  const gridSentinelRef = useRef<HTMLDivElement>(null);
  const [gridRevealed, setGridRevealed] = useState(!showWelcome);
  useEffect(() => {
    if (!showWelcome) return;
    const el = gridSentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          // Fallback scroll listener just in case they swipe
          markWelcomeSeen();
          setGridRevealed(true);
          analytics.track('welcome_scroll_started');
          obs.disconnect();
        }
      },
      { threshold: 0.1 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [showWelcome]);

  const handleStartOnboarding = useCallback(async () => {
    addLocalStamps(50);
    analytics.track('welcome_onboarding_started', { initial_stamps: 50 });
    
    // Perform "Surprise Trip" logic
    const pool = items.filter((i: any) => i.lat != null && i.lng != null);
    if (pool.length > 0) {
      const random = pool[Math.floor(Math.random() * pool.length)];
      analytics.track('teleport_surprise_trip', { destination_id: random.id, city: random.city, country: random.country });
      
      // Preflight check before navigating — avoid landing on "No Street View" screen
      const MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? '';
      const available = await checkStreetViewAvailability({
        panoId: random.streetview_pov?.pano_id,
        lat: random.lat,
        lng: random.lng,
        mapsKey: MAPS_KEY,
      });

      if (available) {
        navigate(`/explore?id=${random.id}`);
        setTimeout(() => markWelcomeSeen(), 500);
      } else {
        // Imagery not available — fall through to grid reveal
        markWelcomeSeen();
        setGridRevealed(true);
        setTimeout(() => {
          gridSentinelRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }
    } else {
      // Fallback
      markWelcomeSeen();
      setGridRevealed(true);
      setTimeout(() => {
        gridSentinelRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [addLocalStamps, items, navigate]);

  return (
    <div ref={scrollContainerRef} className="w-full h-full overflow-y-auto overflow-x-hidden" style={{ WebkitOverflowScrolling: 'touch' }}>

      {/* ── Welcome Hero Section ── */}
      {showWelcome && (
        <div className="w-full h-[100dvh] flex items-center justify-center bg-[#e6e2da]">
          {USE_NEW_WELCOME ? (
            <WalkerWelcomeAnimated previewCards={previewCards} onStartOnboarding={handleStartOnboarding} />
          ) : (
            <WalkerWelcome previewCards={previewCards} />
          )}
        </div>
      )}

      {/* Grid sentinel — triggers markWelcomeSeen + reveal animation */}
      {showWelcome && <div ref={gridSentinelRef} className="h-1" />}

      {/* Animated grid container — slides in after scrolling past welcome */}
      <motion.div
        initial={showWelcome ? { opacity: 0, y: 40 } : false}
        animate={gridRevealed ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* Filter menu */}
        <div className="sticky top-0 z-30 px-3 pt-4 pb-6 bg-gradient-to-b from-[#e6e2da] via-[#e6e2da]/95 to-transparent" style={{ minHeight: '64px' }}>
          <div className="relative w-full max-w-[1800px] mx-auto md:px-4 lg:px-8" style={{ minHeight: '44px' }}>
            <WalkerFilterMenu
              availableCountries={availableCountries}
              unlockedCountries={unlockedCountries}
              selectedCountry={selectedCountry}
              onSelectCountry={onSelectCountry}
              isLoggedIn={!!user}
              spotlightQuery={spotlightQuery}
              isSpotlightSearching={isSpotlightSearching}
              onSpotlightSearch={onSpotlightSearch}
              onSpotlightDismiss={onSpotlightDismiss}
              viewMode={viewMode}
              onToggleViewMode={onToggleViewMode}
              profileWidgetNode={profileWidgetNode}
            />
          </div>
        </div>

        {/* CSS Columns grid */}
        <div className="w-full max-w-[1800px] mx-auto px-4 md:px-8 pb-24">
          <style>{`
            .walker-columns {
              column-count: ${viewMode === 'feed' ? 1 : 2};
              column-gap: 8px;
              ${viewMode === 'feed' ? 'display: flex; flex-direction: column; align-items: center;' : ''}
            }
            .walker-columns > * {
              break-inside: avoid;
              margin-bottom: ${viewMode === 'feed' ? '24px' : '8px'};
              ${viewMode === 'feed' ? 'width: 100%; max-width: 500px;' : ''}
            }
            @media (min-width: 768px)  { .walker-columns { column-count: ${viewMode === 'feed' ? 1 : 2}; } }
            @media (min-width: 1024px) { .walker-columns { column-count: ${viewMode === 'feed' ? 1 : 3}; } }
          `}</style>

          {isLoading ? (
            <SkeletonGrid />
          ) : (
            <div className="walker-columns">
              {displayItems.map((item, index) => (
                <GridCard
                  key={item.id}
                  item={item}
                  index={index}
                  layout={layoutMap.get(item.id) || computeCardLayout(item)}
                  onClick={() => handleCardClick(index, item)}
                  isClaimedByMe={claimedIds.has(item.id)}
                  viewMode={viewMode}
                  onClaimPostcard={onClaimPostcard}
                  user={user}
                />
              ))}
            </div>
          )}
        </div>

        {/* Fetch more sentinel */}
        <div ref={sentinelRef} className="h-4" />

        {isFetchingMore && user && (
          <div className="flex justify-center py-4">
            <Loader2 className="w-5 h-5 text-stone-400 animate-spin" />
          </div>
        )}

        {/* Auth CTA section — only for anonymous users */}
        {!user && <AuthCTASection onSuccess={onAuthSuccess} viewedItems={viewedItems.length > 0 ? viewedItems : items} />}
      </motion.div>
    </div>
  );
}

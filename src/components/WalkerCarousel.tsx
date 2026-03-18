import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import useEmblaCarousel from 'embla-carousel-react';
import { encodeUuidToHash } from '@eb-packages/logic/src/hash';
import { analytics } from '../lib/analytics';
import { t } from '../utils/i18n';
import { Postcard, FeedItem } from './Postcard';
import { AlbumCover } from './AlbumCover';
import { motion, AnimatePresence } from 'framer-motion';
import { WalkerWelcome } from './WalkerWelcome';
import { markWelcomeSeen } from '../utils/welcomeStorage';
import { cdnImage, WIDTHS } from '../utils/imageUtils';
import { DailyPackCard, type RevealMode } from './DailyPackCard';
import { DailyPackComplete } from './DailyPackComplete';
import type { User } from '@supabase/supabase-js';

const FREE_CARD_LIMIT = 4;
const AUTH_GATE_KEY = 'postalpeek_auth_gate';
const AUTH_GATE_CARDS_KEY = 'postalpeek_auth_cards';

interface WalkerCarouselProps {
  items: FeedItem[];
  displayItems: FeedItem[];
  hasMore: boolean;
  isFetchingMore: boolean;
  isFetchingRef: React.MutableRefObject<boolean>;
  fetchMoreFeed: () => void;
  selectedCountry: string | null;
  user: User | null;
  isAdmin: boolean;
  showWelcome: boolean;
  isOnWelcome: boolean;
  setIsOnWelcome: (val: boolean) => void;
  favoriteIds: Set<string>;
  toggleFavorite: (id: string) => void;
  setShowAuthGate: (val: boolean) => void;
  setPendingFavoriteId: (id: string | null) => void;
  hasSharedCard: boolean;
  /** Collectibles */
  claimedIds: Set<string>;
  onClaimPostcard?: (postcardId: string) => void;
  isClaimLoading?: boolean;
  albumPostcardIds?: Set<string>;
  /** Daily Pack inline mode */
  packCards?: FeedItem[];
  onPackComplete?: () => void;
  /** Expand image to fullscreen lightbox */
  onExpandImage?: (item: FeedItem, sourceRect?: DOMRect) => void;
}

export function WalkerCarousel({
  items,
  displayItems,
  hasMore,
  isFetchingMore,
  isFetchingRef,
  fetchMoreFeed,
  selectedCountry,
  user,
  isAdmin,
  showWelcome,
  setIsOnWelcome,
  favoriteIds,
  toggleFavorite,
  setShowAuthGate,
  setPendingFavoriteId,
  hasSharedCard,
  claimedIds,
  onClaimPostcard,
  isClaimLoading = false,
  albumPostcardIds = new Set(),
  packCards = [],
  onPackComplete,
}: WalkerCarouselProps) {
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [lookaheadOffset, setLookaheadOffset] = useState(1);
  // Track which album covers have been "opened" to show the full Postcard view
  const [openedAlbums, setOpenedAlbums] = useState<Set<string>>(new Set());
  // Track which cards have loaded their hero image so we can hide the skeleton
  const [heroReadyIds, setHeroReadyIds] = useState<Set<string>>(new Set());
  // Daily pack: track revealed card indices
  const [revealedPackCards, setRevealedPackCards] = useState<Set<number>>(new Set());
  const [showPackSummary, setShowPackSummary] = useState(false);
  const isPackMode = packCards.length > 0;

  // Show summary immediately when pack cards arrive
  useEffect(() => {
    if (isPackMode && packCards.length > 0) {
      setShowPackSummary(true);
    }
  }, [isPackMode, packCards.length]);

  // Read PostHog feature flag for reveal mode (defaults to 'tap')
  const [revealMode, setRevealMode] = useState<RevealMode>('tap');
  useEffect(() => {
    if (!isPackMode) return;
    const flag = analytics.getFeatureFlag('daily-pack-reveal-mode');
    if (flag === 'auto-scroll' || flag === 'cascade') {
      setRevealMode(flag);
      analytics.track('daily_pack_variant_assigned', { variant: flag });
    } else {
      // Flag not loaded yet — listen for it
      analytics.onFeatureFlagsLoaded(() => {
        const resolved = analytics.getFeatureFlag('daily-pack-reveal-mode');
        const mode: RevealMode =
          resolved === 'auto-scroll' || resolved === 'cascade' ? resolved : 'tap';
        setRevealMode(mode);
        analytics.track('daily_pack_variant_assigned', { variant: mode });
      });
    }
  }, [isPackMode]);

  const [staggeredItems, setStaggeredItems] = useState<FeedItem[]>(() =>
    displayItems.slice(0, 2),
  );
  const [prevDisplayItems, setPrevDisplayItems] =
    useState<FeedItem[]>(displayItems);

  // Synchronously derive state during render to avoid cascading renders in useEffect
  if (displayItems !== prevDisplayItems) {
    setPrevDisplayItems(displayItems);
    if (displayItems.length === 0) {
      setStaggeredItems([]);
    } else {
      const prevIds = new Set(prevDisplayItems.map((i) => i.id));
      const isNewFeed =
        prevIds.size === 0 || !displayItems.some((i) => prevIds.has(i.id));
      if (isNewFeed) {
        setStaggeredItems(displayItems.slice(0, 2));
      } else {
        setStaggeredItems(displayItems);
      }
    }
  }

  const [prevSlideIndex, setPrevSlideIndex] = useState(-1);
  if (currentSlideIndex !== prevSlideIndex) {
    setPrevSlideIndex(currentSlideIndex);
    setLookaheadOffset(1);
  }

  const [emblaRef, emblaApi] = useEmblaCarousel({
    axis: 'y',
    align: 'start',
    skipSnaps: false,
    duration: 30,
    watchSlides: true,
  });

  // Reset carousel to first slide when any filter changes
  useEffect(() => {
    if (emblaApi) {
      emblaApi.scrollTo(0, true);
    }
    setOpenedAlbums(new Set());
  }, [emblaApi]);

  useEffect(() => {
    if (displayItems.length === 0) return;

    if (staggeredItems.length < displayItems.length) {
      const timer = setTimeout(() => {
        setStaggeredItems(displayItems);
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [displayItems, staggeredItems.length]);

  type SlideEntry =
    | { type: 'welcome' }
    | { type: 'postcard'; item: FeedItem; index: number; isFirstShared?: boolean }
    | { type: 'pack_card'; item: FeedItem; packIndex: number };

  const slides = React.useMemo((): SlideEntry[] => {
    const arr: SlideEntry[] = [];

    // ── Pack cards are prepended to the feed (no modal override) ──
    if (isPackMode) {
      packCards.forEach((card, i) => {
        arr.push({ type: 'pack_card' as const, item: card, packIndex: i });
      });
    }

    // ── Normal feed follows ──
    if (showWelcome && !isPackMode) {
      if (hasSharedCard && staggeredItems.length > 0) {
        arr.push({ type: 'postcard', item: staggeredItems[0], index: 0, isFirstShared: true });
        arr.push({ type: 'welcome' });
        for (let i = 1; i < staggeredItems.length; i++) {
          arr.push({ type: 'postcard', item: staggeredItems[i], index: i });
        }
      } else {
        arr.push({ type: 'welcome' });
        for (let i = 0; i < staggeredItems.length; i++) {
          arr.push({ type: 'postcard', item: staggeredItems[i], index: i });
        }
      }
    } else {
      for (let i = 0; i < staggeredItems.length; i++) {
        arr.push({ type: 'postcard', item: staggeredItems[i], index: i });
      }
    }
    return arr;
  }, [staggeredItems, showWelcome, hasSharedCard, isPackMode, packCards]);

  useEffect(() => {
    if (!emblaApi) return;

    const onSelect = () => {
      const currentIndex = emblaApi.selectedScrollSnap();
      setCurrentSlideIndex(currentIndex);

      const slide = slides[currentIndex];
      
      if (slide && slide.type === 'welcome') {
        setIsOnWelcome(true);
        if (currentIndex > 0) markWelcomeSeen(); // E.g., saw the shared card (idx 0), then swiped down to welcome (idx 1)
        return;
      } else if (showWelcome) {
        setIsOnWelcome(false);
      }

      const welcomeIndex = slides.findIndex(s => s.type === 'welcome');
      if (showWelcome && welcomeIndex !== -1 && currentIndex > welcomeIndex) {
        markWelcomeSeen();
      }

      if (!slide || slide.type !== 'postcard') return;

      const itemIndex = slide.index;

      if (itemIndex >= 0 && itemIndex < items.length) {
        const activeItem = items[itemIndex];
        const hash = encodeUuidToHash(activeItem.id);

        analytics.track('postcard_viewed', {
          postcard_id: activeItem.id,
          country: activeItem.country,
          city: activeItem.city,
          category: t(activeItem.category),
          index: itemIndex,
        });

        let newUrl = `/${hash}`;
        if (selectedCountry) {
          const countrySlug = encodeURIComponent(selectedCountry).replace(
            /%20/g,
            '-',
          );
          newUrl = `/${countrySlug}/${hash}`;
        }

        window.history.replaceState(null, '', newUrl);
      }

      if (itemIndex >= items.length - 2) {
        if (hasMore && !isFetchingRef.current) {
          fetchMoreFeed();
        }
      }

      if (!user && itemIndex >= FREE_CARD_LIMIT - 1) {
        setShowAuthGate(true);
        sessionStorage.setItem(AUTH_GATE_KEY, 'true');
        try {
          const heroCards = items.slice(0, 3).map((c) => ({
            id: c.id,
            illustration_url: c.illustration_url,
            city: c.city,
            country: c.country,
            category: t(c.category),
          }));
          sessionStorage.setItem(
            AUTH_GATE_CARDS_KEY,
            JSON.stringify(heroCards),
          );
        } catch {
          /* quota exceeded */
        }
        window.history.replaceState(null, '', '/');
        analytics.track('auth_gate_shown', { items_viewed: itemIndex + 1 });
      }
    };

    emblaApi.on('select', onSelect);

    return () => {
      emblaApi.off('select', onSelect);
    };
  }, [
    emblaApi,
    hasMore,
    fetchMoreFeed,
    items,
    selectedCountry,
    user,
    showWelcome,
    slides,
    setIsOnWelcome,
    setShowAuthGate,
    isFetchingRef,
  ]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLookaheadOffset(2);
    }, 2000);
    return () => clearTimeout(timer);
  }, [currentSlideIndex]);

  const navTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scrollWithDebounce = useCallback(
    (direction: 'next' | 'prev') => {
      if (!emblaApi || navTimeout.current) return;

      if (direction === 'next') {
        emblaApi.scrollNext();
      } else {
        emblaApi.scrollPrev();
      }

      navTimeout.current = setTimeout(() => {
        navTimeout.current = null;
      }, 600);
    },
    [emblaApi],
  );

  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        if (!emblaApi) return;
        if (Math.abs(e.deltaY) < 5) return;
        scrollWithDebounce(e.deltaY > 0 ? 'next' : 'prev');
      }
    },
    [emblaApi, scrollWithDebounce],
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault();
        scrollWithDebounce('next');
      } else if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault();
        scrollWithDebounce('prev');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [scrollWithDebounce]);

  // ── Global ambient background: derive URL from current active slide ──
  const ambientUrl = useMemo(() => {
    const slide = slides[currentSlideIndex];
    if (!slide) return null;
    if (slide.type === 'welcome') return null;
    const item = slide.type === 'pack_card' ? slide.item : slide.item;
    return cdnImage(item.illustration_url, { width: WIDTHS.blur, quality: 50 }) || null;
  }, [slides, currentSlideIndex]);

  // Keep track of previous ambient URL for crossfade
  const [shownAmbientUrl, setShownAmbientUrl] = useState<string | null>(null);
  const [prevAmbientUrl, setPrevAmbientUrl] = useState<string | null>(null);

  useEffect(() => {
    if (ambientUrl && ambientUrl !== shownAmbientUrl) {
      setPrevAmbientUrl(shownAmbientUrl);
      setShownAmbientUrl(ambientUrl);
    }
  }, [ambientUrl, shownAmbientUrl]);

  return (
    <div className='absolute inset-0 w-full h-full overflow-hidden'>
      {/* ── Global ambient blur background ── */}
      <div className='absolute inset-0 z-0 pointer-events-none'>
        {/* Base gradient fallback */}
        <div className='absolute inset-0 bg-gradient-to-br from-stone-300/60 via-stone-200/40 to-stone-300/50' />
        {/* Previous image (fades out) */}
        {prevAmbientUrl && (
          <img
            key={prevAmbientUrl}
            src={prevAmbientUrl}
            alt=''
            className='absolute inset-0 w-full h-full object-cover blur-[100px] brightness-125 saturate-[0.8] scale-125 transform-gpu opacity-0 transition-opacity duration-700'
          />
        )}
        {/* Current image (fades in) */}
        {shownAmbientUrl && (
          <img
            key={shownAmbientUrl}
            src={shownAmbientUrl}
            alt=''
            onLoad={(e) => {
              // Once loaded, fade in and clear previous
              (e.target as HTMLImageElement).style.opacity = '1';
              setPrevAmbientUrl(null);
            }}
            className='absolute inset-0 w-full h-full object-cover blur-[100px] brightness-125 saturate-[0.8] scale-125 transform-gpu opacity-0 transition-opacity duration-700'
          />
        )}
        {/* Radial wash overlay */}
        <div className='absolute inset-0 bg-radial-gradient from-white/40 via-transparent to-transparent opacity-80' />
      </div>

      <div
        className='embla absolute inset-0 w-full h-full overflow-hidden z-[1]'
        ref={emblaRef}
        onWheel={handleWheel}
      >
      <div className='embla__container h-full flex flex-col'>
        {slides.map((slide, slideIndex) => {
          if (slide.type === 'welcome') {
            return (
              <div key="welcome-slide" className='embla__slide w-full h-[100dvh] shrink-0 flex items-center justify-center relative'>
                <WalkerWelcome previewCards={staggeredItems.slice(0, 3)} />
              </div>
            );
          }

          /* ── Pack card slide ── */
          if (slide.type === 'pack_card') {
            const { item: packItem, packIndex } = slide;
            return (
              <div
                key={`pack-${packItem.id}`}
                className='embla__slide w-full h-[100dvh] shrink-0 flex items-center justify-center relative'
              >
                <div className='z-10 w-full h-full flex items-center justify-center'>
                  <DailyPackCard
                    item={packItem}
                    cardIndex={packIndex}
                    totalCards={packCards.length}
                    isActive={slideIndex === currentSlideIndex}
                    isRevealed={revealedPackCards.has(packIndex)}
                    onReveal={() => {
                      setRevealedPackCards((prev) => {
                        const next = new Set(prev);
                        next.add(packIndex);
                        return next;
                      });
                    }}
                    revealMode={revealMode}
                    cascadeDelay={packIndex * 300}
                    isInAlbum={albumPostcardIds.has(packItem.id)}
                    user={user}
                    isAdmin={isAdmin}
                    favoriteIds={favoriteIds}
                    toggleFavorite={toggleFavorite}
                    claimedIds={claimedIds}
                    onClaimPostcard={onClaimPostcard}
                    isClaimLoading={isClaimLoading}
                    albumPostcardIds={albumPostcardIds}
                    setShowAuthGate={setShowAuthGate}
                    setPendingFavoriteId={setPendingFavoriteId}
                  />
                </div>
              </div>
            );
          }


          /* ── Normal postcard slide (unchanged) ── */
          const { item, index: itemIndex, isFirstShared } = slide;

          return (
            <div
              key={`${item.id}-${itemIndex}`}
              className='embla__slide w-full h-[100dvh] shrink-0 flex items-center justify-center relative'
            >

              {/* Inline skeleton — strictly respecting the Polaroid shell dimensions */}
              {!heroReadyIds.has(item.id) && (
                <div className='absolute inset-0 z-[5] flex items-center justify-center pointer-events-none'>
                  <div 
                    className='w-[95vw] max-w-[480px] md:max-w-[520px] flex items-center justify-center'
                    style={{ aspectRatio: '4/5' }}
                  >
                    <div 
                      className='w-full h-full bg-white/90 backdrop-blur-sm shadow-[0_8px_30px_rgba(0,0,0,0.12),inset_0_0_0_1px_rgba(0,0,0,0.05)] rounded-[12px] flex flex-col p-2 pb-8'
                    >
                      <div className='flex-1 relative overflow-hidden rounded-md bg-stone-200/50 animate-pulse' />
                    </div>
                  </div>
                </div>
              )}

              {/* Actual card content */}
              <div 
                className='z-10 w-[95vw] max-w-[480px] md:max-w-[520px] mx-auto flex items-center justify-center'
                style={{ aspectRatio: '4/5' }}
              >
                <div 
                  className='relative w-full h-full bg-white flex flex-col overflow-hidden'
                  style={{
                    boxShadow: '0 8px 30px rgba(0,0,0,0.12), inset 0 0 0 1px rgba(0,0,0,0.05)',
                    padding: '8px 8px 32px 8px',
                    borderRadius: '12px',
                  }}
                >
                <AnimatePresence mode='wait'>
                  {item.album_id && !openedAlbums.has(item.album_id) ? (
                    <motion.div
                      key={`cover-${item.album_id}`}
                      className='w-full h-full flex items-center justify-center'
                      initial={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95, y: 10 }}
                      transition={{ duration: 0.2, ease: 'easeIn' }}
                    >
                      <AlbumCover
                        item={item}
                        isActive={true}
                        isPriority={slideIndex === currentSlideIndex || (slideIndex - currentSlideIndex) === 1 || !!isFirstShared}
                        onOpenTrip={() => {
                          setOpenedAlbums((prev) => {
                            const next = new Set(prev);
                            next.add(item.album_id!);
                            return next;
                          });
                          analytics.track('album_cover_opened', {
                            album_id: item.album_id,
                            postcard_id: item.id,
                            country: item.country,
                          });
                        }}
                      />
                    </motion.div>
                  ) : (
                    <motion.div
                      key={`postcard-${item.id}`}
                      className='w-full h-full flex items-center justify-center'
                      initial={item.album_id ? { opacity: 0, scale: 0.95, y: -10 } : false}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      transition={{ duration: 0.25, ease: 'easeOut' }}
                    >
                      <Postcard
                        item={item}
                        isActive={true}
                        isPriority={slideIndex === currentSlideIndex || (slideIndex - currentSlideIndex) === 1 || !!isFirstShared}
                        isAdmin={isAdmin}
                        favoriteIds={favoriteIds}
                        onToggleFavorite={user ? toggleFavorite : undefined}
                        isClaimedByMe={claimedIds.has(item.id)}
                        isClaimed={!!item.owner_id}
                        onClaimPostcard={user ? onClaimPostcard : undefined}
                        isClaimLoading={isClaimLoading}
                        isInAlbum={albumPostcardIds.has(item.id)}
                        showClaimGuide={showWelcome && claimedIds.size === 0 && itemIndex === 0}
                        onHeroReady={() => {
                          setHeroReadyIds((prev) => {
                            if (prev.has(item.id)) return prev;
                            const next = new Set(prev);
                            next.add(item.id);
                            return next;
                          });
                        }}
                        onAuthRequired={
                          !user
                            ? (postcardId) => {
                                setPendingFavoriteId(postcardId);
                                setShowAuthGate(true);
                                sessionStorage.setItem(AUTH_GATE_KEY, 'true');
                                try {
                                  const heroCards = items.slice(0, 3).map((c) => ({
                                    id: c.id,
                                    illustration_url: c.illustration_url,
                                    city: c.city,
                                    country: c.country,
                                    category: t(c.category),
                                  }));
                                  sessionStorage.setItem(
                                    AUTH_GATE_CARDS_KEY,
                                    JSON.stringify(heroCards),
                                  );
                                } catch {
                                  /* quota exceeded */
                                }
                                analytics.track('auth_gate_shown', {
                                  trigger: 'favorite',
                                  postcard_id: postcardId,
                                });
                              }
                            : undefined
                        }
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
            </div>
          );
        })}

        {isFetchingMore && (
          <div className='embla__slide w-full h-[30vh] shrink-0 flex items-center justify-center relative'>
            <Loader2 className='w-6 h-6 text-indigo-900/50 animate-spin' />
          </div>
        )}
      </div>

      {/* Pack summary overlay — appears when all cards are revealed */}
      <AnimatePresence>
        {showPackSummary && (
          <motion.div
            key='pack-summary'
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className='absolute inset-0 z-40 bg-gradient-to-br from-stone-200 via-stone-100 to-stone-200 flex items-center justify-center'
            onWheel={(e) => {
              if (e.deltaY > 30) {
                setShowPackSummary(false);
                // Pre-reveal all cards so they appear without blur
                setRevealedPackCards(new Set(packCards.map((_, i) => i)));
              }
            }}
          >
            <DailyPackComplete
              cards={packCards}
              albumCardCount={packCards.filter(c => albumPostcardIds.has(c.id)).length}
              onGoToFeed={() => {
                setShowPackSummary(false);
                // Pre-reveal all cards so they appear without blur
                setRevealedPackCards(new Set(packCards.map((_, i) => i)));
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </div>
  );
}


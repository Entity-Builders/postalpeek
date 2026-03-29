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
import { WalkerWelcomeAnimated } from './WalkerWelcomeAnimated';

const USE_NEW_WELCOME = true; // Temporary flag for A/B testing onboarding UX
import { markWelcomeSeen } from '../utils/welcomeStorage';
import { useStampContext } from '../contexts/StampContext';
import { cdnImage, WIDTHS } from '../utils/imageUtils';
import { PackRevealSlide } from './PackRevealSlide';
import { EnvelopeSlide } from './EnvelopeSlide';
import { AuthCTASection } from './AuthCTASection';
import type { User } from '@supabase/supabase-js';
import { useNavigate } from 'react-router-dom';
import { AmbientBackground } from './ui/AmbientBackground';
import { useGameMode } from '../contexts/GameModeContext';

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
  setShowWelcome?: (val: boolean) => void;
  isOnWelcome: boolean;
  setIsOnWelcome: (val: boolean) => void;
  favoriteIds: Set<string>;
  toggleFavorite: (id: string) => void;
  setShowAuthGate: (val: boolean) => void;
  setPendingFavoriteId: (id: string | null) => void;
  hasSharedCard: boolean;
  /** Collectibles */
  claimedIds: Set<string>;
  onClaimPostcard?: (postcardId: string, cost?: number) => void;
  isClaimLoading?: boolean;
  albumPostcardIds?: Set<string>;
  /** Daily Pack inline mode */
  packCards?: FeedItem[];
  isPackAvailable?: boolean;
  isPackLoading?: boolean;
  onOpenPack?: () => void;
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
  setShowWelcome,
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
  isPackAvailable = false,
  isPackLoading = false,
  onOpenPack,
  onPackComplete,
}: WalkerCarouselProps) {
  const { isGameActive } = useGameMode();
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const navigate = useNavigate();
  // Track which album covers have been "opened" to show the full Postcard view
  const [openedAlbums, setOpenedAlbums] = useState<Set<string>>(new Set());
  // Track which cards have loaded their hero image so we can hide the skeleton
  const [heroReadyIds, setHeroReadyIds] = useState<Set<string>>(new Set());
  // Ref so handlers always see the latest value without stale closures
  const isGameActiveRef = useRef(false);
  const isPackMode = packCards.length > 0;
  
  const { addLocalStamps } = useStampContext();

  // Sync ref when game state changes
  useEffect(() => {
    isGameActiveRef.current = isGameActive;
  }, [isGameActive]);

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
  }

  const [emblaRef, emblaApi] = useEmblaCarousel({
    axis: 'y',
    align: 'start',
    skipSnaps: false,
    duration: 30,
    watchSlides: true,
  });

  // Disable/enable Embla drag based on game state
  useEffect(() => {
    if (!emblaApi) return;
    emblaApi.reInit({ watchDrag: !isGameActive });
  }, [emblaApi, isGameActive]);

  // Reset carousel to first slide when any filter changes
  useEffect(() => {
    if (emblaApi) {
      emblaApi.scrollTo(0, true);
    }
    setOpenedAlbums(new Set());
  }, [emblaApi]);

  // Scroll to top when search results are loaded or dismissed
  useEffect(() => {
    if (!emblaApi) return;
    emblaApi.scrollTo(0, false); // animated scroll to reveal start of feed
  }, [emblaApi, displayItems.length]);

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
    | { type: 'envelope' }
    | { type: 'pack_reveal' }
    | { type: 'auth_cta' }
    | { type: 'postcard'; item: FeedItem; index: number; isFirstShared?: boolean };

  const slides = React.useMemo((): SlideEntry[] => {
    const arr: SlideEntry[] = [];

    // ── Envelope slide (pack available, not yet opened) ──
    if (isPackAvailable && !isPackMode) {
      arr.push({ type: 'envelope' });
    }

    // ── Pack reveal: single slide with all cards fanned ──
    if (isPackMode) {
      arr.push({ type: 'pack_reveal' });
    }

    // ── Normal feed follows ──
    const cardsToRender = user ? staggeredItems : staggeredItems.slice(0, FREE_CARD_LIMIT);

    if (showWelcome && !isPackMode) {
      if (hasSharedCard && cardsToRender.length > 0) {
        arr.push({ type: 'postcard', item: cardsToRender[0], index: 0, isFirstShared: true });
        arr.push({ type: 'welcome' });
        for (let i = 1; i < cardsToRender.length; i++) {
          arr.push({ type: 'postcard', item: cardsToRender[i], index: i });
        }
      } else {
        arr.push({ type: 'welcome' });
        for (let i = 0; i < cardsToRender.length; i++) {
          arr.push({ type: 'postcard', item: cardsToRender[i], index: i });
        }
      }
    } else {
      for (let i = 0; i < cardsToRender.length; i++) {
        arr.push({ type: 'postcard', item: cardsToRender[i], index: i });
      }
    }

    if (!user && cardsToRender.length > 0) {
      arr.push({ type: 'auth_cta' });
    }

    return arr;
  }, [staggeredItems, showWelcome, hasSharedCard, isPackMode, isPackAvailable, user]);

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
        // Fallback: if user manually swipes down, we mark it seen
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
          newUrl = `/feed/country/${countrySlug}#${hash}`;
        }

        window.history.replaceState(null, '', newUrl);
      }

      if (itemIndex >= items.length - 2) {
        if (hasMore && !isFetchingRef.current && user) {
          fetchMoreFeed();
        }
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
      if (isGameActiveRef.current) return; // 🔒 locked during game
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
      if (isGameActiveRef.current) return; // 🔒 locked during game
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

  // ── Listen for game-complete → next-card event ──
  useEffect(() => {
    const handleNextCard = () => {
      if (emblaApi) emblaApi.scrollNext();
    };
    window.addEventListener('postalpeek:next-card', handleNextCard);
    return () => window.removeEventListener('postalpeek:next-card', handleNextCard);
  }, [emblaApi]);

  // ── Global ambient background: derive URL from current active slide ──
  const ambientUrl = useMemo(() => {
    const slide = slides[currentSlideIndex];
    if (!slide) return null;
    if (slide.type === 'welcome' || slide.type === 'envelope' || slide.type === 'pack_reveal' || slide.type === 'auth_cta') return null;
    const item = slide.item;
    return cdnImage(item.illustration_url, { width: WIDTHS.blur, quality: 50 }) || null;
  }, [slides, currentSlideIndex]);

  // Keep track of previous ambient URL for crossfade

  const handleStartOnboarding = useCallback(() => {
    markWelcomeSeen();
    setShowWelcome?.(false);
    addLocalStamps(50);
    analytics.track('welcome_onboarding_started', { initial_stamps: 50 });
    
    if (emblaApi) {
      emblaApi.scrollNext();
    }
  }, [addLocalStamps, emblaApi, setShowWelcome]);

  return (
    <div className='absolute inset-0 w-full h-full overflow-hidden'>
      <AmbientBackground imageUrl={ambientUrl} />

      <div
        className='embla absolute inset-0 w-full h-full overflow-hidden z-[1]'
        ref={emblaRef}
        onWheel={handleWheel}
      >
      <div className='embla__container h-full flex flex-col'>
        {slides.map((slide, slideIndex) => {
          if (slide.type === 'envelope') {
            return (
              <div
                key='envelope-slide'
                className='embla__slide w-full h-[100dvh] shrink-0 flex items-center justify-center relative'
              >
                <EnvelopeSlide
                  isLoading={isPackLoading}
                  onOpen={onOpenPack || (() => {})}
                />
              </div>
            );
          }

          if (slide.type === 'welcome') {
            return (
              <div key="welcome-slide" className='embla__slide w-full h-[100dvh] shrink-0 flex items-center justify-center relative'>
                {USE_NEW_WELCOME ? (
                  <WalkerWelcomeAnimated previewCards={staggeredItems.slice(0, 3)} onStartOnboarding={handleStartOnboarding} />
                ) : (
                  <WalkerWelcome previewCards={staggeredItems.slice(0, 3)} />
                )}
              </div>
            );
          }

          /* ── Pack reveal slide ── */
          if (slide.type === 'pack_reveal') {
            return (
              <div
                key='pack-reveal-slide'
                className='embla__slide w-full h-[100dvh] shrink-0 flex items-center justify-center relative'
              >
                <PackRevealSlide
                  cards={packCards}
                  albumPostcardIds={albumPostcardIds}
                  onAllCollected={() => onPackComplete?.()}
                />
              </div>
            );
          }


          /* ── Auth CTA slide (guests only) ── */
          if (slide.type === 'auth_cta') {
            return (
              <div
                key='auth-cta-slide'
                className='embla__slide w-full h-[100dvh] shrink-0 flex flex-col items-center justify-start relative overflow-y-auto bg-[#e6e2da]'
              >
                <div className="w-full flex-grow min-h-screen">
                  <AuthCTASection onSuccess={() => window.location.reload()} viewedItems={items} />
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
                    className='mx-auto flex items-center justify-center'
                    style={{ 
                      aspectRatio: '4/5',
                      width: `min(95vw, 520px, 80dvh * ${4/5})`
                    }}
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
                className='z-10 mx-auto flex items-center justify-center transition-all duration-500 ease-in-out'
                style={{ 
                  aspectRatio: isGameActive && slideIndex === currentSlideIndex ? '9/16' : '4/5',
                  width: `min(95vw, 520px, 80dvh * ${isGameActive && slideIndex === currentSlideIndex ? 9/16 : 4/5})`
                }}
              >
                <div 
                  className='relative w-full h-full flex flex-col'
                >
                <AnimatePresence mode='wait'>
                  {item.album_id && !openedAlbums.has(item.album_id) ? (
                    <motion.div
                      key={`cover-${item.album_id}`}
                      className='w-full h-full flex items-center justify-center overflow-hidden bg-white'
                      style={{
                        boxShadow: '0 8px 30px rgba(0,0,0,0.12), inset 0 0 0 1px rgba(0,0,0,0.05)',
                        padding: '8px 8px 32px 8px',
                        borderRadius: '12px',
                      }}
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
                        isActive={slideIndex === currentSlideIndex}
                        isPriority={slideIndex === currentSlideIndex || (slideIndex - currentSlideIndex) === 1 || !!isFirstShared}
                        isAdmin={isAdmin}
                        favoriteIds={favoriteIds}
                        onToggleFavorite={user ? toggleFavorite : undefined}
                        isClaimedByMe={claimedIds.has(item.id)}
                        hasOwner={!!item.owner_id || claimedIds.has(item.id)}
                        onClaimPostcard={user ? onClaimPostcard : undefined}
                        isClaimLoading={isClaimLoading}
                        isInAlbum={albumPostcardIds.has(item.id)}
                        showClaimGuide={showWelcome && claimedIds.size === 0 && itemIndex === 0}
                        userId={user?.id}
                        onOpenAlbum={(albumId) => {
                          analytics.track('postcard_album_icon_clicked', { album_id: albumId, postcard_id: item.id });
                          navigate(`/album/${albumId}`);
                        }}
                        onOpenCollection={() => {
                          analytics.track('postcard_collection_auto_navigated', { postcard_id: item.id });
                          navigate('/feed/collection');
                        }}
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

        {isFetchingMore && user && (
          <div className='embla__slide w-full h-[30vh] shrink-0 flex items-center justify-center relative'>
            <Loader2 className='w-6 h-6 text-indigo-900/50 animate-spin' />
          </div>
        )}
      </div>

      {/* Pack summary overlay removed — handled by PackDoneToast in WalkerFeed */}
      </div>
    </div>
  );
}


import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import useEmblaCarousel from 'embla-carousel-react';
import { encodeUuidToHash } from '@eb-packages/logic/src/hash';
import { analytics } from '../lib/analytics';
import { Postcard, FeedItem } from './Postcard';
import { WalkerWelcome } from './WalkerWelcome';
import { markWelcomeSeen } from '../utils/welcomeStorage';
import { cdnImage, WIDTHS } from '../utils/imageUtils';
import type { User } from '@supabase/supabase-js';

const FREE_CARD_LIMIT = 5;
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
  showFavoritesOnly: boolean;
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
  showFavoritesOnly,
}: WalkerCarouselProps) {
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [lookaheadOffset, setLookaheadOffset] = useState(1);

  const [staggeredItems, setStaggeredItems] = useState<FeedItem[]>(() => displayItems.slice(0, 2));
  const [prevDisplayItems, setPrevDisplayItems] = useState<FeedItem[]>(displayItems);

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

  // Reset carousel to first slide when favorites filter changes
  useEffect(() => {
    if (emblaApi) {
      emblaApi.scrollTo(0, true);
    }
  }, [showFavoritesOnly, emblaApi]);

  useEffect(() => {
    if (displayItems.length === 0) return;
    
    if (staggeredItems.length < displayItems.length) {
      const timer = setTimeout(() => {
        setStaggeredItems(displayItems);
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [displayItems, staggeredItems.length]);

  const indexOffset = showWelcome ? 1 : 0;

  useEffect(() => {
    if (!emblaApi) return;

    const onSelect = () => {
      const currentIndex = emblaApi.selectedScrollSnap();
      setCurrentSlideIndex(currentIndex);

      if (showWelcome && currentIndex === 0) {
        setIsOnWelcome(true);
        return;
      } else if (showWelcome) {
        setIsOnWelcome(false);
      }

      if (showWelcome && currentIndex >= 1) {
        markWelcomeSeen();
      }

      const itemIndex = currentIndex - indexOffset;

      if (itemIndex >= 0 && itemIndex < items.length) {
        const activeItem = items[itemIndex];
        const hash = encodeUuidToHash(activeItem.id);

        analytics.track('postcard_viewed', {
          postcard_id: activeItem.id,
          country: activeItem.country,
          city: activeItem.city,
          category: activeItem.category,
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
            category: c.category,
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
    indexOffset,
    setIsOnWelcome,
    setShowAuthGate,
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
        // React synthetic wheel events are passive, so preventDefault() throws a warning.
        // Since the container is overflow-hidden, native scrolling doesn't happen anyway.
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

  return (
    <div
      className='embla absolute inset-0 w-full h-full overflow-hidden'
      ref={emblaRef}
      onWheel={handleWheel}
    >
      <div className='embla__container h-full flex flex-col'>
        {showWelcome && (
          <div className='embla__slide w-full h-[100dvh] shrink-0 flex items-center justify-center relative'>
            <WalkerWelcome previewCards={staggeredItems.slice(0, 3)} />
          </div>
        )}

        {staggeredItems.map((item, index) => {
          const slideIndex = index + indexOffset;
          const difference = slideIndex - currentSlideIndex;
          const isNearby = difference >= -1 && difference <= lookaheadOffset;

          return (
            <div
              key={`${item.id}-${index}`}
              className='embla__slide w-full h-[100dvh] shrink-0 flex items-center justify-center relative'
            >
              {isNearby && (
                <img
                  src={cdnImage(item.illustration_url, {
                    width: WIDTHS.blur,
                    quality: 50,
                  })}
                  alt=''
                  loading='lazy'
                  decoding='async'
                  className='absolute inset-0 w-full h-full object-cover blur-[100px] brightness-125 saturate-[0.8] pointer-events-none z-0 scale-125 transform-gpu'
                />
              )}
              <div className='absolute inset-0 z-[1] pointer-events-none bg-radial-gradient from-white/40 via-transparent to-transparent opacity-80' />

              <div className='z-10 w-full h-full flex items-center justify-center'>
                <Postcard
                  item={item}
                  isActive={true}
                  isPriority={
                    slideIndex === currentSlideIndex || difference === 1
                  }
                  isAdmin={isAdmin}
                  isNearby={isNearby}
                  favoriteIds={favoriteIds}
                  onToggleFavorite={user ? toggleFavorite : undefined}
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
                              category: c.category,
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
    </div>
  );
}

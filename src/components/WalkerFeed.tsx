import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase } from '@eb-packages/logic/src/supabase';
import { Loader2 } from 'lucide-react';
import { Postcard, FeedItem } from './Postcard';
import {
  decodeHashToUuidPrefix,
  encodeUuidToHash,
} from '@eb-packages/logic/src/hash';
import useEmblaCarousel from 'embla-carousel-react';
import { WalkerFilterMenu } from './WalkerFilterMenu';
import { WalkerLoadingState, WalkerEmptyState, WalkerFavoritesEmptyState } from './WalkerFeedStates';
import { AuthGateModal } from './AuthGateModal';
import { WalkerWelcome } from './WalkerWelcome';
import { hasSeenWelcome, markWelcomeSeen } from '../utils/welcomeStorage';
import { cdnImage, WIDTHS, preSignUrls } from '../utils/imageUtils';

import { analytics } from '../lib/analytics';
import { useFavorites } from '@eb-packages/logic/src/hooks/useFavorites';
import type { User } from '@supabase/supabase-js';

/** Number of free postcards before the auth gate kicks in */
const FREE_CARD_LIMIT = 5;
const AUTH_GATE_KEY = 'postalpeek_auth_gate';
const AUTH_GATE_CARDS_KEY = 'postalpeek_auth_cards';



export function WalkerFeed({
  isIdle,
  isAdmin = false,
  user = null,
  onWelcomeChange,
}: {
  isIdle?: boolean;
  isAdmin?: boolean;
  user?: User | null;
  onWelcomeChange?: (isOnWelcome: boolean) => void;
}) {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [availableCountries, setAvailableCountries] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAuthGate, setShowAuthGate] = useState(() => {
    // If the gate was previously triggered this session and user is still not logged in, show it immediately
    return !user && sessionStorage.getItem(AUTH_GATE_KEY) === 'true';
  });
  const [pendingFavoriteId, setPendingFavoriteId] = useState<string | null>(null);
  const [showWelcome] = useState(() => !hasSeenWelcome());
  const [isOnWelcome, setIsOnWelcome] = useState(showWelcome);

  // Notify parent when welcome state changes
  useEffect(() => {
    onWelcomeChange?.(isOnWelcome);
  }, [isOnWelcome, onWelcomeChange]);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);

  // Favorites management
  const { favoriteIds, favoriteItems, toggle: toggleFavorite } = useFavorites(user ?? null);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  // Reset favorites filter when user logs out
  useEffect(() => {
    if (!user) setShowFavoritesOnly(false);
  }, [user]);

  // Idle Prefetching State
  const [lookaheadOffset, setLookaheadOffset] = useState(2);

  // Derived display items: when favorites filter is active, show server-fetched favorites
  const displayItems = useMemo(() => {
    if (!showFavoritesOnly) return items;
    return favoriteItems;
  }, [items, showFavoritesOnly, favoriteItems]);

  // Staggered Render State for Initial Load Performance
  // We only mount the first 2 items instantly to get a blazing fast LCP.
  // The rest are mounted 150ms later to unblock the main JavaScript thread.
  const [staggeredItems, setStaggeredItems] = useState<FeedItem[]>([]);

  useEffect(() => {
    if (displayItems.length === 0) {
      setStaggeredItems([]);
      return;
    }

    // Instantly show the first 2 items (or fewer if we don't have 2)
    setStaggeredItems(displayItems.slice(0, 2));

    // Wait for the browser to paint those 2 items, then render the rest
    const timer = setTimeout(() => {
      setStaggeredItems(displayItems);
    }, 150); // 150ms gives React enough time to finish the first paint

    return () => clearTimeout(timer);
  }, [displayItems]);

  // Offset for carousel indices when welcome slide is present
  const indexOffset = showWelcome ? 1 : 0;

  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const loadedIdsRef = useRef<string[]>([]);
  const isFetchingRef = useRef(false);

  const currentFetchIdRef = useRef(0); // Track active fetch to prevent race conditions
  const prefetchCacheRef = useRef<Map<string | '__everywhere__', FeedItem[]>>(new Map());

  // Parse Initial URL State (Slugs instead of query params)
  useEffect(() => {
    // Expected formats:
    // / (Everywhere, normal feed)
    // /QywJ9rK (Everywhere, shared card feed starting at QywJ9rK)
    // /japan (Japan, normal feed)
    // /japan/QywJ9rK (Japan, shared card feed starting at QywJ9rK)

    const segments = window.location.pathname.split('/').filter(Boolean);

    // We need to differentiate between a hash and a country.
    // A Hashids encoded block is unlikely to match a country name exactly.
    // We'll set the country if the first segment exists AND it's not a known hash format (or just wait for availableCountries to load)
    // To make it simple: if there are 2 segments, segment 0 is country, segment 1 is hash.
    // If there is 1 segment, if it has mixed casing/numbers it might be a hash.
    // For safety, let's decode the *first* segment to see if it's a valid hash prefix. If decodeHashToUuidPrefix returns a valid hex, it's a hash.
    // Actually decodeHashToUuidPrefix is quite lenient. Better approach: countries usually don't have numbers.

    if (segments.length === 2) {
      // /country/hash
      const decodedCountry = decodeURIComponent(segments[0]).replace(/-/g, ' ');
      setSelectedCountry(decodedCountry);
    } else if (segments.length === 1) {
      // /country OR /hash
      // Try to decode as a Hashids hash first. If it returns a valid hex prefix,
      // this segment is a shared-card hash. Otherwise treat it as a country slug.
      const segment = segments[0];
      const maybePrefix = decodeHashToUuidPrefix(segment);
      const isValidHex = maybePrefix !== null && /^[0-9a-f]{8}$/i.test(maybePrefix);

      if (!isValidHex && segment.length > 0) {
        const decodedCountry = decodeURIComponent(segment).replace(
          /-/g,
          ' ',
        );
        setSelectedCountry(decodedCountry);
      }
      // If isValidHex is true, it's a hash — selectedCountry stays null,
      // and fetchInitialFeed will pick it up from the URL path.
    }
  }, []);

  // Default block size
  const PAGE_SIZE = 10;

  // Initialize Embla Carousel with vertical axis, no internal wheel plugin
  const [emblaRef, emblaApi] = useEmblaCarousel({
    axis: 'y',
    align: 'start',
    skipSnaps: false,
    duration: 30, // Make the programmatic snap slightly faster
    watchSlides: true, // Let Embla handle newly added items automatically
  });

  // Reset carousel to first slide when favorites filter changes
  useEffect(() => {
    if (emblaApi) {
      emblaApi.scrollTo(0, true); // instant jump, no animation
    }
    setCurrentSlideIndex(0);
  }, [showFavoritesOnly, emblaApi]);

  // Fetch unique locations and extract just the countries for the filter menu
  useEffect(() => {
    async function fetchCountries() {
      try {
        const { data, error } = await supabase.rpc(
          'postalpeek_get_distinct_countries',
        );
        if (!error && data) {
          // data is [{ country: 'Japan' }, { country: 'France' }, ...]
          setAvailableCountries(data.map((row: any) => row.country));
        }
      } catch (err) {
        console.error('Failed to load distinct countries', err);
        analytics.captureError(err, { context: 'fetch_countries' });
      }
    }
    fetchCountries();
  }, []);

  const fetchInitialFeed = useCallback(async (country: string | null) => {
    const fetchId = ++currentFetchIdRef.current;
    isFetchingRef.current = true;

    // Check prefetch cache first
    const cacheKey = country ?? '__everywhere__';
    const cached = prefetchCacheRef.current.get(cacheKey);
    if (cached && cached.length > 0) {
      prefetchCacheRef.current.delete(cacheKey);
      loadedIdsRef.current = cached.map(item => item.id);
      // Pre-sign URLs for cached items
      await preSignUrls(cached.flatMap(i => [i.illustration_url, i.original_image_url].filter(Boolean)));
      setItems(cached);
      setHasMore(cached.length === PAGE_SIZE);
      setIsLoading(false);
      isFetchingRef.current = false;

      return;
    }

    setIsLoading(true);
    try {
      const segments = window.location.pathname.split('/').filter(Boolean);
      let sharedCardPrefix = null;

      // Extract the hash from the path depending on if a country slug is present
      if (segments.length === 2 && country) {
        const decodedSegment = decodeURIComponent(segments[0]).replace(
          /-/g,
          ' ',
        );
        if (decodedSegment === country) {
          sharedCardPrefix = decodeHashToUuidPrefix(segments[1]);
        }
      } else if (segments.length === 1) {
        const decodedSegment = decodeURIComponent(segments[0]).replace(
          /-/g,
          ' ',
        );
        if (country && decodedSegment === country) {
          sharedCardPrefix = null;
        } else {
          sharedCardPrefix = decodeHashToUuidPrefix(segments[0]);
        }
      }

      let sharedCard: FeedItem | null = null;

      if (sharedCardPrefix) {
        const minUuid = `${sharedCardPrefix}-0000-0000-0000-000000000000`;
        const maxUuid = `${sharedCardPrefix}-ffff-ffff-ffff-ffffffffffff`;

        const { data: sharedData, error: sharedError } = await supabase
          .from('postalpeek_postcards')
          .select('*')
          .gte('id', minUuid)
          .lte('id', maxUuid)
          .limit(1)
          .single();

        if (!sharedError && sharedData) {
          sharedCard = sharedData;
        } else if (sharedError) {
          console.error('Failed to load shared card:', sharedError);
        }
      }

      // Exclude the shared card from the random pool so it doesn't appear twice
      const excludeIds = sharedCard ? [sharedCard.id] : [];

      const { data, error } = await supabase.rpc('postalpeek_get_random_feed', {
        p_limit: PAGE_SIZE,
        p_country: country,
        p_exclude_ids: excludeIds,
      });

      if (fetchId !== currentFetchIdRef.current) return;
      if (error) throw error;

      const fetchedItems: FeedItem[] = (data as FeedItem[]) || [];



      if (fetchedItems.length > 0) {
        loadedIdsRef.current = [
          ...excludeIds,
          ...fetchedItems.map((item) => item.id),
        ];
        setHasMore(fetchedItems.length === PAGE_SIZE);
      } else {
        loadedIdsRef.current = [...excludeIds];
        setHasMore(false);
      }

      if (sharedCard) {
        setItems([sharedCard, ...fetchedItems]);
      } else {
        setItems(fetchedItems);
      }

      // 1. Pre-sign URLs for the critical hero cards (up to 3) FIRST
      const allItems = sharedCard ? [sharedCard, ...fetchedItems] : fetchedItems;
      const heroItems = allItems.slice(0, 3);
      const heroUrls = heroItems.flatMap(i => [i.illustration_url].filter(Boolean));
      
      // Wait for the hero URLs to be signed
      await preSignUrls(heroUrls);

      // 2. Preload the exact thumbnail images into the browser cache
      // This guarantees the WalkerWelcome screen renders flawlessly with zero pops
      if (heroItems.length > 0) {
        await Promise.allSettled(
          heroItems.map(item => {
            if (!item.illustration_url) return Promise.resolve();
            return new Promise<void>((resolve) => {
              const img = new Image();
              // use the signed transform URL for the thumb size
              img.src = cdnImage(item.illustration_url, { width: WIDTHS.thumb });
              img.onload = () => resolve();
              img.onerror = () => resolve(); // still resolve to not block UI forever
            });
          })
        );
      }

      // 3. Kick off pre-signing for the rest of the batch non-blockingly
      const remainingUrls = allItems.slice(3)
        .flatMap(i => [i.illustration_url, i.original_image_url].filter(Boolean));
      preSignUrls(remainingUrls).catch(err => console.error('Failed to pre-sign URLs', err));

    } catch (error) {
      if (fetchId !== currentFetchIdRef.current) return;
      console.error('Error loading initial feed:', error);
      analytics.captureError(error, { context: 'fetch_initial_feed', country: country });
    } finally {
      if (fetchId === currentFetchIdRef.current) {
        setIsLoading(false);
        isFetchingRef.current = false;
      }
    }
  }, []);

  // Prefetch a country's feed on hover so data is instant when clicked
  const prefetchCountry = useCallback(async (country: string | null) => {
    const cacheKey = country ?? '__everywhere__';
    // Don't prefetch if already cached or if it's the current selection
    if (prefetchCacheRef.current.has(cacheKey) || country === selectedCountry) return;

    try {
      const { data } = await supabase.rpc('postalpeek_get_random_feed', {
        p_limit: PAGE_SIZE,
        p_country: country,
        p_exclude_ids: [],
      });
      if (data) {
        prefetchCacheRef.current.set(cacheKey, data as FeedItem[]);
        // Also preload the first few images
        (data as FeedItem[]).slice(0, 3).forEach((item: FeedItem) => {
          if (item.illustration_url) {
            const img = new Image();
            img.src = cdnImage(item.illustration_url, { width: WIDTHS.mobile });
          }
        });
      }
    } catch {
      // Silent fail — prefetch is best-effort
    }
  }, [selectedCountry]);

  const fetchMoreFeed = useCallback(async () => {
    if (isFetchingRef.current || !hasMore) return;

    const fetchId = ++currentFetchIdRef.current;
    isFetchingRef.current = true;
    setIsFetchingMore(true);
    try {
      const excludeIds = loadedIdsRef.current;

      const { data, error } = await supabase.rpc('postalpeek_get_random_feed', {
        p_limit: PAGE_SIZE,
        p_country: selectedCountry,
        p_exclude_ids: excludeIds,
      });

      if (fetchId !== currentFetchIdRef.current) return;

      if (error) throw error;

      const newItems = (data as FeedItem[]) || [];



      if (newItems.length > 0) {
        // Pre-sign URLs for new batch
        await preSignUrls(newItems.flatMap(i => [i.illustration_url, i.original_image_url].filter(Boolean)));
        loadedIdsRef.current = [
          ...loadedIdsRef.current,
          ...newItems.map((item) => item.id),
        ];
        setItems((prev) => [...prev, ...newItems]);
        setHasMore(newItems.length === PAGE_SIZE);
      } else {
        setHasMore(false);
      }
    } catch (error) {
      if (fetchId !== currentFetchIdRef.current) return;
      console.error('Error fetching more feed:', error);
      analytics.captureError(error, { context: 'fetch_more_feed', country: selectedCountry });
    } finally {
      if (fetchId === currentFetchIdRef.current) {
        setIsFetchingMore(false);
        isFetchingRef.current = false;
      }
    }
  }, [hasMore, selectedCountry]);

  // Initial load when filter changes
  useEffect(() => {
    fetchInitialFeed(selectedCountry);
  }, [fetchInitialFeed, selectedCountry]);

  // Realtime Subscription
  useEffect(() => {
    let mounted = true;

    const subscription = supabase
      .channel('public:postalpeek_postcards')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'postalpeek_postcards' },
        (payload) => {
          if (mounted) {
            const newItem = payload.new as FeedItem;
            // Only prepend if it matches the current country filter (or no filter is set)
            if (!selectedCountry || newItem.country === selectedCountry) {
              // Pre-sign URLs for new realtime item (fire and forget)
              preSignUrls([newItem.illustration_url, newItem.original_image_url].filter(Boolean));
              setItems((prev) => [newItem, ...prev]);
            }
          }
        },
      )
      .subscribe();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [selectedCountry]);

  // Embla specific infinite scroll listener and URL history syncing
  useEffect(() => {
    if (!emblaApi) return;

    const onSelect = () => {
      // Find the current active item based on the selected slide
      const currentIndex = emblaApi.selectedScrollSnap();
      setCurrentSlideIndex(currentIndex);

      // If still on the welcome slide, nothing to do
      if (showWelcome && currentIndex === 0) {
        setIsOnWelcome(true);
        return;
      } else if (showWelcome) {
        setIsOnWelcome(false);
      }

      // Mark welcome as seen once user scrolls past it
      if (showWelcome && currentIndex >= 1) {
        markWelcomeSeen();
      }

      // Adjusted index accounting for the welcome slide
      const itemIndex = currentIndex - indexOffset;

      // Update the URL path to reflect the current item being viewed without full re-render
      if (itemIndex >= 0 && itemIndex < items.length) {
        const activeItem = items[itemIndex];
        const hash = encodeUuidToHash(activeItem.id);

        // Track postcard view and mark as seen
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

      // If we are at the last or penultimate slide, fetch more
      if (itemIndex >= items.length - 2) {
        if (hasMore && !isFetchingRef.current) {
          fetchMoreFeed();
        }
      }

      // Auth gate: if unauthenticated and past the free limit, lock
      if (!user && itemIndex >= FREE_CARD_LIMIT - 1) {
        setShowAuthGate(true);
        sessionStorage.setItem(AUTH_GATE_KEY, 'true');
        // Cache hero cards so images are instant on refresh
        try {
          const heroCards = items.slice(0, 3).map(c => ({
            id: c.id, illustration_url: c.illustration_url,
            city: c.city, country: c.country, category: c.category,
          }));
          sessionStorage.setItem(AUTH_GATE_CARDS_KEY, JSON.stringify(heroCards));
        } catch { /* quota exceeded — no big deal */ }
        // Reset URL so no hash lingers behind the auth gate
        window.history.replaceState(null, '', '/');
        analytics.track('auth_gate_shown', { items_viewed: itemIndex + 1 });
      }
    };

    emblaApi.on('select', onSelect);
    // We remove the 'scroll' listener for URL updates because it fires every frame during drag/wheel,
    // which triggers history.replaceState too often and can significantly slow down the browser or carousel.
    // 'select' only fires when the snap point actually changes, which is perfect for URL syncing.

    return () => {
      emblaApi.off('select', onSelect);
    };
  }, [emblaApi, hasMore, fetchMoreFeed, items, selectedCountry, user, showWelcome, indexOffset]);

  // Preload the next 2 slides illustrations so they are ready before the user scrolls
  useEffect(() => {
    const preloadAhead = 2; // load up to 2 items ahead
    for (let i = 1; i <= preloadAhead; i++) {
        const nextItemIndex = currentSlideIndex - indexOffset + i;
        const nextItem = items[nextItemIndex];
        if (!nextItem?.illustration_url) continue;

        const url = cdnImage(nextItem.illustration_url, { width: WIDTHS.desktop });
        
        // Only preload if not already in document to prevent duplicates
        if (!document.querySelector(`link[rel="preload"][href="${url}"]`)) {
            const link = document.createElement('link');
            link.rel = 'preload';
            link.as = 'image';
            link.href = url;
            document.head.appendChild(link);
            
            // Clean up old preloads might be too aggressive, leaving them attached for now
            // NextJS and Vite generally leave them
        }
    }
  }, [currentSlideIndex, items, indexOffset, lookaheadOffset]);

  // Expand the lookahead window when the user stays idle on a card
  useEffect(() => {
    // Reset back to standard 2-slide lookahead when we scroll to a new slide
    setLookaheadOffset(2);

    // If we're resting on a slide, wait 1.5s then aggressively prefetch the next 5
    const timer = setTimeout(() => {
      setLookaheadOffset(5);
    }, 1500);

    return () => clearTimeout(timer);
  }, [currentSlideIndex]);

  // Shared debounce ref for both wheel and keyboard navigation.
  // We use a strict time-based debounce to handle high-precision
  // free-spinning mouse wheels (like the MX Master). This ensures that a single tick
  // forces a full 1-item jump via Embla API, without Embla interpreting it as a drag.
  const navTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scrollWithDebounce = useCallback(
    (direction: 'next' | 'prev') => {
      if (!emblaApi || navTimeout.current) return;

      if (direction === 'next') {
        emblaApi.scrollNext();
      } else {
        emblaApi.scrollPrev();
      }

      // Lock out further events for 600ms to allow the slide animation to finish cleanly
      navTimeout.current = setTimeout(() => {
        navTimeout.current = null;
      }, 600);
    },
    [emblaApi],
  );

  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      // Only capture vertical scrolling over horizontal
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        if (!emblaApi) return;

        // Stop the native scroll
        e.preventDefault();

        // Ignore very small movements (trackpad noise)
        if (Math.abs(e.deltaY) < 5) return;

        scrollWithDebounce(e.deltaY > 0 ? 'next' : 'prev');
      }
    },
    [emblaApi, scrollWithDebounce],
  );

  // Keyboard navigation: ArrowUp/ArrowDown (and j/k vim-style)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't capture if user is typing in an input/textarea
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
    <div className='w-full h-full flex flex-col items-center justify-center relative bg-[#e6e2da] overflow-hidden'>
      {!isOnWelcome && (
        <WalkerFilterMenu
        isIdle={isIdle}
        availableCountries={availableCountries}
        selectedCountry={selectedCountry}
        showFavoritesOnly={showFavoritesOnly}
        onToggleFavorites={() => {
          setShowFavoritesOnly((prev) => {
            const next = !prev;
            analytics.track('filter_changed', { favorites_only: next });
            return next;
          });
        }}
        isLoggedIn={!!user}
        onHoverCountry={prefetchCountry}
        onSelectCountry={(country) => {
          // If country hasn't changed, just clear favorites filter — data is already loaded
          if (country === selectedCountry) {
            setShowFavoritesOnly(false);
            return;
          }
          // Turn off favorites filter when switching countries
          setShowFavoritesOnly(false);
          // Clear state immediately to show loader and prevent stale feed
          setIsLoading(true);
          setCurrentSlideIndex(0);
          loadedIdsRef.current = [];

          isFetchingRef.current = false;

          setSelectedCountry((prev) => {
            analytics.track('filter_changed', {
              previous_country: prev,
              country: country,
            });
            return country;
          });

          if (country === null) {
            window.history.pushState({}, '', '/');
          } else {
            const countrySlug = encodeURIComponent(country).replace(
              /%20/g,
              '-',
            );
            window.history.pushState({}, '', `/${countrySlug}`);
          }
        }}
      />
      )}

      {isLoading ? (
        <WalkerLoadingState />
      ) : displayItems.length === 0 ? (
        showFavoritesOnly ? <WalkerFavoritesEmptyState /> : <WalkerEmptyState />
      ) : (
        <div
          className='embla absolute inset-0 w-full h-full overflow-hidden'
          ref={emblaRef}
          onWheel={handleWheel}
        >
          <div className='embla__container h-full flex flex-col'>
            {/* Walker Welcome — first slide for new visitors */}
            {showWelcome && (
              <div className='embla__slide w-full h-[100dvh] shrink-0 flex items-center justify-center relative'>
                <WalkerWelcome previewCards={staggeredItems.slice(0, 3)} />
              </div>
            )}

            {staggeredItems.map((item, index) => {
              // Slide index accounting for the optional welcome slide
              const slideIndex = index + indexOffset;
              // Render 1 slide backwards (above) and dynamic slides forwards (up to 5 if resting)
              const difference = slideIndex - currentSlideIndex;
              const isNearby = difference >= -1 && difference <= lookaheadOffset;

              return (
                <div
                  key={`${item.id}-${index}`}
                  className='embla__slide w-full h-[100dvh] shrink-0 flex items-center justify-center relative'
                >
                  {/* 1. THE ENVIRONMENT LIGHTING — only mount for nearby slides */}
                  {isNearby && (
                    <img
                      src={cdnImage(item.illustration_url, { width: WIDTHS.blur, quality: 50 })}
                      alt=''
                      loading='lazy'
                      decoding='async'
                      className='absolute inset-0 w-full h-full object-cover blur-[100px] brightness-125 saturate-[0.8] pointer-events-none z-0 scale-125 transform-gpu'
                    />
                  )}
                  {/* Soft light burst in center behind card */}
                  <div className='absolute inset-0 z-[1] pointer-events-none bg-radial-gradient from-white/40 via-transparent to-transparent opacity-80' />

                  {/* 2. THE POSTCARD */}
                  <div className='z-10 w-full h-full flex items-center justify-center'>
                    <Postcard
                      item={item}
                      isActive={true}
                      isPriority={slideIndex === currentSlideIndex || difference === 1}
                      isAdmin={isAdmin}
                      isNearby={isNearby}
                      favoriteIds={favoriteIds}
                      onToggleFavorite={user ? toggleFavorite : undefined}
                      onAuthRequired={!user ? (postcardId) => {
                        setPendingFavoriteId(postcardId);
                        setShowAuthGate(true);
                        sessionStorage.setItem(AUTH_GATE_KEY, 'true');
                        try {
                          const heroCards = items.slice(0, 3).map(c => ({
                            id: c.id, illustration_url: c.illustration_url,
                            city: c.city, country: c.country, category: c.category,
                          }));
                          sessionStorage.setItem(AUTH_GATE_CARDS_KEY, JSON.stringify(heroCards));
                        } catch { /* quota exceeded */ }
                        analytics.track('auth_gate_shown', { trigger: 'favorite', postcard_id: postcardId });
                      } : undefined}
                    />
                  </div>
                </div>
              );
            })}

            {/* Loading indicator at bottom */}
            {isFetchingMore && (
              <div className='embla__slide w-full h-[30vh] shrink-0 flex items-center justify-center relative'>
                <Loader2 className='w-6 h-6 text-indigo-900/50 animate-spin' />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Auth Gate — blocks further scrolling for unauthenticated users */}
      {showAuthGate && (
        <AuthGateModal
          onSuccess={() => {
            setShowAuthGate(false);
            sessionStorage.removeItem(AUTH_GATE_KEY);
            sessionStorage.removeItem(AUTH_GATE_CARDS_KEY);
            // Auto-save the pending favorite after successful auth
            if (pendingFavoriteId) {
              // Small delay to let auth state propagate
              setTimeout(() => {
                toggleFavorite(pendingFavoriteId);
                setPendingFavoriteId(null);
              }, 500);
            }
          }}
          viewedItems={
            items.length > 0
              ? items.slice(0, FREE_CARD_LIMIT)
              : (() => {
                  // On refresh, items may still be loading — use cached cards
                  try {
                    const cached = sessionStorage.getItem(AUTH_GATE_CARDS_KEY);
                    return cached ? JSON.parse(cached) : [];
                  } catch { return []; }
                })()
          }
        />
      )}
    </div>
  );
}

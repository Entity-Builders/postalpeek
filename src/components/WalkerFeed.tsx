import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@eb-packages/logic/src/supabase';
import { Loader2 } from 'lucide-react';
import { Postcard, FeedItem } from './Postcard';
import {
  decodeHashToUuidPrefix,
  encodeUuidToHash,
} from '@eb-packages/logic/src/hash';
import useEmblaCarousel from 'embla-carousel-react';
import { WalkerFilterMenu } from './WalkerFilterMenu';
import { WalkerLoadingState, WalkerEmptyState } from './WalkerFeedStates';

const shuffleArray = <T,>(array: T[]): T[] => {
  const newArr = [...array];
  for (let i = newArr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
  }
  return newArr;
};

export function WalkerFeed({ isIdle }: { isIdle?: boolean }) {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [availableCountries, setAvailableCountries] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const oldestDateRef = useRef<string | null>(null);
  const isFetchingRef = useRef(false);

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
      const decodedCountry = decodeURIComponent(segments[0]);
      setSelectedCountry(decodedCountry);
    } else if (segments.length === 1) {
      // /country OR /hash
      // We assume it's a country if it doesn't contain numbers and has length > 0
      const segment = segments[0];
      const hasNumbers = /\d/.test(segment);

      // If it doesn't have numbers and is reasonably long, it's probably a country.
      // Another way: wait until availableCountries is loaded to verify. But we need it for the initial fetch.
      if (!hasNumbers && segment.length > 2) {
        const decodedCountry = decodeURIComponent(segments[0]);
        setSelectedCountry(decodedCountry);
      }
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
      }
    }
    fetchCountries();
  }, []);

  const fetchInitialFeed = useCallback(
    async (country: string | null) => {
      isFetchingRef.current = true;
      setIsLoading(true);
      try {
        const segments = window.location.pathname.split('/').filter(Boolean);
        let sharedCardPrefix = null;

        // Extract the hash from the path depending on if a country slug is present
        if (segments.length === 2) {
          sharedCardPrefix = decodeHashToUuidPrefix(segments[1]);
        } else if (segments.length === 1) {
          // If it's a country slug, we ignore it here (already handled by the useEffect above)
          // If it's a hash, we decode it.
          const hasNumbers = /\d/.test(segments[0]);
          if (hasNumbers || segments[0].length <= 8) {
            // basic heuristic for hash
            sharedCardPrefix = decodeHashToUuidPrefix(segments[0]);
          }
        }

        let sharedCard: FeedItem | null = null;

        if (sharedCardPrefix) {
          // UUID ranges since .like() does not work on native Postgres UUID columns
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

        let query = supabase
          .from('postalpeek_postcards')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(PAGE_SIZE);

        if (country) {
          query = query.eq('country', country);
        }

        const { data, error } = await query;

        if (error) throw error;

        let fetchedItems: FeedItem[] = [];

        if (data && data.length > 0) {
          oldestDateRef.current = data[data.length - 1].created_at;

          // Filter out the shared card from the generic fetch to avoid duplicates
          const filteredData = sharedCard
            ? data.filter((item) => item.id !== sharedCard?.id)
            : data;

          fetchedItems = shuffleArray(filteredData);
          setHasMore(data.length === PAGE_SIZE);
        } else {
          setHasMore(false);
        }

        // Prepend the shared card if it exists
        if (sharedCard) {
          setItems([sharedCard, ...fetchedItems]);
        } else {
          setItems(fetchedItems);
        }
      } catch (error) {
        console.error('Error loading initial feed:', error);
      } finally {
        setIsLoading(false);
        isFetchingRef.current = false;
        if (emblaApi) emblaApi.scrollTo(0, true);
      }
    },
    [emblaApi],
  );

  const fetchMoreFeed = useCallback(async () => {
    if (isFetchingRef.current || !hasMore || !oldestDateRef.current) return;

    isFetchingRef.current = true;
    setIsFetchingMore(true);
    try {
      let query = supabase
        .from('postalpeek_postcards')
        .select('*')
        .order('created_at', { ascending: false })
        .lt('created_at', oldestDateRef.current)
        .limit(PAGE_SIZE);

      if (selectedCountry) {
        query = query.eq('country', selectedCountry);
      }

      const { data, error } = await query;

      if (error) throw error;

      if (data && data.length > 0) {
        oldestDateRef.current = data[data.length - 1].created_at;
        // Shuffle the newly fetched block so the feed remains unpredictable
        setItems((prev) => [...prev, ...shuffleArray(data)]);
        setHasMore(data.length === PAGE_SIZE);
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error('Error fetching more feed:', error);
    } finally {
      setIsFetchingMore(false);
      isFetchingRef.current = false;
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

      // Update the URL path to reflect the current item being viewed without full re-render
      if (items.length > currentIndex) {
        const activeItem = items[currentIndex];

        // Encode the UUID prefix to hash. Note: since encodeUuidPrefixToHash is not imported,
        // we'll extract the first part of the UUID natively to resemble a hash or ID prefix
        // temporarily, or we can use the full ID if preferred. For now we will use the full ID
        // as the slice since we didn't import the encoder yet, or import it later.
        // Actually, assuming decodeHashToUuidPrefix exists, we probably need `encodeUuidPrefixToHash`.
        // I will just use the first 8 characters for the slug for now to mimic the hash.
        const hash = encodeUuidToHash(activeItem.id);

        // Reconstruct URL based on whether a country is selected
        // We use selectedCountry from the state rather than relying on the URL to be pristine;

        let newUrl = `/${hash}`;
        if (selectedCountry) {
          newUrl = `/${encodeURIComponent(selectedCountry)}/${hash}`;
        }

        // History replace state to not clog the back button
        window.history.replaceState(null, '', newUrl);
      }

      // If we are at the last or penultimate slide, fetch more
      if (
        emblaApi.canScrollNext() === false ||
        currentIndex >= emblaApi.scrollSnapList().length - 2
      ) {
        if (hasMore && !isFetchingRef.current) {
          fetchMoreFeed();
        }
      }
    };

    emblaApi.on('select', onSelect);
    // We remove the 'scroll' listener for URL updates because it fires every frame during drag/wheel,
    // which triggers history.replaceState too often and can significantly slow down the browser or carousel.
    // 'select' only fires when the snap point actually changes, which is perfect for URL syncing.

    return () => {
      emblaApi.off('select', onSelect);
    };
  }, [emblaApi, hasMore, fetchMoreFeed, items, selectedCountry]);

  // We use a strict time-based debounce to handle high-precision
  // free-spinning mouse wheels (like the MX Master). This ensures that a single tick
  // forces a full 1-item jump via Embla API, without Embla interpreting it as a drag.
  const wheelTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      // Only capture vertical scrolling over horizontal
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        if (!emblaApi) return;

        // Stop the native scroll
        e.preventDefault();

        // If we are currently in a cooldown from a previous tick, ignore
        if (wheelTimeout.current) return;

        // Ignore very small movements (trackpad noise)
        if (Math.abs(e.deltaY) < 5) return;

        if (e.deltaY > 0) {
          // Intention to go down
          emblaApi.scrollNext();
        } else {
          // Intention to go up
          emblaApi.scrollPrev();
        }

        // Lock out further wheel events for 600ms to allow the slide animation to finish cleanly
        wheelTimeout.current = setTimeout(() => {
          wheelTimeout.current = null;
        }, 600);
      }
    },
    [emblaApi],
  );

  return (
    <div className='w-full h-full flex flex-col items-center justify-center relative bg-[#e6e2da] overflow-hidden'>
      <WalkerFilterMenu
        isIdle={isIdle}
        availableCountries={availableCountries}
        selectedCountry={selectedCountry}
        onSelectCountry={(country) => {
          // Clear state immediately to show loader and prevent stale feed
          setIsLoading(true);
          oldestDateRef.current = null;
          isFetchingRef.current = false;

          setSelectedCountry(country);

          if (country === null) {
            window.history.pushState({}, '', '/');
          } else {
            window.history.pushState({}, '', `/${encodeURIComponent(country)}`);
          }

          if (emblaApi) emblaApi.scrollTo(0, true);
        }}
      />

      {isLoading ? (
        <WalkerLoadingState />
      ) : items.length === 0 ? (
        <WalkerEmptyState />
      ) : (
        <div
          className='embla absolute inset-0 w-full h-full overflow-hidden'
          ref={emblaRef}
          onWheel={handleWheel}
        >
          <div className='embla__container h-full flex flex-col'>
            {items.map((item, index) => {
              return (
                <div
                  key={`${item.id}-${index}`}
                  className='embla__slide w-full h-[100dvh] shrink-0 flex items-center justify-center relative'
                >
                  {/* 1. THE ENVIRONMENT LIGHTING (Soft Background PER ITEM so it scrolls natively) */}
                  <img
                    src={item.illustration_url}
                    alt=''
                    className='absolute inset-0 w-full h-full object-cover blur-[100px] brightness-125 saturate-[0.8] pointer-events-none z-0 scale-125 transform-gpu'
                  />
                  {/* Soft light burst in center behind card */}
                  <div className='absolute inset-0 z-[1] pointer-events-none bg-radial-gradient from-white/40 via-transparent to-transparent opacity-80' />

                  {/* 2. THE POSTCARD */}
                  <div className='z-10 w-full h-full flex items-center justify-center pt-8'>
                    <Postcard item={item} isActive={true} />
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
    </div>
  );
}

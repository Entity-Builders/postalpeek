import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@eb-packages/logic/src/supabase';
import { decodeHashToUuidPrefix } from '@eb-packages/logic/src/hash';
import { analytics } from '../lib/analytics';
import { cdnImage, WIDTHS, preSignUrls } from '../utils/imageUtils';
import type { FeedItem } from '../components/Postcard';

const PAGE_SIZE = 10;

export function useWalkerFeed() {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [availableCountries, setAvailableCountries] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [hasSharedCard, setHasSharedCard] = useState(false);

  const loadedIdsRef = useRef<string[]>([]);
  const isFetchingRef = useRef(false);
  const currentFetchIdRef = useRef(0);
  const prefetchCacheRef = useRef<Map<string | '__everywhere__', FeedItem[]>>(new Map());

  // Parse Initial URL State (Slugs instead of query params)
  useEffect(() => {
    const segments = window.location.pathname.split('/').filter(Boolean);

    if (segments.length === 2) {
      // /country/hash
      const decodedCountry = decodeURIComponent(segments[0]).replace(/-/g, ' ');
      setSelectedCountry(decodedCountry);
    } else if (segments.length === 1) {
      // /country OR /hash
      const segment = segments[0];
      const maybePrefix = decodeHashToUuidPrefix(segment);
      const isValidHex = maybePrefix !== null && /^[0-9a-f]{8}$/i.test(maybePrefix);

      if (!isValidHex && segment.length > 0) {
        const decodedCountry = decodeURIComponent(segment).replace(/-/g, ' ');
        setSelectedCountry(decodedCountry);
      }
    }
  }, []);

  // Fetch unique locations and extract just the countries for the filter menu
  useEffect(() => {
    async function fetchCountries() {
      try {
        const { data, error } = await supabase.rpc('postalpeek_get_distinct_countries');
        if (!error && data) {
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
      loadedIdsRef.current = cached.map((item) => item.id);
      // Pre-sign URLs for cached items
      await preSignUrls(cached.flatMap((i) => [i.illustration_url, i.original_image_url].filter(Boolean)));
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

      if (segments.length === 2 && country) {
        const decodedSegment = decodeURIComponent(segments[0]).replace(/-/g, ' ');
        if (decodedSegment === country) {
          sharedCardPrefix = decodeHashToUuidPrefix(segments[1]);
        }
      } else if (segments.length === 1) {
        const decodedSegment = decodeURIComponent(segments[0]).replace(/-/g, ' ');
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

        // First, check if this prefix belongs to a share link
        const { data: shareData, error: shareError } = await supabase
          .from('postalpeek_shares')
          .select('id, postcard_id')
          .gte('id', minUuid)
          .lte('id', maxUuid)
          .eq('is_used', false)
          .limit(1)
          .single();

        let targetPostcardId: string | null = null;

        if (shareData && !shareError) {
          targetPostcardId = shareData.postcard_id;
          
          // Mark as used immediately (fire and forget)
          supabase
            .from('postalpeek_shares')
            .update({ is_used: true })
            .eq('id', shareData.id)
            .then(({ error }) => {
               if (error) console.error('Failed to mark share as used:', error);
            });
        }

        // Fetch the actual postcard data
        if (targetPostcardId) {
           const { data: pData, error: pError } = await supabase
            .from('postalpeek_postcards')
            .select('*')
            .eq('id', targetPostcardId)
            .single();
            
           if (pData && !pError) {
             sharedCard = pData;
             setHasSharedCard(true);
           } else {
             setHasSharedCard(false);
           }
        } else {
           // Fallback: Check if the prefix belongs directly to a postcard ID (Legacy/Admin Links)
           const { data: pData, error: pError } = await supabase
            .from('postalpeek_postcards')
            .select('*')
            .gte('id', minUuid)
            .lte('id', maxUuid)
            .limit(1)
            .single();

           if (pData && !pError) {
             sharedCard = pData;
             setHasSharedCard(true);
           } else {
             setHasSharedCard(false);
           }
        }
      } else {
        setHasSharedCard(false);
      }

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
        loadedIdsRef.current = [...excludeIds, ...fetchedItems.map((item) => item.id)];
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

      const allUrls = (sharedCard ? [sharedCard, ...fetchedItems] : fetchedItems).flatMap((i) =>
        [i.illustration_url, i.original_image_url].filter(Boolean)
      );
      await preSignUrls(allUrls).catch((err) => console.error('Failed to pre-sign URLs', err));
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

  const prefetchCountry = useCallback(
    async (country: string | null) => {
      const cacheKey = country ?? '__everywhere__';
      if (prefetchCacheRef.current.has(cacheKey) || country === selectedCountry) return;

      try {
        const { data } = await supabase.rpc('postalpeek_get_random_feed', {
          p_limit: PAGE_SIZE,
          p_country: country,
          p_exclude_ids: [],
        });
        if (data) {
          prefetchCacheRef.current.set(cacheKey, data as FeedItem[]);
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
    },
    [selectedCountry]
  );

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
        await preSignUrls(newItems.flatMap((i) => [i.illustration_url, i.original_image_url].filter(Boolean)));
        loadedIdsRef.current = [...loadedIdsRef.current, ...newItems.map((item) => item.id)];
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
            if (!selectedCountry || newItem.country === selectedCountry) {
              preSignUrls([newItem.illustration_url, newItem.original_image_url].filter(Boolean));
              setItems((prev) => [newItem, ...prev]);
            }
          }
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [selectedCountry]);

  return {
    items,
    setItems,
    availableCountries,
    isLoading,
    setIsLoading,
    selectedCountry,
    setSelectedCountry,
    isFetchingMore,
    hasMore,
    fetchMoreFeed,
    prefetchCountry,
    loadedIdsRef,
    isFetchingRef,
    hasSharedCard,
  };
}

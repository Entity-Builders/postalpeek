import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@eb-packages/logic/src/supabase';
import { decodeHashToUuidPrefix } from '@eb-packages/logic/src/hash';
import { analytics } from '../lib/analytics';
import { cdnImage, WIDTHS, preSignUrls } from '../utils/imageUtils';
import type { FeedItem } from '../components/Postcard';

const PAGE_SIZE = 30;

export function useWalkerFeed() {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [availableCountries, setAvailableCountries] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [hasSharedCard, setHasSharedCard] = useState(false);

  const isFetchingRef = useRef(false);
  const currentFetchIdRef = useRef(0);
  // Stable ref so fetchMoreFeed doesn't need items in its deps (avoids observer reconnects)
  const itemsRef = useRef<FeedItem[]>(items);
  const hasMoreRef = useRef(hasMore);
  const selectedCountryRef = useRef(selectedCountry);

  // Parse Initial URL State
  // Routes: /feed, /feed/country/:country, /:shortcode
  useEffect(() => {
    const rawSegments = window.location.pathname.split('/').filter(Boolean);

    // /feed/country/:country — e.g. /feed/country/Argentina
    if (rawSegments[0] === 'feed' && rawSegments[1] === 'country' && rawSegments[2]) {
      const decodedCountry = decodeURIComponent(rawSegments[2]).replace(/-/g, ' ');
      setSelectedCountry(decodedCountry);
    }
  }, []);

  useEffect(() => {
    async function fetchCountries() {
      try {
        const { data, error } = await supabase.rpc('postalpeek_get_distinct_countries');
        if (!error && data) {
          setAvailableCountries(data.map((row: { country: string }) => row.country));
        }
      } catch (err) {
        console.error('Failed to load distinct countries', err);
      }
    }
    fetchCountries();
  }, []);

  const fetchInitialFeed = useCallback(async (country: string | null) => {
    const fetchId = ++currentFetchIdRef.current;
    isFetchingRef.current = true;
    setIsLoading(true);
    setHasMore(true);

    try {
      const rawSegments = window.location.pathname.split('/').filter(Boolean);
      const isUnderFeed = rawSegments[0] === 'feed';
      // For /feed routes, work with sub-segments; for /:shortcode, use raw
      const segments = isUnderFeed ? rawSegments.slice(1) : rawSegments;
      let sharedCardPrefix = null;

      if (!isUnderFeed && segments.length === 1) {
        // /:shortcode — direct share link
        const APP_ROUTES = ['feed', 'collection', 'album', 'admin', 'p'];
        if (!APP_ROUTES.includes(segments[0])) {
          sharedCardPrefix = decodeHashToUuidPrefix(segments[0]);
        }
      }

      let sharedCard: FeedItem | null = null;
      if (sharedCardPrefix) {
        const minUuid = `${sharedCardPrefix}-0000-0000-0000-000000000000`;
        const maxUuid = `${sharedCardPrefix}-ffff-ffff-ffff-ffffffffffff`;

        const { data: shareData, error: shareError } = await supabase
          .from('postalpeek_shares')
          .select('id, postcard_id')
          .gte('id', minUuid)
          .lte('id', maxUuid)
          .eq('is_used', false)
          .limit(1)
          .maybeSingle();

        const targetPostcardId: string | null = shareData?.postcard_id || null;

        if (shareData && !shareError) {
          supabase.from('postalpeek_shares').update({ is_used: true }).eq('id', shareData.id).then();
        }

        if (targetPostcardId) {
           const { data: pData } = await supabase.from('postalpeek_postcards').select('*').eq('id', targetPostcardId).maybeSingle();
           if (pData) { sharedCard = pData; setHasSharedCard(true); } else setHasSharedCard(false);
        } else {
           const { data: pData } = await supabase.from('postalpeek_postcards').select('*').gte('id', minUuid).lte('id', maxUuid).limit(1).maybeSingle();
           if (pData) { sharedCard = pData; setHasSharedCard(true); } else setHasSharedCard(false);
        }
      } else setHasSharedCard(false);

      const { data, error } = await supabase.rpc('postalpeek_get_random_feed', {
        p_limit: PAGE_SIZE,
        p_country: country,
      });

      if (fetchId !== currentFetchIdRef.current) return;
      if (error) throw error;

      let fetchedItems: FeedItem[] = (data as FeedItem[]) || [];

      if (sharedCard) {
        fetchedItems = fetchedItems.filter(i => i.id !== sharedCard!.id);
      }

      if (fetchedItems.length < PAGE_SIZE) setHasMore(false);

      const allItems = sharedCard ? [sharedCard, ...fetchedItems] : fetchedItems;

      const allUrls = allItems.flatMap(i => [i.illustration_url, i.original_image_url].filter(Boolean));
      await preSignUrls(allUrls).catch(console.error);

      if (fetchId !== currentFetchIdRef.current) return;

      // Prefetch the first screen of grid images + blur placeholders
      allItems.slice(0, 12).forEach((item) => {
        if (item.illustration_url) {
          const img = new Image();
          img.src = cdnImage(item.illustration_url, { width: WIDTHS.grid });
          const blurImg = new Image();
          blurImg.src = cdnImage(item.illustration_url, { width: WIDTHS.blur, quality: 15 });
        }
      });

      setItems(allItems);
      itemsRef.current = allItems;
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

  // Keep refs in sync so fetchMoreFeed can read them without needing them as deps
  useEffect(() => { itemsRef.current = items; }, [items]);
  useEffect(() => { hasMoreRef.current = hasMore; }, [hasMore]);
  useEffect(() => { selectedCountryRef.current = selectedCountry; }, [selectedCountry]);

  useEffect(() => {
    fetchInitialFeed(selectedCountry);
  }, [fetchInitialFeed, selectedCountry]);

  // Stable function — reads state via refs to avoid recreating on every items change.
  // This prevents the IntersectionObserver in WalkerGrid from reconnecting and jumping scroll.
  const fetchMoreFeed = useCallback(async () => {
    if (isFetchingRef.current || !hasMoreRef.current || itemsRef.current.length === 0) return;

    isFetchingRef.current = true;
    setIsFetchingMore(true);

    try {
      const excludeIds = itemsRef.current.map((i) => i.id);

      const { data, error } = await supabase.rpc('postalpeek_get_random_feed', {
        p_limit: PAGE_SIZE,
        p_exclude_ids: excludeIds,
        p_country: selectedCountryRef.current,
      });

      if (error) throw error;

      const newItems = (data as FeedItem[]) || [];
      if (newItems.length === 0) {
        setHasMore(false);
        hasMoreRef.current = false;
        return;
      }

      if (newItems.length < PAGE_SIZE) {
        setHasMore(false);
        hasMoreRef.current = false;
      }

      const allUrls = newItems.flatMap(i => [i.illustration_url, i.original_image_url].filter(Boolean));
      await preSignUrls(allUrls).catch(console.error);

      // Prefetch grid + blur images so GridCard shows them instantly
      newItems.slice(0, 9).forEach((item) => {
        if (item.illustration_url) {
          const img = new Image();
          img.src = cdnImage(item.illustration_url, { width: WIDTHS.grid });
          const blurImg = new Image();
          blurImg.src = cdnImage(item.illustration_url, { width: WIDTHS.blur, quality: 15 });
        }
      });

      setItems((prev) => {
        const existingIds = new Set(prev.map(p => p.id));
        const filteredNew = newItems.filter(p => !existingIds.has(p.id));
        const merged = [...prev, ...filteredNew];
        itemsRef.current = merged;
        return merged;
      });

    } catch (error) {
      console.error('Error loading more feed:', error);
      analytics.captureError(error, { context: 'fetch_more_feed', country: selectedCountryRef.current });
    } finally {
      setIsFetchingMore(false);
      isFetchingRef.current = false;
    }
  }, []); // stable — reads state via refs

  const refetchFeed = useCallback(() => {
    fetchInitialFeed(selectedCountry);
  }, [fetchInitialFeed, selectedCountry]);

  return {
    items,
    setItems,
    availableCountries,
    isLoading,
    setIsLoading,
    selectedCountry,
    setSelectedCountry,
    hasSharedCard,
    hasMore,
    isFetchingMore,
    fetchMoreFeed,
    refetchFeed,
  };
}

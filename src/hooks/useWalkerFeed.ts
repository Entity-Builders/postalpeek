import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@eb-packages/logic/src/supabase';
import { decodeHashToUuidPrefix } from '@eb-packages/logic/src/hash';
import { analytics } from '../lib/analytics';
import { cdnImage, WIDTHS, preSignUrls } from '../utils/imageUtils';
import type { FeedItem } from '../components/Postcard';

const PAGE_SIZE = 15;

export function useWalkerFeed() {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [availableCountries, setAvailableCountries] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [hasSharedCard, setHasSharedCard] = useState(false);
  const [lastRefillAt, setLastRefillAt] = useState<string | null>(null);

  const isFetchingRef = useRef(false);
  const currentFetchIdRef = useRef(0);

  // Parse Initial URL State
  useEffect(() => {
    const segments = window.location.pathname.split('/').filter(Boolean);
    const APP_ROUTES = ['collection', 'album'];

    if (segments.length === 2) {
      if (APP_ROUTES.includes(segments[0])) return;
      const decodedCountry = decodeURIComponent(segments[0]).replace(/-/g, ' ');
      setSelectedCountry(decodedCountry);
    } else if (segments.length === 1) {
      if (APP_ROUTES.includes(segments[0])) return;
      const segment = segments[0];
      const maybePrefix = decodeHashToUuidPrefix(segment);
      const isValidHex = maybePrefix !== null && /^[0-9a-f]{8}$/i.test(maybePrefix);

      if (!isValidHex && segment.length > 0) {
        const decodedCountry = decodeURIComponent(segment).replace(/-/g, ' ');
        setSelectedCountry(decodedCountry);
      }
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

  useEffect(() => {
    async function fetchStateMeta() {
       const { data: { session } } = await supabase.auth.getSession();
       if (!session?.user) return;
       const { data } = await supabase.from('postalpeek_daily_feed_state').select('last_refill_at').eq('user_id', session.user.id).maybeSingle();
       if (data?.last_refill_at) setLastRefillAt(data.last_refill_at);
    }
    fetchStateMeta();
  }, [isLoading]); // Refetch when reloading feed

  const fetchInitialFeed = useCallback(async (country: string | null) => {
    const fetchId = ++currentFetchIdRef.current;
    isFetchingRef.current = true;
    setIsLoading(true);

    try {
      const segments = window.location.pathname.split('/').filter(Boolean);
      let sharedCardPrefix = null;

      if (segments.length === 2 && country) {
        const decodedSegment = decodeURIComponent(segments[0]).replace(/-/g, ' ');
        if (decodedSegment === country) sharedCardPrefix = decodeHashToUuidPrefix(segments[1]);
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

      const { data, error } = await supabase.rpc('postalpeek_get_daily_pack', {
        p_limit: PAGE_SIZE,
        p_country: country,
      });

      if (fetchId !== currentFetchIdRef.current) return;
      if (error) throw error;

      let fetchedItems: FeedItem[] = (data as FeedItem[]) || [];

      if (sharedCard) {
        fetchedItems = fetchedItems.filter(i => i.id !== sharedCard!.id);
      }

      const allItems = sharedCard ? [sharedCard, ...fetchedItems] : fetchedItems;

      const allUrls = allItems.flatMap(i => [i.illustration_url, i.original_image_url].filter(Boolean));
      await preSignUrls(allUrls).catch(err => console.error('Failed to pre-sign URLs', err));

      if (fetchId !== currentFetchIdRef.current) return;

      allItems.slice(0, 3).forEach((item) => {
        if (item.illustration_url) {
          const img = new Image();
          img.src = cdnImage(item.illustration_url, { width: WIDTHS.mobile });
          const blurImg = new Image();
          blurImg.src = cdnImage(item.illustration_url, { width: WIDTHS.blur, quality: 20 });
        }
      });

      setItems(allItems);
    } catch (error) {
      if (fetchId !== currentFetchIdRef.current) return;
      console.error('Error loading daily pack:', error);
      analytics.captureError(error, { context: 'fetch_daily_pack', country: country });
    } finally {
      if (fetchId === currentFetchIdRef.current) {
        setIsLoading(false);
        isFetchingRef.current = false;
      }
    }
  }, []);

  const popFromPack = useCallback(async (postcardId: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    
    setItems((prev) => prev.filter(item => item.id !== postcardId));
    
    if (session?.user) {
      const { error } = await supabase.rpc('postalpeek_remove_from_pack', { p_postcard_id: postcardId });
      if (error) {
        console.error('Failed to remove from pack', error);
      }
    }
  }, []);

  useEffect(() => {
    fetchInitialFeed(selectedCountry);
  }, [fetchInitialFeed, selectedCountry]);

  const fetchMoreFeed = useCallback(async () => {}, []);

  return {
    items,
    setItems,
    availableCountries,
    isLoading,
    setIsLoading,
    selectedCountry,
    setSelectedCountry,
    hasSharedCard,
    popFromPack,
    lastRefillAt,
    // Stubs
    hasMore: false,
    isFetchingMore: false,
    fetchMoreFeed,
  };
}

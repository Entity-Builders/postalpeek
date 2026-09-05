import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@entity-builders/logic/src/supabase';
import { preSignUrls } from '../utils/imageUtils';
import type { FeedItem } from '../components/Postcard';

export function useCollection(userId: string | null | undefined) {
  const [collection, setCollection] = useState<FeedItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchCollection = useCallback(async () => {
    if (!userId) {
      setCollection([]);
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_user_collection', {
        p_user_id: userId,
      });

      if (error) throw error;

      const items = (data as FeedItem[]) || [];

      // Pre-sign image URLs
      if (items.length > 0) {
        await preSignUrls(
          items.flatMap((i) => [i.illustration_url, i.original_image_url].filter(Boolean)),
        );
      }

      setCollection(items);
    } catch (err) {
      console.error('Failed to fetch collection:', err);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchCollection();
  }, [fetchCollection]);

  return {
    collection,
    isLoading,
    totalCount: collection.length,
    refetch: fetchCollection,
  };
}

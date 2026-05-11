import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@eb-packages/logic/src/supabase';
import type { FeedItem } from '../components/Postcard';
import { analytics } from '../lib/analytics';
import { preSignUrls } from '../utils/imageUtils';

interface DailyPackResult {
  success: boolean;
  already_opened?: boolean;
  pack_id?: string;
  postcards?: FeedItem[];
  error?: string;
}

export function useDailyPack(userId: string | null | undefined) {
  const [packCards, setPackCards] = useState<FeedItem[]>([]);
  const [isPackAvailable, setIsPackAvailable] = useState(false);
  const [isPackOpened, setIsPackOpened] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);

  // Check on mount if today's pack is available
  useEffect(() => {
    if (!userId) {
      setIsPackAvailable(false);
      setHasChecked(true);
      return;
    }

    const checkPack = async () => {
      try {
        // Check if user already opened a pack today
        const today = new Date().toISOString().split('T')[0];
        const { data, error } = await supabase
          .from('daily_packs')
          .select('id, postcard_ids')
          .eq('user_id', userId)
          .gte('opened_at', `${today}T00:00:00`)
          .limit(1)
          .maybeSingle();

        if (error) {
          console.error('Failed to check daily pack:', error);
          setIsPackAvailable(false);
        } else if (data) {
          // Already opened today
          setIsPackAvailable(false);
          setIsPackOpened(true);
        } else {
          // Pack available!
          setIsPackAvailable(true);
          setIsPackOpened(false);
        }
      } catch (err) {
        console.error('Daily pack check failed:', err);
        setIsPackAvailable(false);
      } finally {
        setHasChecked(true);
      }
    };

    checkPack();
  }, [userId]);

  const openPack = useCallback(async (): Promise<DailyPackResult> => {
    if (!userId) {
      return { success: false, error: 'AUTH_REQUIRED' };
    }

    setIsLoading(true);

    try {
      const { data, error } = await supabase.rpc('open_daily_pack');

      if (error) throw error;

      const result = data as DailyPackResult;

      if (result.success && result.postcards) {
        // Pre-sign illustration URLs so Postcard components can render images
        const urls = result.postcards.flatMap((p: FeedItem) =>
          [p.illustration_url, p.original_image_url].filter(Boolean)
        );
        await preSignUrls(urls);

        setPackCards(result.postcards);
        setIsPackAvailable(false);
        setIsPackOpened(true);

        analytics.track('daily_pack_opened', {
          already_opened: result.already_opened,
          card_count: result.postcards.length,
        });
      }

      return result;
    } catch (err) {
      console.error('Failed to open daily pack:', err);
      analytics.captureError(err, { context: 'open_daily_pack' });
      return { success: false, error: 'UNKNOWN_ERROR' };
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  const clearPack = useCallback(() => {
    setPackCards([]);
  }, []);

  return {
    packCards,
    isPackAvailable,
    isPackOpened,
    isLoading,
    hasChecked,
    openPack,
    clearPack,
  };
}

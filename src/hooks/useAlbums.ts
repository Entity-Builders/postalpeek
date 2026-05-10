import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@eb-packages/logic/src/supabase';

import type { BilingualText } from '../utils/i18n';

export interface Album {
  id: string;
  title: string | BilingualText;
  description: string | BilingualText | null;
  cover_image_url: string | null;
  category: string;
  country: string | null;
  city: string | null;
  difficulty: 'easy' | 'medium' | 'hard' | 'epic';
  reward_claims: number;
  total_slots: number;
  collected_slots: number;
  completed_at: string | null;
}

export function useAlbums(userId?: string) {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchAlbums = useCallback(async () => {
    if (!userId) {
      setAlbums([]);
      return;
    }
    setIsLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_albums_with_progress');
      if (error) {
        console.error('Failed to fetch albums:', error);
        return;
      }
      setAlbums((data as Album[]) ?? []);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchAlbums();
  }, [fetchAlbums]);

  return { albums, isLoading, refetch: fetchAlbums };
}

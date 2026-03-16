import { useState, useCallback } from 'react';
import { supabase } from '@eb-packages/logic/src/supabase';

export interface AlbumSlot {
  slot_label: string;
  slot_order: number;
  postcard_id: string | null;
  illustration_url: string | null;
  city: string | null;
  country: string | null;
  category: string | null;
  is_owned: boolean;
  is_claimed: boolean;
}

export interface AlbumDetailData {
  album: {
    id: string;
    title: string;
    description: string | null;
    cover_image_url: string | null;
    category: string;
    country: string | null;
    city: string | null;
    reward_claims: number;
  };
  slots: AlbumSlot[];
  completed_at: string | null;
}

export function useAlbumDetail() {
  const [detail, setDetail] = useState<AlbumDetailData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchDetail = useCallback(async (albumId: string) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.rpc('postalpeek_get_album_detail', {
        p_album_id: albumId,
      });
      if (error) {
        console.error('Failed to fetch album detail:', error);
        return;
      }
      setDetail(data as AlbumDetailData);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { detail, isLoading, fetchDetail, reset: () => setDetail(null) };
}

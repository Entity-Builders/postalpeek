import { useState, useCallback } from 'react';
import { supabase } from '@eb-packages/logic/src/supabase';
import type { BilingualText } from '../utils/i18n';

export interface AlbumSlot {
  slot_label: string;
  slot_order: number;
  postcard_id: string | null;
  illustration_url: string | null;
  original_image_url: string | null;
  city: string | null;
  country: string | null;
  category: string | null;
  lat: number | null;
  lng: number | null;
  is_owned: boolean;
  is_claimed: boolean;
  is_hint: boolean;
  streetview_pov?: {
    heading?: number;
    pitch?: number;
    fov?: number;
    pano_id?: string;
    lens?: string;
    date?: string;
  } | null;
}

export interface AlbumDetailData {
  album: {
    id: string;
    title: string | BilingualText;
    title_es?: string;
    title_en?: string;
    description: string | BilingualText | null;
    description_es?: string | null;
    description_en?: string | null;
    cover_image_url: string | null;
    category: string;
    country: string | null;
    city: string | null;
    difficulty: 'easy' | 'medium' | 'hard' | 'epic';
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
      const { data, error } = await supabase.rpc('get_album_detail', {
        p_album_id: albumId,
      });
      if (error) {
        console.error('Failed to fetch album detail:', error);
        return;
      }
      setDetail(data as AlbumDetailData);
      const d = data as AlbumDetailData;
      console.log('[useAlbumDetail] Slots count:', d?.slots?.length, 'First slot illustration_url:', d?.slots?.[0]?.illustration_url);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { detail, isLoading, fetchDetail, reset: () => setDetail(null) };
}

/**
 * useDiscoveries — hook to manage the user's sticker discovery inventory.
 *
 * Provides:
 *   - discoverTag(): triggers the vectorize-tag edge function
 *   - discoveries: list of user's discoveries
 *   - isDiscovered(): check if a tag was already discovered on a given postcard
 *   - generatingTags: set of tag keys currently being generated
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@entity-builders/logic/src/supabase';

interface Discovery {
  id: string;
  postcard_id: string;
  tag_label_en: string;
  tag_type: string;
  bbox: number[];
  sticker_url: string | null;
  sticker_status: string;
  discovered_at: string;
}

interface DiscoverTagParams {
  postcardId: string;
  tagLabelEn: string;
  tagType: string;
  bbox: number[];
}

export function useDiscoveries(userId?: string) {
  const [discoveries, setDiscoveries] = useState<Discovery[]>([]);
  const [generatingTags, setGeneratingTags] = useState<Set<string>>(new Set());
  const [lastSticker, setLastSticker] = useState<{
    label: string;
    url: string;
  } | null>(null);
  const fetchedRef = useRef(false);

  // Tag key for tracking generation state
  const tagKey = (postcardId: string, label: string) => `${postcardId}:${label}`;

  // Fetch user's discoveries on mount
  useEffect(() => {
    if (!userId || fetchedRef.current) return;
    fetchedRef.current = true;

    supabase
      .from('discoveries')
      .select('*')
      .eq('user_id', userId)
      .order('discovered_at', { ascending: false })
      .then(({ data }) => {
        if (data) setDiscoveries(data as Discovery[]);
      });
  }, [userId]);

  const isDiscovered = useCallback(
    (postcardId: string, tagLabelEn: string): boolean => {
      return discoveries.some(
        (d) => d.postcard_id === postcardId && d.tag_label_en === tagLabelEn,
      );
    },
    [discoveries],
  );

  const isGenerating = useCallback(
    (postcardId: string, tagLabelEn: string): boolean => {
      return generatingTags.has(tagKey(postcardId, tagLabelEn));
    },
    [generatingTags],
  );

  const discoverTag = useCallback(
    async ({ postcardId, tagLabelEn, tagType, bbox }: DiscoverTagParams) => {
      const key = tagKey(postcardId, tagLabelEn);
      if (generatingTags.has(key)) return; // Already generating

      setGeneratingTags((prev) => new Set(prev).add(key));
      setLastSticker(null);

      try {
        const baseUrl =
          import.meta.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321';
        const { data: { session } } = await supabase.auth.getSession();

        const response = await fetch(
          `${baseUrl}/functions/v1/postalpeek-vectorize-tag`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              apikey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
              ...(session?.access_token
                ? { Authorization: `Bearer ${session.access_token}` }
                : {}),
            },
            body: JSON.stringify({
              postcard_id: postcardId,
              tag_label_en: tagLabelEn,
              tag_type: tagType,
              bbox,
            }),
          },
        );

        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(err.error || `HTTP ${response.status}`);
        }

        const result = await response.json();

        // Add to local state
        const newDiscovery: Discovery = {
          id: result.discovery_id,
          postcard_id: postcardId,
          tag_label_en: tagLabelEn,
          tag_type: tagType,
          bbox,
          sticker_url: result.sticker_url,
          sticker_status: 'done',
          discovered_at: new Date().toISOString(),
        };

        setDiscoveries((prev) => [newDiscovery, ...prev]);
        setLastSticker({ label: tagLabelEn, url: result.sticker_url });

        return result;
      } catch (err) {
        console.error('[useDiscoveries] Error:', err);
        throw err;
      } finally {
        setGeneratingTags((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }
    },
    [generatingTags],
  );

  const dismissLastSticker = useCallback(() => {
    setLastSticker(null);
  }, []);

  return {
    discoveries,
    discoverTag,
    isDiscovered,
    isGenerating,
    lastSticker,
    dismissLastSticker,
    totalDiscoveries: discoveries.length,
  };
}

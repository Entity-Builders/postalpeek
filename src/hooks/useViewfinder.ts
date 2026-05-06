/**
 * useViewfinder.ts
 *
 * Hook that manages the Viewfinder capture state.
 * Orchestrates: POV capture → Street View static → AI illustration → save.
 *
 * Simplified flow (v2):
 *   idle → preview (show local snapshot) → illustrating → success
 *
 * ref #94
 */

import { useState, useCallback } from 'react';
import { t, useLang } from '../utils/i18n';
import { supabase } from '@eb-packages/logic/src/supabase';
import {
  createUserPostcard,
  enrichPostcardMetadata,
  type UserPostcard,
  type CreateUserPostcardParams,
} from '../services/userPostcardService';
import type { StreetViewPOV } from '../components/StreetViewPanorama';
import type { FeedItem } from '../components/Postcard';
import { analytics } from '../lib/analytics';

export type ViewfinderStep =
  | 'viewfinder'    // Panorama is interactive, user is composing
  | 'preview'       // User took a snapshot — showing polaroid preview
  | 'illustrating'  // AI illustration in progress
  | 'success'       // Postcard created successfully
  | 'error';        // Something went wrong

export interface UseViewfinderReturn {
  step: ViewfinderStep;
  capturedPostcard: UserPostcard | null;
  /** Full FeedItem built from the capture — ready for <Postcard> / <PostcardBack> */
  capturedFeedItem: FeedItem | null;
  capturedPov: StreetViewPOV | null;
  capturedDataUrl: string | null;
  errorMessage: string | null;
  illustrationStyle: string;
  isSaving: boolean;
  setIllustrationStyle: (style: string) => void;
  /** Called by the panorama's capture — transitions to preview */
  handleSnapshot: (pov: StreetViewPOV, dataUrl: string | null) => void;
  /** User confirms the preview — kicks off AI generation */
  handleGenerate: () => Promise<void>;
  /** Save postcard to user's album */
  handleSave: () => Promise<boolean>;
  reset: () => void;
}

/** Build a FeedItem from a UserPostcard so <Postcard>/<PostcardBack> can render it */
function buildFeedItem(
  postcard: UserPostcard,
  sourceItem: FeedItem,
  pov: StreetViewPOV | null,
): FeedItem {
  return {
    id: postcard.id,
    country: postcard.country || sourceItem.country,
    city: postcard.city || sourceItem.city,
    location_name: postcard.location_name || sourceItem.location_name,
    lat: postcard.lat,
    lng: postcard.lng,
    original_image_url: postcard.original_image_url,
    illustration_url: postcard.illustration_url || '',
    category: postcard.category || sourceItem.category || '🎨 Arte Generado',
    description: postcard.description || sourceItem.description || '',
    created_at: postcard.created_at,
    streetview_pov: pov ? {
      heading: pov.heading,
      pitch: pov.pitch,
      fov: pov.zoom <= 0 ? 120 : Math.max(30, 120 - pov.zoom * 30),
      pano_id: pov.panoId,
    } : sourceItem.streetview_pov,
    generation_metadata: postcard.generation_metadata || {},
  };
}

const ILLUSTRATION_STYLES = [
  'default',
  'watercolor',
  'vintage',
  'pop-art',
  'minimalist',
];

export function useViewfinder(
  userId: string | undefined,
  sourceItem: FeedItem | null,
  userIsAnonymous: boolean = false,
): UseViewfinderReturn {
  const lang = useLang();
  const [step, setStep] = useState<ViewfinderStep>('viewfinder');
  const [capturedPostcard, setCapturedPostcard] = useState<UserPostcard | null>(
    null,
  );
  const [capturedFeedItem, setCapturedFeedItem] = useState<FeedItem | null>(null);
  const [capturedPov, setCapturedPov] = useState<StreetViewPOV | null>(null);
  const [capturedDataUrl, setCapturedDataUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [illustrationStyle, setIllustrationStyle] = useState('default');
  const [isSaving, setIsSaving] = useState(false);

  // Step 2: User confirms preview → generate AI illustration (now triggered automatically)
  const handleGenerate = useCallback(async (overridePov?: StreetViewPOV) => {
    let effectiveUserId = userId;

    if (!effectiveUserId) {
      // Auto-create anonymous session if the user doesn't have an ID yet
      try {
        const { data, error } = await supabase.auth.signInAnonymously();
        if (error) throw error;
        effectiveUserId = data.user?.id;
      } catch (err) {
        console.error('Failed to create anonymous session:', err);
        setErrorMessage('Failed to initialize session for generation');
        setStep('error');
        return;
      }
    }

    if (!effectiveUserId) {
      setErrorMessage('Could not initialize session');
      setStep('error');
      return;
    }

    const povToUse = overridePov || capturedPov;

    if (!sourceItem || !povToUse) {
      setErrorMessage('Missing capture data — please retake the photo');
      setStep('error');
      return;
    }

    const randomStyle = ILLUSTRATION_STYLES[Math.floor(Math.random() * ILLUSTRATION_STYLES.length)];
    setIllustrationStyle(randomStyle);

    setStep('illustrating');
    setErrorMessage(null);

    analytics.track('viewfinder_capture_started', {
      source_postcard_id: sourceItem.id,
      lat: povToUse.lat,
      lng: povToUse.lng,
      heading: povToUse.heading,
      pitch: povToUse.pitch,
      style: randomStyle,
    });

    try {
      const isMockSource = sourceItem.id.startsWith('free-slot-') || sourceItem.id.startsWith('capture-');
      const params: CreateUserPostcardParams = {
        userId: effectiveUserId,
        sourcePostcardId: isMockSource ? null : sourceItem.id,
        pov: povToUse,
        city: sourceItem.city || '',
        country: sourceItem.country || '',
        locationName:
          sourceItem.location_name ||
          `${sourceItem.city}, ${sourceItem.country}`,
        style: randomStyle !== 'default' ? randomStyle : undefined,
      };

      const postcard = await createUserPostcard(params);

      setCapturedPostcard(postcard);
      
      // Build FeedItem for the <Postcard> / <PostcardBack> components
      const feedItem = buildFeedItem(postcard, sourceItem, povToUse);
      setCapturedFeedItem(feedItem);
      
      setStep('success');

      analytics.track('viewfinder_postcard_created', {
        postcard_id: postcard.id,
        source_postcard_id: sourceItem.id,
        style: illustrationStyle,
        city: sourceItem.city,
        country: sourceItem.country,
      });

      // Fire metadata enrichment in the background (non-blocking)
      // This adds storytelling, stats, trivia to the postcard back
      enrichPostcardMetadata(postcard.id).then((enrichResult) => {
        if (enrichResult) {
          console.log('[Viewfinder] Metadata enrichment completed:', enrichResult);
          // Update the FeedItem with enriched metadata so PostcardBack re-renders
          setCapturedFeedItem(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              rarity: (enrichResult.rarity as FeedItem['rarity']) || prev.rarity,
              generation_metadata: {
                ...prev.generation_metadata,
                storytelling: enrichResult.storytelling,
                stats: enrichResult.stats,
                ...(enrichResult.trivia ? { trivia: enrichResult.trivia } : {}),
              },
            };
          });
        }
      });

    } catch (err) {
      console.error('Viewfinder capture failed:', err);
      setErrorMessage(
        err instanceof Error ? err.message : 'Failed to create postcard',
      );
      setStep('error');

      analytics.captureError(err, {
        context: 'viewfinder_capture',
        source_postcard_id: sourceItem.id,
      });
    }
  }, [userId, sourceItem, capturedPov, illustrationStyle]);

  // Step 1: Take a snapshot → jump directly to generating illustration
  const handleSnapshot = useCallback(
    (pov: StreetViewPOV, dataUrl: string | null) => {
      setCapturedPov(pov);
      setCapturedDataUrl(dataUrl);

      analytics.track('viewfinder_snapshot_taken', {
        source_postcard_id: sourceItem?.id,
        lat: pov.lat,
        lng: pov.lng,
        heading: pov.heading,
        pitch: pov.pitch,
      });
      
      // Immediately start generation flow
      handleGenerate(pov);
    },
    [sourceItem, handleGenerate],
  );

  // Step 3: Save to user's album (already in DB — this marks it as "saved" and signals completion)
  const handleSave = useCallback(async (): Promise<boolean> => {
    if (!capturedPostcard) return false;
    
    setIsSaving(true);
    try {
      // The postcard is already saved in the DB from createUserPostcard.
      // This action confirms the user wants to keep it.
      analytics.track('viewfinder_postcard_saved', {
        postcard_id: capturedPostcard.id,
        city: capturedPostcard.city,
        country: capturedPostcard.country,
      });
      
      return true;
    } finally {
      setIsSaving(false);
    }
  }, [capturedPostcard]);

  const reset = useCallback(() => {
    setStep('viewfinder');
    setCapturedPostcard(null);
    setCapturedFeedItem(null);
    setCapturedPov(null);
    setCapturedDataUrl(null);
    setErrorMessage(null);
  }, []);

  return {
    step,
    capturedPostcard,
    capturedFeedItem,
    capturedPov,
    capturedDataUrl,
    errorMessage,
    illustrationStyle,
    isSaving,
    setIllustrationStyle,
    handleSnapshot,
    handleGenerate,
    handleSave,
    reset,
  };
}

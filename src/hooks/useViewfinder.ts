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
import {
  createUserPostcard,
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
  capturedPov: StreetViewPOV | null;
  capturedDataUrl: string | null;
  errorMessage: string | null;
  illustrationStyle: string;
  setIllustrationStyle: (style: string) => void;
  /** Called by the panorama's capture — transitions to preview */
  handleSnapshot: (pov: StreetViewPOV, dataUrl: string | null) => void;
  /** User confirms the preview — kicks off AI generation */
  handleGenerate: () => Promise<void>;
  reset: () => void;
}

export function useViewfinder(
  userId: string | undefined,
  sourceItem: FeedItem | null,
): UseViewfinderReturn {
  const [step, setStep] = useState<ViewfinderStep>('viewfinder');
  const [capturedPostcard, setCapturedPostcard] = useState<UserPostcard | null>(
    null,
  );
  const [capturedPov, setCapturedPov] = useState<StreetViewPOV | null>(null);
  const [capturedDataUrl, setCapturedDataUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [illustrationStyle, setIllustrationStyle] = useState('default');

  // Step 1: Take a snapshot → go to preview
  const handleSnapshot = useCallback(
    (pov: StreetViewPOV, dataUrl: string | null) => {
      setCapturedPov(pov);
      setCapturedDataUrl(dataUrl);
      setStep('preview');

      analytics.track('viewfinder_snapshot_taken', {
        source_postcard_id: sourceItem?.id,
        lat: pov.lat,
        lng: pov.lng,
        heading: pov.heading,
        pitch: pov.pitch,
      });
    },
    [sourceItem],
  );

  // Step 2: User confirms preview → generate AI illustration
  const handleGenerate = useCallback(async () => {
    const effectiveUserId = userId || 'anonymous';
    if (!sourceItem || !capturedPov) {
      setErrorMessage('Missing capture data — please retake the photo');
      setStep('error');
      return;
    }

    setStep('illustrating');
    setErrorMessage(null);

    analytics.track('viewfinder_capture_started', {
      source_postcard_id: sourceItem.id,
      lat: capturedPov.lat,
      lng: capturedPov.lng,
      heading: capturedPov.heading,
      pitch: capturedPov.pitch,
      style: illustrationStyle,
    });

    try {
      const params: CreateUserPostcardParams = {
        userId: effectiveUserId,
        sourcePostcardId: sourceItem.id,
        pov: capturedPov,
        city: sourceItem.city || '',
        country: sourceItem.country || '',
        locationName:
          sourceItem.location_name ||
          `${sourceItem.city}, ${sourceItem.country}`,
        style: illustrationStyle !== 'default' ? illustrationStyle : undefined,
      };

      const postcard = await createUserPostcard(params);

      setCapturedPostcard(postcard);
      setStep('success');

      analytics.track('viewfinder_postcard_created', {
        postcard_id: postcard.id,
        source_postcard_id: sourceItem.id,
        style: illustrationStyle,
        city: sourceItem.city,
        country: sourceItem.country,
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

  const reset = useCallback(() => {
    setStep('viewfinder');
    setCapturedPostcard(null);
    setCapturedPov(null);
    setCapturedDataUrl(null);
    setErrorMessage(null);
  }, []);

  return {
    step,
    capturedPostcard,
    capturedPov,
    capturedDataUrl,
    errorMessage,
    illustrationStyle,
    setIllustrationStyle,
    handleSnapshot,
    handleGenerate,
    reset,
  };
}

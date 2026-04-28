/**
 * useViewfinder.ts
 *
 * Hook that manages the Viewfinder capture state.
 * Orchestrates: POV capture → Street View static → AI illustration → save.
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
  | 'idle'       // Panorama is interactive, user is composing
  | 'capturing'  // Fetching Street View static image
  | 'illustrating' // AI illustration in progress
  | 'success'    // Postcard created successfully
  | 'error';     // Something went wrong

export interface UseViewfinderReturn {
  step: ViewfinderStep;
  capturedPostcard: UserPostcard | null;
  errorMessage: string | null;
  illustrationStyle: string;
  setIllustrationStyle: (style: string) => void;
  handleCapture: (pov: StreetViewPOV) => Promise<void>;
  reset: () => void;
}

export function useViewfinder(
  userId: string | undefined,
  sourceItem: FeedItem | null,
): UseViewfinderReturn {
  const [step, setStep] = useState<ViewfinderStep>('idle');
  const [capturedPostcard, setCapturedPostcard] = useState<UserPostcard | null>(
    null,
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [illustrationStyle, setIllustrationStyle] = useState('default');

  const handleCapture = useCallback(
    async (pov: StreetViewPOV) => {
      if (!userId || !sourceItem) return;

      setStep('capturing');
      setErrorMessage(null);

      analytics.track('viewfinder_capture_started', {
        source_postcard_id: sourceItem.id,
        lat: pov.lat,
        lng: pov.lng,
        heading: pov.heading,
        pitch: pov.pitch,
        style: illustrationStyle,
      });

      try {
        const params: CreateUserPostcardParams = {
          userId,
          sourcePostcardId: sourceItem.id,
          pov,
          city: sourceItem.city || '',
          country: sourceItem.country || '',
          locationName:
            sourceItem.location_name ||
            `${sourceItem.city}, ${sourceItem.country}`,
          style: illustrationStyle !== 'default' ? illustrationStyle : undefined,
        };

        // The service handles: capture → illustrate → save
        // We update the step to 'illustrating' after the static image is fetched
        // (the service does both in sequence, so we approximate the UX)
        setStep('illustrating');
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
    },
    [userId, sourceItem, illustrationStyle],
  );

  const reset = useCallback(() => {
    setStep('idle');
    setCapturedPostcard(null);
    setErrorMessage(null);
  }, []);

  return {
    step,
    capturedPostcard,
    errorMessage,
    illustrationStyle,
    setIllustrationStyle,
    handleCapture,
    reset,
  };
}

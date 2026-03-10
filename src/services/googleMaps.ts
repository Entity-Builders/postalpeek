import { supabase } from '@eb-packages/logic/src/supabase';
import type { StreetViewPOV } from '../components/StreetViewPanorama';

/**
 * Capture a Street View static image with specific POV params.
 * Uses the Edge Function which calls Google's Static API and caches the result.
 */
export async function captureStreetView(
  address: string,
  pov: StreetViewPOV,
): Promise<string> {
  try {
    const { data, error } = await supabase.functions.invoke(
      'postalpeek-streetview',
      {
        body: {
          address,
          heading: pov.heading,
          pitch: pov.pitch,
          fov: pov.zoom <= 0 ? 120 : Math.max(30, 120 - pov.zoom * 30),
          lat: pov.lat,
          lng: pov.lng,
        },
      },
    );

    if (error) {
      console.error('Edge function error:', error);
      throw error;
    }

    if (data?.imageUrl) {
      return data.imageUrl;
    }

    throw new Error('No imageUrl in edge function response');
  } catch (error) {
    console.warn('Failed to capture street view.', error);
    throw error;
  }
}

/**
 * Generate an artistic illustration from a Street View image
 * Uses Gemini 2.5 Flash image-to-image generation via Edge Function
 */
export interface IllustrationResult {
  illustrationUrl: string;
  category: string;
  description: string;
}

/**
 * Generate an artistic illustration from a Street View image
 * Uses Gemini 2.5 Flash image-to-image generation via Edge Function
 */
export async function generateIllustration(
  imageUrl: string,
  style?: string,
): Promise<IllustrationResult> {
  const { data, error } = await supabase.functions.invoke(
    'postalpeek-illustrate',
    {
      body: { imageUrl, style },
    },
  );

  if (error) {
    console.error('Illustration edge function error:', error);
    throw error;
  }

  if (data?.illustrationUrl) {
    return {
      illustrationUrl: data.illustrationUrl,
      category: data.category || '🎨 Arte Generado',
      description: data.description || 'Una vista artística de esta ubicación.',
    };
  }

  throw new Error('No illustrationUrl in edge function response');
}

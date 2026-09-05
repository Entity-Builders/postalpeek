import { supabase } from '@entity-builders/logic/src/supabase';
import type { StreetViewPOV } from '../components/StreetViewPanorama';
import { getDeviceId } from '../utils/deviceId';

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
  /** How many generations remain today for this device/user */
  remaining: number;
  /** Daily generation limit */
  limit: number;
}

/**
 * Thrown when the server rate-limits or circuit-breaks the illustration request.
 * code: 'RATE_LIMITED' | 'CIRCUIT_OPEN'
 */
export class RateLimitError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = 'RateLimitError';
    this.code = code;
  }
}

/**
 * Generate an artistic illustration from a Street View image
 * Uses Gemini 2.5 Flash image-to-image generation via Edge Function
 */
export async function generateIllustration(
  imageUrl: string,
  style?: string,
  locationContext?: { city?: string; country?: string; locationName?: string },
): Promise<IllustrationResult> {
  const { data, error } = await supabase.functions.invoke(
    'postalpeek-illustrate',
    {
      body: {
        imageUrl,
        style,
        deviceId: getDeviceId(),
        city: locationContext?.city,
        country: locationContext?.country,
        locationName: locationContext?.locationName,
      },
    },
  );

  // When edge function returns 4xx, supabase-js puts it in `error` (FunctionsHttpError)
  // and data is null. We need to read the body from error.context to get our rate limit codes.
  if (error) {
    // Try to parse the structured error body (our 429 responses have { error, code } )
    try {
      const errBody = await (error as { context?: Response }).context?.json?.();
      if (errBody?.code === 'RATE_LIMITED' || errBody?.code === 'CIRCUIT_OPEN') {
        throw new RateLimitError(errBody.error || 'Too many requests', errBody.code);
      }
    } catch (parseErr) {
      // Re-throw if it's already a RateLimitError
      if (parseErr instanceof RateLimitError) throw parseErr;
      // Otherwise ignore parse failure and fall through to generic error
    }
    console.error('Illustration edge function error:', error);
    throw error;
  }

  if (data?.illustrationUrl) {
    const locationFallback = [
      locationContext?.locationName,
      locationContext?.city,
      locationContext?.country,
    ].filter(Boolean).join(', ');

    return {
      illustrationUrl: data.illustrationUrl,
      category: data.category || '🎨 Arte Generado',
      description: data.description || (locationFallback ? `Una vista artística de ${locationFallback}.` : 'Una vista artística de esta ubicación.'),
      remaining: typeof data.remaining === 'number' ? data.remaining : 5,
      limit: typeof data.limit === 'number' ? data.limit : 5,
    };
  }

  throw new Error('No illustrationUrl in edge function response');
}

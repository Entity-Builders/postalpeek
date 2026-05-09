/**
 * userPostcardService.ts
 *
 * Orchestrates the Viewfinder capture pipeline:
 * 1. Capture static Street View image from user's POV
 * 2. Generate AI illustration via Gemini
 * 3. Save to postalpeek_user_postcards
 *
 * ref #94
 */

import { supabase } from '@eb-packages/logic/src/supabase';
import { captureStreetView, generateIllustration } from './googleMaps';
import type { StreetViewPOV } from '../components/StreetViewPanorama';

export interface UserPostcard {
  id: string;
  user_id: string;
  device_id: string | null;
  creator_name: string | null;
  source_postcard_id: string | null;
  lat: number;
  lng: number;
  city: string | null;
  country: string | null;
  location_name: string | null;
  heading: number;
  pitch: number;
  fov: number;
  original_image_url: string;
  illustration_url: string | null;
  illustration_style: string;
  title: string | null;
  description: string | null;
  category: string | null;
  generation_metadata: Record<string, unknown> | null;
  status: string;
  is_public: boolean;
  created_at: string;
}

export interface CreateUserPostcardParams {
  userId?: string;
  deviceId?: string;
  /** Display name chosen by the user (MVP anonymous username) */
  creatorName?: string;
  sourcePostcardId: string | null;
  pov: StreetViewPOV;
  city: string;
  country: string;
  locationName: string;
  style?: string;
}

export interface CreateUserPostcardResult {
  postcard: UserPostcard;
  /** Remaining daily generations for this device/user */
  remaining: number;
  /** Daily generation limit */
  limit: number;
}

/**
 * Full capture pipeline: Street View capture → AI illustration → save to DB.
 * Cost: ~$0.01 per call ($0.007 Static API + ~$0.002 Gemini Flash).
 */
export async function createUserPostcard(
  params: CreateUserPostcardParams,
): Promise<CreateUserPostcardResult> {
  // 1. Capture static image from the user's chosen POV ($0.007)
  const imageUrl = await captureStreetView(params.locationName, params.pov);

  // 2. Generate AI illustration (existing Gemini pipeline)
  const illustration = await generateIllustration(imageUrl, params.style);

  // 3. Calculate FOV from zoom level (same formula as captureStreetView)
  const fov =
    params.pov.zoom <= 0 ? 120 : Math.max(30, 120 - params.pov.zoom * 30);

  // 4. Save to postalpeek_user_postcards
  const { data, error } = await supabase
    .from('postalpeek_user_postcards')
    .insert({
      user_id: params.userId || null,
      device_id: params.deviceId || null,
      creator_name: params.creatorName || null,
      source_postcard_id: params.sourcePostcardId,
      lat: params.pov.lat,
      lng: params.pov.lng,
      city: params.city,
      country: params.country,
      location_name: params.locationName,
      heading: params.pov.heading,
      pitch: params.pov.pitch,
      fov,
      original_image_url: imageUrl,
      illustration_url: illustration.illustrationUrl,
      illustration_style: params.style || 'default',
      description: illustration.description,
      category: illustration.category,
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to save user postcard:', error);
    throw error;
  }

  return {
    postcard: data as UserPostcard,
    remaining: illustration.remaining,
    limit: illustration.limit,
  };
}

/**
 * Fetch user's own postcards.
 */
export async function getUserPostcards(
  userId: string,
  limit = 20,
): Promise<UserPostcard[]> {
  const { data, error } = await supabase
    .from('postalpeek_user_postcards')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data as UserPostcard[]) || [];
}

/**
 * Fetch nearby user postcards (community creations at a specific location).
 */
export async function getNearbyUserPostcards(
  lat: number,
  lng: number,
  radiusKm = 2,
  limit = 10,
): Promise<UserPostcard[]> {
  // Simple bounding box approach — good enough for nearby queries
  const latDelta = radiusKm / 111; // ~1 degree = 111km
  const lngDelta = radiusKm / (111 * Math.cos((lat * Math.PI) / 180));

  const { data, error } = await supabase
    .from('postalpeek_user_postcards')
    .select('*')
    .eq('is_public', true)
    .gte('lat', lat - latDelta)
    .lte('lat', lat + latDelta)
    .gte('lng', lng - lngDelta)
    .lte('lng', lng + lngDelta)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data as UserPostcard[]) || [];
}

/**
 * Enrich postcard metadata in the background.
 * Calls the existing postalpeek-enrich-metadata edge function
 * which adds storytelling, stats, trivia via Gemini text analysis.
 * Returns the enriched metadata or null on failure.
 */
export async function enrichPostcardMetadata(
  postcardId: string,
): Promise<Record<string, unknown> | null> {
  try {
    const { data, error } = await supabase.functions.invoke(
      'postalpeek-enrich-metadata',
      { body: { postcard_id: postcardId, table: 'postalpeek_user_postcards' } },
    );

    if (error) {
      console.warn('[Enrich] Edge function error:', error);
      return null;
    }

    return data as Record<string, unknown>;
  } catch (err) {
    console.warn('[Enrich] Failed to enrich postcard metadata:', err);
    return null;
  }
}

// ─── Location-only metadata (fast path for progressive loading) ──

export interface LocationMetadata {
  storytelling: {
    did_you_know: { es: string; en: string };
    fact_type: string;
  };
  stats: {
    history: number;
    nature: number;
    urban: number;
    vibe: number;
  };
  trivia: unknown;
  rarity: string;
}

/**
 * Fetch metadata for a location using text-only AI (no image needed).
 * This is the fast path (~2-3s) used during the illustration loading screen
 * to show facts, stats, and rarity while the illustration is still generating.
 */
export async function fetchLocationMetadata(
  lat: number,
  lng: number,
  city: string,
  country: string,
  locationName?: string,
): Promise<LocationMetadata | null> {
  try {
    const { data, error } = await supabase.functions.invoke(
      'postalpeek-enrich-metadata',
      {
        body: {
          lat,
          lng,
          city,
          country,
          location_name: locationName || `${city}, ${country}`,
        },
      },
    );

    if (error) {
      console.warn('[LocationMeta] Edge function error:', error);
      return null;
    }

    return data as LocationMetadata;
  } catch (err) {
    console.warn('[LocationMeta] Failed to fetch location metadata:', err);
    return null;
  }
}

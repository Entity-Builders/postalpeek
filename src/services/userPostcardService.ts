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
  status: string;
  is_public: boolean;
  created_at: string;
}

export interface CreateUserPostcardParams {
  userId: string;
  sourcePostcardId: string;
  pov: StreetViewPOV;
  city: string;
  country: string;
  locationName: string;
  style?: string;
}

/**
 * Full capture pipeline: Street View capture → AI illustration → save to DB.
 * Cost: ~$0.01 per call ($0.007 Static API + ~$0.002 Gemini Flash).
 */
export async function createUserPostcard(
  params: CreateUserPostcardParams,
): Promise<UserPostcard> {
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
      user_id: params.userId,
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
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to save user postcard:', error);
    throw error;
  }

  return data as UserPostcard;
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

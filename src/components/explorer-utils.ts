export type FramePhase = 'discovery' | 'refinement' | 'approach';

/**
 * Street View Metadata API — free endpoint, no charge.
 * Returns true if Street View imagery is available at the given location.
 * Prefers panoId for exact match; falls back to lat/lng with a 50m radius.
 *
 * Reference: https://developers.google.com/maps/documentation/streetview/metadata
 */
export async function checkStreetViewAvailability({
  panoId,
  lat,
  lng,
  mapsKey,
}: {
  panoId?: string | null;
  lat?: number | null;
  lng?: number | null;
  mapsKey: string;
}): Promise<boolean> {
  try {
    const params = new URLSearchParams({ key: mapsKey });
    if (panoId) {
      params.set('pano', panoId);
    } else if (lat != null && lng != null) {
      params.set('location', `${lat},${lng}`);
      params.set('radius', '50'); // 50m search radius
    } else {
      return false;
    }

    const url = `https://maps.googleapis.com/maps/api/streetview/metadata?${params.toString()}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return false;

    const data = await res.json();
    // status === 'OK' means imagery is available; 'ZERO_RESULTS' or 'NOT_FOUND' means it's not.
    return data?.status === 'OK';
  } catch {
    // On network error or timeout, allow navigation (fail-open)
    return true;
  }
}

export interface CapturedFrame {
  pano_id: string;
  heading: number;
  fov: number;
  pitch: number;
  lat: number;
  lng: number;
  index: number;
  phase: FramePhase;
  score?: number;
  prominence_pct?: number;
  narration?: string;
  is_winner?: boolean;
  status?: string;
  lens_type?: string;
  is_candidate?: boolean;
  parent_pano_id?: string;
}

export function svThumb(panoId: string, heading: number, fov: number, pitch: number, mapsKey: string, size = '640x426') {
  return `https://maps.googleapis.com/maps/api/streetview?size=${size}&pano=${panoId}&heading=${Math.round(heading)}&pitch=${Math.round(pitch)}&fov=${fov}&key=${mapsKey}`;
}

export function scoreColor(score: number) {
  if (score >= 7) return { bg: '#10b981', text: '#fff' };
  if (score >= 5) return { bg: '#f59e0b', text: '#fff' };
  return { bg: '#ef4444', text: '#fff' };
}

export function isApproachLensType(lensType?: string) {
  return lensType?.toLowerCase().includes('approach');
}

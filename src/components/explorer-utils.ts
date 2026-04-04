export type FramePhase = 'discovery' | 'refinement' | 'approach';

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

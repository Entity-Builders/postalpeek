export type StreetViewPovLike = {
  pano_id?: string | null;
  panoId?: string | null;
  pano?: string | null;
  heading?: number | null;
  pitch?: number | null;
  fov?: number | null;
  zoom?: number | null;
};

export function getStreetViewPanoId(
  pov?: StreetViewPovLike | null,
): string | undefined {
  return pov?.pano_id || pov?.panoId || pov?.pano || undefined;
}

export function fovToStreetViewZoom(fov?: number | null): number | undefined {
  if (typeof fov !== 'number' || !Number.isFinite(fov)) return undefined;
  return Math.max(0, Math.min(3, Math.round(((120 - fov) / 30) * 100) / 100));
}

export function getStreetViewZoom(
  pov?: StreetViewPovLike | null,
): number | undefined {
  if (typeof pov?.zoom === 'number' && Number.isFinite(pov.zoom)) {
    return pov.zoom;
  }

  return fovToStreetViewZoom(pov?.fov);
}

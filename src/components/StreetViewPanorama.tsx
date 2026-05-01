import React, { useEffect, useRef, useState, useCallback, useImperativeHandle, forwardRef } from 'react';
import { Loader2, Sparkles, Map } from 'lucide-react';

declare global {
  interface Window {
    google: typeof google;
    initMap: () => void;
  }
}

export interface StreetViewPOV {
  heading: number;
  pitch: number;
  zoom: number;
  lat: number;
  lng: number;
  panoId?: string;
}

/** Imperative handle to allow parent components to trigger capture */
export interface StreetViewPanoramaHandle {
  capture: () => void;
  navigateTo: (lat: number, lng: number) => void;
  setZoomLevel: (zoom: number) => void;
  getZoomLevel: () => number;
}

interface StreetViewPanoramaProps {
  address: string | null;
  /** When provided, skip geocoding and position the panorama exactly */
  lat?: number | null;
  lng?: number | null;
  /** Google Street View pano ID — opens the exact panorama sphere */
  panoId?: string | null;
  /** Initial heading in degrees (0-360) */
  initialHeading?: number | null;
  /** Initial pitch in degrees */
  initialPitch?: number | null;
  onCapture: (pov: StreetViewPOV) => void;
  isCapturing: boolean;
  /** When true, hides the built-in bottom bar (toolbar manages capture externally) */
  hideControls?: boolean;
  onPositionChanged?: (pos: { lat: number; lng: number }) => void;
  onZoomChanged?: (zoom: number) => void;
}

export const StreetViewPanorama = forwardRef<
  StreetViewPanoramaHandle,
  StreetViewPanoramaProps
>(function StreetViewPanorama(
  { address, lat, lng, panoId, initialHeading, initialPitch, onCapture, isCapturing, hideControls = false, onPositionChanged, onZoomChanged },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const panoramaRef = useRef<google.maps.StreetViewPanorama | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keep a stable ref to onPositionChanged so the position_changed listener
  // always calls the latest callback WITHOUT causing initPanorama to be
  // recreated (which would re-trigger the init effect and reset the view).
  const onPositionChangedRef = useRef(onPositionChanged);
  useEffect(() => {
    onPositionChangedRef.current = onPositionChanged;
  }, [onPositionChanged]);

  const onZoomChangedRef = useRef(onZoomChanged);
  useEffect(() => {
    onZoomChangedRef.current = onZoomChanged;
  }, [onZoomChanged]);

  // Expose capture method to parent via ref
  const handleCapture = useCallback(() => {
    if (!panoramaRef.current) return;

    const pov = panoramaRef.current.getPov();
    const pos = panoramaRef.current.getPosition();
    const zoom = panoramaRef.current.getZoom();
    const panoId = panoramaRef.current.getPano();

    if (!pos) return;

    onCapture({
      heading: Math.round(pov.heading * 100) / 100,
      pitch: Math.round(pov.pitch * 100) / 100,
      zoom: zoom,
      lat: pos.lat(),
      lng: pos.lng(),
      panoId: panoId || undefined,
    });
  }, [onCapture]);

  const handleNavigateTo = useCallback((lat: number, lng: number) => {
    if (!panoramaRef.current) return;
    const sv = new window.google.maps.StreetViewService();
    const pos = new window.google.maps.LatLng(lat, lng);
    sv.getPanorama({ location: pos, radius: 100 }, (data, status) => {
      if (status === 'OK' && data?.location?.latLng && panoramaRef.current) {
        panoramaRef.current.setPosition(data.location.latLng);
      }
    });
  }, []);

  const handleSetZoom = useCallback((zoom: number) => {
    if (!panoramaRef.current) return;
    panoramaRef.current.setZoom(zoom);
  }, []);

  const handleGetZoom = useCallback(() => {
    return panoramaRef.current?.getZoom() ?? 0;
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      capture: handleCapture,
      navigateTo: handleNavigateTo,
      setZoomLevel: handleSetZoom,
      getZoomLevel: handleGetZoom,
    }),
    [handleCapture, handleNavigateTo, handleSetZoom, handleGetZoom],
  );

  // Helper to create or reposition the panorama
  const initPanorama = useCallback(
    (
      target: { pano?: string; position?: google.maps.LatLng },
      heading: number,
      pitch: number,
    ) => {
      if (!containerRef.current) return;

      try {
        if (panoramaRef.current) {
          if (target.pano) {
            panoramaRef.current.setPano(target.pano);
          } else if (target.position) {
            panoramaRef.current.setPosition(target.position);
          }
          panoramaRef.current.setPov({ heading, pitch });
          panoramaRef.current.setZoom(0);
        } else {
          panoramaRef.current = new window.google.maps.StreetViewPanorama(
            containerRef.current,
            {
              ...(target.pano ? { pano: target.pano } : { position: target.position }),
              pov: { heading, pitch },
              zoom: 0,
              addressControl: false,
              showRoadLabels: false,
              linksControl: true,
              panControl: false,
              enableCloseButton: false,
              fullscreenControl: false,
              zoomControl: false,
              motionTracking: false,
            },
          );

          // Read from the ref so this listener always fires the latest callback
          // without forcing initPanorama to be recreated on every render.
          panoramaRef.current.addListener('position_changed', () => {
            const pos = panoramaRef.current?.getPosition();
            if (pos && onPositionChangedRef.current) {
              onPositionChangedRef.current({ lat: pos.lat(), lng: pos.lng() });
            }
          });

          // Sync zoom when user scrolls or pinches natively
          panoramaRef.current.addListener('pov_changed', () => {
            const z = panoramaRef.current?.getZoom();
            if (z !== undefined && onZoomChangedRef.current) {
              onZoomChangedRef.current(z);
            }
          });

          // Catch post-init failures (pano found but no imagery → black screen)
          panoramaRef.current.addListener('status_changed', () => {
            const status = panoramaRef.current?.getStatus();
            if (status === 'ZERO_RESULTS' || status === 'UNKNOWN_ERROR') {
              setError('No Street View imagery available at this location.');
              setIsReady(false);
            }
          });
        }
        setIsReady(true);
      } catch (err) {
        // Google Maps internal errors (e.g. imagery_viewer.js "a.B is not a function")
        console.warn('Street View init error (Google internal):', err);
        setError('Street View failed to load for this location.');
        setIsReady(false);
      }
    },
    [], // no dependency on onPositionChanged — uses ref instead
  );

  // Initialize panorama — prefer panoId > lat/lng > address geocoding
  useEffect(() => {
    if (!containerRef.current) return;
    if (!window.google?.maps) {
      setError('Google Maps not loaded. Check your API key.');
      return;
    }

    setError(null);
    setIsReady(false);

    const heading = initialHeading ?? 0;
    const pitch = initialPitch ?? 0;

    // ── Strategy 1: Exact pano ID (best precision) ──────────────────────
    if (panoId) {
      initPanorama({ pano: panoId }, heading, pitch);
      return;
    }

    // ── Strategy 2: Exact coordinates ───────────────────────────────────
    if (lat != null && lng != null) {
      const location = new window.google.maps.LatLng(lat, lng);
      const sv = new window.google.maps.StreetViewService();

      sv.getPanorama(
        { location, radius: 1000 },
        (
          data: google.maps.StreetViewPanoramaData | null,
          svStatus: google.maps.StreetViewStatus,
        ) => {
          if (svStatus !== 'OK' || !data?.location?.latLng) {
            setError('No Street View available at these coordinates.');
            return;
          }
          initPanorama({ position: data.location.latLng }, heading, pitch);
        },
      );
      return;
    }

    // ── Strategy 3: Address geocoding (fallback) ────────────────────────
    if (!address) return;

    const geocoder = new window.google.maps.Geocoder();

    geocoder.geocode({ address }, (results, status) => {
      if (status !== 'OK' || !results?.[0]) {
        setError(`Could not find location: "${address}"`);
        return;
      }

      const location = results[0].geometry.location;
      const sv = new window.google.maps.StreetViewService();

      sv.getPanorama(
        { location, radius: 100 },
        (
          data: google.maps.StreetViewPanoramaData | null,
          svStatus: google.maps.StreetViewStatus,
        ) => {
          if (svStatus !== 'OK' || !data?.location?.latLng) {
            setError('No Street View available for this location.');
            return;
          }
          initPanorama({ position: data.location.latLng }, heading, pitch);
        },
      );
    });
  }, [address, lat, lng, panoId, initialHeading, initialPitch, initPanorama]);

  return (
    <div className='w-full h-full relative overflow-hidden bg-black/20'>
      {/* Empty state */}
      {!address && (
        <div className='w-full h-full flex flex-col items-center justify-center text-slate-500 gap-4 opacity-70'>
          <Map className='w-12 h-12 mb-2 text-indigo-400/50' />
          <p className='font-light tracking-wide'>
            Search for an address to explore
          </p>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className='w-full h-full flex flex-col items-center justify-center text-red-400 gap-4'>
          <Map className='w-12 h-12 mb-2 text-red-400/50' />
          <p className='font-light tracking-wide text-sm px-8 text-center'>
            {error}
          </p>
        </div>
      )}

      {/* Panorama container — full bleed when in viewfinder mode */}
      <div
        ref={containerRef}
        className={`w-full h-full ${!address || error ? 'hidden' : ''}`}
      />

      {/* Loading overlay */}
      {address && !isReady && !error && (
        <div className='absolute inset-0 bg-white/5 backdrop-blur-sm z-10 flex flex-col items-center justify-center gap-5'>
          <Loader2 className='w-12 h-12 text-pink-400 animate-spin' />
          <p className='text-sm font-medium tracking-widest text-indigo-200 animate-pulse uppercase'>
            Traveling to location...
          </p>
        </div>
      )}

      {/* Bottom bar with Capture button — only shown when NOT in external toolbar mode */}
      {isReady && !error && !hideControls && (
        <div className='absolute bottom-6 left-6 right-6 flex items-end justify-between gap-4 z-20'>
          {/* Address label */}
          <div className='inline-block px-5 py-3 bg-black/50 backdrop-blur-xl rounded-xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)] animate-fade-in'>
            <p className='text-white text-sm md:text-base font-medium flex items-center gap-3'>
              <Map className='w-5 h-5 text-pink-400 shrink-0' />
              <span className='truncate max-w-[200px]'>{address}</span>
            </p>
          </div>

          {/* Capture & Illustrate Button */}
          <button
            onClick={handleCapture}
            disabled={isCapturing}
            className={`flex items-center gap-2 px-5 py-3 rounded-xl font-medium text-sm transition-all duration-300 shadow-[0_8px_32px_rgba(0,0,0,0.5)] animate-fade-in shrink-0 ${
              isCapturing
                ? 'bg-indigo-500/30 text-indigo-200 cursor-wait border border-indigo-400/20'
                : 'bg-gradient-to-r from-indigo-500 to-pink-500 text-white hover:from-indigo-400 hover:to-pink-400 hover:shadow-[0_8px_32px_rgba(99,102,241,0.4)] hover:scale-105 active:scale-95 border border-white/20'
            }`}
          >
            {isCapturing ? (
              <>
                <Loader2 className='w-4 h-4 animate-spin' />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className='w-4 h-4' />
                Capture & Illustrate
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
});

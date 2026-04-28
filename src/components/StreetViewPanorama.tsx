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
}

/** Imperative handle to allow parent components to trigger capture */
export interface StreetViewPanoramaHandle {
  capture: () => void;
}

interface StreetViewPanoramaProps {
  address: string | null;
  onCapture: (pov: StreetViewPOV) => void;
  isCapturing: boolean;
  /** When true, hides the built-in bottom bar (toolbar manages capture externally) */
  hideControls?: boolean;
}

export const StreetViewPanorama = forwardRef<
  StreetViewPanoramaHandle,
  StreetViewPanoramaProps
>(function StreetViewPanorama(
  { address, onCapture, isCapturing, hideControls = false },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const panoramaRef = useRef<google.maps.StreetViewPanorama | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Expose capture method to parent via ref
  const handleCapture = useCallback(() => {
    if (!panoramaRef.current) return;

    const pov = panoramaRef.current.getPov();
    const pos = panoramaRef.current.getPosition();
    const zoom = panoramaRef.current.getZoom();

    if (!pos) return;

    onCapture({
      heading: Math.round(pov.heading * 100) / 100,
      pitch: Math.round(pov.pitch * 100) / 100,
      zoom: zoom,
      lat: pos.lat(),
      lng: pos.lng(),
    });
  }, [onCapture]);

  useImperativeHandle(
    ref,
    () => ({
      capture: handleCapture,
    }),
    [handleCapture],
  );

  // Initialize panorama when address changes
  useEffect(() => {
    if (!address || !containerRef.current) return;
    if (!window.google?.maps) {
      setError('Google Maps not loaded. Check your API key.');
      return;
    }

    setError(null);
    setIsReady(false);

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

          if (panoramaRef.current) {
            panoramaRef.current.setPosition(data.location.latLng);
            panoramaRef.current.setPov({ heading: 0, pitch: 0 });
            panoramaRef.current.setZoom(0);
          } else {
            panoramaRef.current = new window.google.maps.StreetViewPanorama(
              containerRef.current!,
              {
                position: data.location.latLng,
                pov: { heading: 0, pitch: 0 },
                zoom: 0,
                addressControl: false,
                showRoadLabels: false,
                linksControl: true,
                panControl: false,
                enableCloseButton: false,
                fullscreenControl: false,
                zoomControl: true,
                motionTracking: false,
              },
            );
          }

          setIsReady(true);
        },
      );
    });
  }, [address]);

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

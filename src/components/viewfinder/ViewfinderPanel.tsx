/**
 * ViewfinderPanel.tsx
 *
 * Main right-panel component for Viewfinder mode.
 * Wraps the existing StreetViewPanorama with viewfinder aesthetics
 * (brackets, toolbar, compass) and capture orchestration.
 *
 * The capture is triggered via an imperative ref to StreetViewPanorama,
 * keeping the toolbar fully decoupled from the panorama internals.
 *
 * ref #94
 */

import React, { useCallback, useRef } from 'react';
import {
  StreetViewPanorama,
  type StreetViewPOV,
  type StreetViewPanoramaHandle,
} from '../StreetViewPanorama';
import { ViewfinderBrackets } from './ViewfinderBrackets';
import { ViewfinderToolbar } from './ViewfinderToolbar';
import { useViewfinder } from '../../hooks/useViewfinder';
import type { FeedItem } from '../Postcard';
import { MapPin, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cdnImage } from '../../utils/imageUtils';
import { useLang, t } from '../../utils/i18n';

interface ViewfinderPanelProps {
  sourceItem: FeedItem;
  userId: string | undefined;
  onPostcardCreated?: () => void;
}

export function ViewfinderPanel({
  sourceItem,
  userId,
  onPostcardCreated,
}: ViewfinderPanelProps) {
  const lang = useLang();
  const panoramaRef = useRef<StreetViewPanoramaHandle>(null);

  const {
    step,
    capturedPostcard,
    errorMessage,
    illustrationStyle,
    setIllustrationStyle,
    handleCapture,
    reset,
  } = useViewfinder(userId, sourceItem);

  // Use the location name or fall back to city, country
  const locationLabel =
    sourceItem.location_name || `${sourceItem.city}, ${sourceItem.country}`;

  // Handle capture from the StreetViewPanorama's POV
  const onPanoramaCapture = useCallback(
    (pov: StreetViewPOV) => {
      handleCapture(pov);
    },
    [handleCapture],
  );

  // Trigger capture via the imperative ref — clean, no DOM hacking
  const triggerCapture = useCallback(() => {
    panoramaRef.current?.capture();
  }, []);

  // Get the system postcard image for side-by-side comparison
  const systemPostcardUrl = sourceItem.illustration_url
    ? cdnImage(sourceItem.illustration_url, { width: 480 })
    : null;

  return (
    <div className="relative w-full h-full bg-[#0a0a0e] overflow-hidden">
      {/* Street View Panorama — full bleed, no built-in controls */}
      <div className="absolute inset-0">
        <StreetViewPanorama
          ref={panoramaRef}
          address={locationLabel}
          onCapture={onPanoramaCapture}
          isCapturing={step === 'capturing' || step === 'illustrating'}
          hideControls
        />
      </div>

      {/* Viewfinder brackets overlay */}
      <ViewfinderBrackets />

      {/* Location pill — top left */}
      <div className="absolute top-4 left-4 z-20">
        <div className="bg-black/60 backdrop-blur-xl rounded-full px-4 py-2 border border-white/10 shadow-lg">
          <p className="text-white text-sm font-medium flex items-center gap-2">
            <MapPin className="w-3.5 h-3.5 text-pink-400" />
            <span className="truncate max-w-[250px]">{locationLabel}</span>
          </p>
        </div>
      </div>

      {/* Capture toolbar — bottom center (uses imperative ref for clean capture) */}
      <ViewfinderToolbar
        step={step}
        illustrationStyle={illustrationStyle}
        onStyleChange={setIllustrationStyle}
        onCapture={triggerCapture}
        errorMessage={errorMessage}
      />

      {/* Success overlay — side-by-side: system vs user postcard */}
      <AnimatePresence>
        {step === 'success' && capturedPostcard && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-40 bg-[radial-gradient(circle_at_center,_transparent_0%,_rgba(0,0,0,0.8)_100%)] backdrop-blur-[2px] flex flex-col items-center justify-center gap-8 p-6 md:p-10"
          >
            {/* Title */}
            <motion.p
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-white text-sm font-bold uppercase tracking-[0.2em] drop-shadow-md"
            >
              {t({ es: '¡Postal creada!', en: 'Postcard Created!' }, lang)}
            </motion.p>

            {/* Side-by-side comparison */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30, delay: 0.2 }}
              className="flex flex-col md:flex-row gap-6 md:gap-12 max-w-6xl w-full items-center justify-center"
            >
              {/* System postcard — "The Original" */}
              {systemPostcardUrl && (
                <div className="flex-1 max-w-[280px] md:max-w-[320px] opacity-70 hover:opacity-100 transition-opacity duration-300">
                  <p className="text-white/50 text-[10px] font-semibold uppercase tracking-widest mb-3 text-center drop-shadow-md">
                    {t({ es: 'La Original', en: 'The Original' }, lang)}
                  </p>
                  <div className="rounded-xl overflow-hidden border border-white/10 shadow-2xl bg-white/5 rotate-[-2deg]">
                    <div className="p-1.5 pb-6">
                      <img
                        src={systemPostcardUrl}
                        alt="System postcard"
                        className="w-full aspect-[4/3] object-cover rounded-lg"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* User postcard — "Your Version" */}
              <div className="flex-1 max-w-[400px] md:max-w-[500px] z-10">
                <p className="text-white text-xs font-bold uppercase tracking-widest mb-4 text-center drop-shadow-lg flex items-center justify-center gap-2">
                  <span className="bg-gradient-to-r from-pink-400 to-indigo-400 text-transparent bg-clip-text">
                    {t({ es: 'Tu Versión', en: 'Your Version' }, lang)}
                  </span>
                  ✨
                </p>
                <motion.div 
                  initial={{ y: 20 }}
                  animate={{ y: 0 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 25, delay: 0.3 }}
                  className="rounded-2xl overflow-hidden border border-indigo-400/30 shadow-[0_20px_50px_rgba(99,102,241,0.3)] bg-white rotate-[1deg]"
                >
                  <div className="p-2 pb-8">
                    {capturedPostcard.illustration_url && (
                      <img
                        src={capturedPostcard.illustration_url}
                        alt="Your postcard"
                        className="w-full aspect-[4/3] object-cover rounded-xl"
                      />
                    )}
                  </div>
                </motion.div>
              </div>
            </motion.div>

            {/* Location context */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="text-white/80 text-sm font-medium flex items-center gap-2 drop-shadow-md mt-2"
            >
              <MapPin className="w-4 h-4 text-pink-400" />
              {sourceItem.city}, {sourceItem.country}
            </motion.p>

            {/* Actions */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="flex gap-3 mt-4"
            >
              <button
                onClick={() => {
                  reset();
                  onPostcardCreated?.();
                }}
                className="py-3 px-8 rounded-full bg-white text-black text-sm font-bold hover:bg-gray-100 transition-all duration-200 shadow-xl flex items-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                {t({ es: 'Crear otra', en: 'Create Another' }, lang)}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

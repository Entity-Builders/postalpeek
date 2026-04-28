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
            className="absolute inset-0 z-40 bg-black/85 backdrop-blur-md flex flex-col items-center justify-center gap-6 p-6 md:p-10"
          >
            {/* Title */}
            <motion.p
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-white/60 text-xs font-semibold uppercase tracking-[0.2em]"
            >
              {t({ es: '¡Postal creada!', en: 'Postcard Created!' }, lang)}
            </motion.p>

            {/* Side-by-side comparison */}
            <motion.div
              initial={{ scale: 0.85, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="flex flex-col md:flex-row gap-4 max-w-2xl w-full items-center"
            >
              {/* System postcard — "The Original" */}
              {systemPostcardUrl && (
                <div className="flex-1 max-w-[280px]">
                  <p className="text-white/30 text-[10px] font-semibold uppercase tracking-widest mb-2 text-center">
                    {t({ es: 'La Original', en: 'The Original' }, lang)}
                  </p>
                  <div className="rounded-xl overflow-hidden border border-white/10 shadow-xl bg-white/5">
                    <div className="p-1.5 pb-5">
                      <img
                        src={systemPostcardUrl}
                        alt="System postcard"
                        className="w-full aspect-[4/3] object-cover rounded-lg opacity-70"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* VS divider */}
              {systemPostcardUrl && (
                <div className="text-white/20 text-xs font-bold md:py-8">
                  VS
                </div>
              )}

              {/* User postcard — "Your Version" */}
              <div className="flex-1 max-w-[280px]">
                <p className="text-white/60 text-[10px] font-semibold uppercase tracking-widest mb-2 text-center">
                  {t({ es: 'Tu Versión', en: 'Your Version' }, lang)} ✨
                </p>
                <div className="rounded-xl overflow-hidden border border-indigo-400/20 shadow-[0_4px_30px_rgba(99,102,241,0.15)] bg-white">
                  <div className="p-1.5 pb-5">
                    {capturedPostcard.illustration_url && (
                      <img
                        src={capturedPostcard.illustration_url}
                        alt="Your postcard"
                        className="w-full aspect-[4/3] object-cover rounded-lg"
                      />
                    )}
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Location context */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-white/40 text-sm font-medium flex items-center gap-1.5"
            >
              <MapPin className="w-3 h-3" />
              {sourceItem.city}, {sourceItem.country}
            </motion.p>

            {/* Actions */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="flex gap-3"
            >
              <button
                onClick={() => {
                  reset();
                  onPostcardCreated?.();
                }}
                className="py-3 px-6 rounded-xl bg-gradient-to-r from-indigo-500 to-pink-500 text-white text-sm font-semibold hover:from-indigo-400 hover:to-pink-400 transition-all duration-200 shadow-lg flex items-center gap-2"
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

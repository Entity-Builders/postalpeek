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

      {/* Illustrating overlay — AI painting effect */}
      <AnimatePresence>
        {step === 'illustrating' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-20 pointer-events-none overflow-hidden"
          >
            {/* Darken the background slightly */}
            <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
            
            {/* Scanning line */}
            <motion.div
              initial={{ top: '-20%' }}
              animate={{ top: '120%' }}
              transition={{
                duration: 2.5,
                repeat: Infinity,
                ease: 'linear',
              }}
              className="absolute left-0 right-0 h-48 bg-gradient-to-b from-transparent via-indigo-500/10 to-transparent border-b border-indigo-400/40 shadow-[0_10px_30px_rgba(99,102,241,0.2)]"
            />
            
            {/* Center pulsing indicator */}
            <div className="absolute inset-0 flex items-center justify-center">
              <motion.div
                animate={{ scale: [0.95, 1.05, 0.95], opacity: [0.7, 1, 0.7] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                className="bg-black/60 backdrop-blur-2xl rounded-3xl px-8 py-6 border border-white/10 shadow-[0_0_50px_rgba(99,102,241,0.3)] flex flex-col items-center gap-4"
              >
                <div className="flex gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-pink-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <p className="text-white text-sm font-bold uppercase tracking-[0.2em] bg-gradient-to-r from-pink-400 via-purple-400 to-indigo-400 text-transparent bg-clip-text">
                  {t({ es: 'Pintando Postal...', en: 'Painting Postcard...' }, lang)}
                </p>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Success overlay — full bleed postcard replacing StreetView */}
      <AnimatePresence>
        {step === 'success' && capturedPostcard?.illustration_url && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
            className="absolute inset-0 z-40 bg-black"
          >
            {/* Full-screen generated image */}
            <img
              src={capturedPostcard.illustration_url}
              alt="Generated postcard"
              className="w-full h-full object-cover opacity-90"
            />
            
            {/* Gradient for text readability at the bottom */}
            <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-[#0a0a0e] via-[#0a0a0e]/50 to-transparent" />
            
            {/* Location and actions over the image */}
            <div className="absolute inset-0 flex flex-col justify-end items-center pb-12 px-6 z-50">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="flex flex-col items-center gap-6 text-center w-full max-w-md"
              >
                {/* Location text */}
                <div>
                  <p className="text-white/80 text-xs font-bold uppercase tracking-widest mb-2 flex items-center justify-center gap-2 drop-shadow-md">
                    <MapPin className="w-4 h-4 text-pink-400" />
                    {sourceItem.city}, {sourceItem.country}
                  </p>
                  <h2 className="text-white text-2xl font-bold drop-shadow-lg">
                    {t({ es: '¡Tu postal está lista!', en: 'Your postcard is ready!' }, lang)}
                  </h2>
                </div>

                {/* Actions */}
                <div className="w-full flex flex-col gap-3">
                  <button
                    onClick={() => {
                      reset();
                      onPostcardCreated?.();
                    }}
                    className="w-full py-3.5 px-8 rounded-2xl bg-white text-black text-sm font-bold hover:bg-gray-100 transition-all duration-200 shadow-xl flex items-center justify-center gap-2"
                  >
                    <RotateCcw className="w-4 h-4" />
                    {t({ es: 'Capturar otro rincón', en: 'Capture another corner' }, lang)}
                  </button>
                  <button
                    onClick={() => {
                      // Future: Download or share
                    }}
                    className="w-full py-3.5 px-8 rounded-2xl bg-white/10 backdrop-blur-md text-white text-sm font-bold border border-white/20 hover:bg-white/20 transition-all duration-200 shadow-lg"
                  >
                    {t({ es: 'Guardar / Compartir', en: 'Save / Share' }, lang)}
                  </button>
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

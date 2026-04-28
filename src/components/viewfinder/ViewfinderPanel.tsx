/**
 * ViewfinderPanel.tsx
 *
 * Main right-panel component for Viewfinder mode.
 * Wraps the existing StreetViewPanorama with viewfinder aesthetics
 * (brackets, toolbar, compass) and capture orchestration.
 *
 * ref #94
 */

import React, { useCallback, useRef } from 'react';
import { StreetViewPanorama, type StreetViewPOV } from '../StreetViewPanorama';
import { ViewfinderBrackets } from './ViewfinderBrackets';
import { ViewfinderToolbar } from './ViewfinderToolbar';
import { useViewfinder } from '../../hooks/useViewfinder';
import type { FeedItem } from '../Postcard';
import { MapPin } from 'lucide-react';
import { motion } from 'framer-motion';

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

  // The existing StreetViewPanorama component handles loading the
  // interactive panorama at the given address/coordinates.
  // We pass the location_name as the address for geocoding.

  return (
    <div className="relative w-full h-full bg-[#0a0a0e] overflow-hidden">
      {/* Street View Panorama — full bleed */}
      <div className="absolute inset-0">
        <StreetViewPanorama
          address={locationLabel}
          onCapture={onPanoramaCapture}
          isCapturing={step === 'capturing' || step === 'illustrating'}
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

      {/* Capture toolbar — bottom center */}
      <ViewfinderToolbar
        step={step}
        illustrationStyle={illustrationStyle}
        onStyleChange={setIllustrationStyle}
        onCapture={() => {
          // We need to trigger capture from the StreetViewPanorama.
          // The panorama's onCapture callback will fire with the current POV.
          // To trigger it, we simulate a click on the hidden capture button.
          // Actually, the StreetViewPanorama already has a capture button.
          // We'll hide its default button and use our toolbar instead.
          // For now, we call the panorama's capture programmatically.
          const panoContainer = document.querySelector(
            '.viewfinder-panorama-container',
          );
          if (panoContainer) {
            const captureBtn =
              panoContainer.querySelector<HTMLButtonElement>(
                '[data-capture-btn]',
              );
            captureBtn?.click();
          }
        }}
        errorMessage={errorMessage}
      />

      {/* Success overlay — shows the created postcard */}
      {step === 'success' && capturedPostcard && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 z-40 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center gap-6 p-8"
        >
          <motion.div
            initial={{ scale: 0.8, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="max-w-sm w-full"
          >
            {/* Postcard preview */}
            <div className="rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-white">
              <div className="p-2 pb-8">
                {capturedPostcard.illustration_url && (
                  <img
                    src={capturedPostcard.illustration_url}
                    alt="Your postcard"
                    className="w-full aspect-[4/3] object-cover rounded-xl"
                  />
                )}
              </div>
            </div>

            {/* Actions — self-contained, no navigation to other app sections */}
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => {
                  reset();
                  onPostcardCreated?.();
                }}
                className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-500 to-pink-500 text-white text-sm font-semibold hover:from-indigo-400 hover:to-pink-400 transition-all duration-200 shadow-lg"
              >
                🎨 Create Another
              </button>
            </div>
          </motion.div>

          <p className="text-white/40 text-xs font-medium tracking-wide">
            Your postcard has been saved!
          </p>
        </motion.div>
      )}
    </div>
  );
}

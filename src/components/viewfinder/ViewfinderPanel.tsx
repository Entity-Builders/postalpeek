/**
 * ViewfinderPanel.tsx
 *
 * Main panel for Viewfinder mode.
 * Wraps StreetViewPanorama with camera-style UX.
 *
 * Simplified flow (v2):
 *   1. Viewfinder — user explores Street View, takes a snapshot
 *   2. Preview — polaroid frame with captured image, "Generate" or "Retake"
 *   3. Illustrating — watercolor blobs animation while AI works
 *   4. Success — flippable postcard (front + back with metadata)
 *
 * ref #94
 */

import React, { useCallback, useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  StreetViewPanorama,
  type StreetViewPOV,
  type StreetViewPanoramaHandle,
} from '../StreetViewPanorama';
import { ViewfinderBrackets } from './ViewfinderBrackets';
import { useViewfinder } from '../../hooks/useViewfinder';
import type { FeedItem } from '../Postcard';
import { PostcardBack } from '../PostcardBack';
import { PostcardFront } from '../PostcardFront';
import { FullscreenOverlay } from '../FullscreenOverlay';
import { MapPin, ArrowLeft, Sparkles, RotateCcw, AlertCircle, Map, X, Compass, Loader2, RotateCw } from 'lucide-react';
import { motion, AnimatePresence, useMotionValue, useAnimate } from 'framer-motion';
import { useLang, t } from '../../utils/i18n';
import { DynamicMiniMap } from './DynamicMiniMap';
import { CameraFAB } from './CameraFAB';
import { ViewfinderOnboarding } from './ViewfinderOnboarding';
import { TripCounter } from '../ui/TripCounter';
import { LoadingMetadata } from './LoadingMetadata';


const MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? '';

const ILLUSTRATION_STYLES = [
  { id: 'default', label: 'Classic' },
  { id: 'watercolor', label: 'Watercolor' },
  { id: 'vintage', label: 'Vintage' },
  { id: 'pop-art', label: 'Pop Art' },
  { id: 'minimalist', label: 'Minimal' },
];

interface ViewfinderPanelProps {
  sourceItem: FeedItem;
  userId: string | undefined;
  userIsAnonymous?: boolean;
  onPostcardCreated?: () => void;
  onAuthRequired?: (action: () => void) => void;
  onBack?: (options?: { isFromSuccess?: boolean; newCard?: FeedItem }) => void;
  onPositionChanged?: (pos: { lat: number; lng: number } | null) => void;
  /** Called when a postcard is saved — provides data to update local progress */
  onSlotCompleted?: (data: {
    sourcePostcardId: string;
    userPostcardId: string;
    illustrationUrl: string;
    city: string;
    country: string;
  }) => void;
}

// Spring configs for the flip animation
const springFlip = {
  type: 'spring' as const,
  stiffness: 300,
  damping: 28,
  duration: 0.1,
};

export function ViewfinderPanel({
  sourceItem,
  userId,
  userIsAnonymous,
  onPostcardCreated,
  onAuthRequired,
  onBack,
  onPositionChanged,
  onSlotCompleted,
}: ViewfinderPanelProps) {
  const lang = useLang();
  const panoramaRef = useRef<StreetViewPanoramaHandle>(null);

  const {
    step,
    capturedPostcard,
    capturedFeedItem,
    capturedDataUrl,
    errorMessage,
    illustrationStyle,
    isSaving,
    creatorName,
    setCreatorName,
    setIllustrationStyle,
    handleSnapshot,
    handleGenerate,
    handleConfirmName,
    handleSave,
    tripRemaining,
    tripLimit,
    loadingMetadata,
    reset,
  } = useViewfinder(userId, sourceItem, userIsAnonymous);

  const [showMiniMap, setShowMiniMap] = useState(true);
  const [isMapFullscreen, setIsMapFullscreen] = useState(false);

  const fullscreenClasses = "absolute inset-0 z-0 transition-all duration-500 ease-in-out rounded-none border-none";
  const pipClasses = "absolute top-32 right-4 z-40 w-28 h-28 sm:w-32 sm:h-32 rounded-xl overflow-hidden shadow-2xl border-2 border-white/20 transition-all duration-500 ease-in-out cursor-pointer hover:scale-105 pointer-events-auto bg-[#0a0a0e]";

  // Flip state for the success postcard
  const [isFlipped, setIsFlipped] = useState(false);
  const rotateY = useMotionValue(0);
  const [flipScope, animateFlip] = useAnimate();

  const flipTo = useCallback(
    (flipped: boolean) => {
      setIsFlipped(flipped);
      const target = flipped ? 180 : 0;
      animateFlip(flipScope.current, { rotateY: target }, springFlip).then(() => {
        rotateY.set(target);
      });
    },
    [animateFlip, flipScope, rotateY],
  );

  /** Clean/expand mode — hides chrome, enables fullscreen overlay */
  const [isClean, setIsClean] = useState(false);
  const toggleClean = useCallback(() => {
    setIsClean((prev) => !prev);
  }, []);

  const [showOverlay, setShowOverlay] = useState(false);
  useEffect(() => {
    if (isClean) {
      const timer = setTimeout(() => setShowOverlay(true), 150);
      return () => clearTimeout(timer);
    } else {
      setShowOverlay(false);
    }
  }, [isClean]);

  // State for tracking current position (for mini map)
  const [currentPos, setCurrentPos] = useState<{lat: number; lng: number} | null>(
    sourceItem.lat && sourceItem.lng ? { lat: sourceItem.lat, lng: sourceItem.lng } : null
  );

  // Use the location name or fall back to city, country
  const locationLabel =
    sourceItem.location_name || `${sourceItem.city}, ${sourceItem.country}`;

  // Build a Street View Static API image URL from POV data
  const buildStaticUrl = useCallback(
    (pov: StreetViewPOV) => {
      const base = 'https://maps.googleapis.com/maps/api/streetview';
      const params = new URLSearchParams({
        size: '600x640',
        heading: String(Math.round(pov.heading)),
        pitch: String(Math.round(pov.pitch)),
        fov: String(Math.min(120, Math.max(10, 180 / Math.pow(2, pov.zoom ?? 0)))),
        key: MAPS_KEY,
      });
      // Prefer panoId for exact match, fall back to lat/lng
      if (pov.panoId) {
        params.set('pano', pov.panoId);
      } else {
        params.set('location', `${pov.lat},${pov.lng}`);
      }
      return `${base}?${params.toString()}`;
    },
    [],
  );

  // Handle capture from the StreetViewPanorama → go to preview
  const onPanoramaCapture = useCallback(
    (pov: StreetViewPOV) => {
      const staticUrl = buildStaticUrl(pov);
      handleSnapshot(pov, staticUrl);
    },
    [handleSnapshot, buildStaticUrl],
  );

  // Trigger capture via the imperative ref
  const triggerCapture = useCallback(() => {
    panoramaRef.current?.capture();
  }, []);

  // Save postcard and navigate back to globe
  const handleSaveAndReturn = useCallback(async () => {
    
    const saved = await handleSave();
    if (saved) {
      // Notify globe to update local progress
      if (onSlotCompleted && capturedPostcard && capturedFeedItem) {
        onSlotCompleted({
          sourcePostcardId: sourceItem.id,
          userPostcardId: capturedPostcard.id,
          illustrationUrl: capturedFeedItem.illustration_url || '',
          city: sourceItem.city || '',
          country: sourceItem.country || '',
        });
      }
      onPostcardCreated?.();
      reset();
      onBack?.({ isFromSuccess: true, newCard: capturedFeedItem ?? undefined });
    }
  }, [userIsAnonymous, onAuthRequired, handleSave, onPostcardCreated, reset, onBack, onSlotCompleted, capturedPostcard, capturedFeedItem, sourceItem]);

  // When in success state, disable Street View interaction
  const isSuccessState = step === 'success';
  const isPreviewOrBeyond = step !== 'viewfinder';

  return (
    <div className="relative w-full h-full bg-[#0a0a0e] overflow-hidden">
      {/* Street View Panorama Container */}
      <div className={`${isMapFullscreen ? pipClasses : fullscreenClasses} ${isPreviewOrBeyond ? 'pointer-events-none' : ''}`}>
        {isMapFullscreen && step === 'viewfinder' && (
          <div 
            className="absolute inset-0 z-50 cursor-pointer" 
            onClick={() => setIsMapFullscreen(false)}
          />
        )}
        {sourceItem.is_free && (sourceItem.lat == null || sourceItem.lng == null) ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 bg-[#0a0a0e]">
            <MapPin className="w-16 h-16 text-white/20 mb-4" />
            <h2 className="text-white text-2xl font-black italic tracking-wider uppercase mb-2">
              {t({ es: "DESTINO LIBRE", en: "FREE DESTINATION" }, lang)}
            </h2>
            <p className="text-white/50 text-sm max-w-sm">
              {t({ 
                es: "Utiliza el panel para buscar una dirección o clavar un pin en el mapa.", 
                en: "Use the panel to search for an address or drop a pin on the map." 
              }, lang)}
            </p>
          </div>
        ) : (
          <StreetViewPanorama
            ref={panoramaRef}
            address={locationLabel}
            lat={sourceItem.lat}
            lng={sourceItem.lng}
            panoId={sourceItem.streetview_pov?.pano_id}
            initialHeading={sourceItem.streetview_pov?.heading}
            initialPitch={sourceItem.streetview_pov?.pitch}
            onCapture={onPanoramaCapture}
            isCapturing={step === 'illustrating'}
            hideControls
            onPositionChanged={(pos) => {
              setCurrentPos(pos);
              if (onPositionChanged) onPositionChanged(pos);
            }}
          />
        )}
        {/* Blur overlay when showing preview/success */}
        {isPreviewOrBeyond && (
          <div className="absolute inset-0 z-10 bg-black/40 backdrop-blur-[2px]" />
        )}
        {/* Bottom gradient to cover Google branding */}
        {!isMapFullscreen && (
          <div className="absolute bottom-0 left-0 right-0 h-14 z-10 bg-gradient-to-t from-[#0a0a0e] via-[#0a0a0e]/80 to-transparent pointer-events-none" />
        )}
      </div>


      {/* ─── Back button ─── top-left, viewfinder step only */}
      {step === 'viewfinder' && onBack && (
        <button
          onClick={() => onBack?.()}
          className="absolute top-6 left-4 z-30 flex items-center justify-center w-10 h-10 rounded-full bg-black/50 backdrop-blur-md border border-white/15 text-white/80 hover:text-white hover:bg-black/70 transition-all active:scale-90 cursor-pointer shadow-lg"
          aria-label="Back"
        >
          <ArrowLeft size={18} />
        </button>
      )}

      {/* Camera Flash Effect */}
      <AnimatePresence>
        {step === 'preview' && (
          <motion.div
            initial={{ opacity: 1 }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="absolute inset-0 bg-white z-50 pointer-events-none"
          />
        )}
      </AnimatePresence>

      {/* ─── Mini Map Toggle Button ─── */}
      {currentPos && step === 'viewfinder' && (
        <div className="absolute top-20 right-4 z-50">
          <button
            onClick={() => {
              if (showMiniMap && isMapFullscreen) {
                setIsMapFullscreen(false);
              }
              setShowMiniMap(v => !v);
            }}
            className="pointer-events-auto flex items-center justify-center w-8 h-8 rounded-full bg-black/50 backdrop-blur-md border border-white/15 text-white/70 hover:text-white hover:bg-black/70 transition-all active:scale-90 cursor-pointer shadow-lg"
            aria-label={showMiniMap ? 'Hide mini map' : 'Show mini map'}
          >
            {showMiniMap ? <X size={14} /> : <Map size={14} />}
          </button>
        </div>
      )}

      {/* ─── Mini Map Container ─── */}
      <AnimatePresence>
        {showMiniMap && currentPos && step === 'viewfinder' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.3 }}
            className={`${!isMapFullscreen ? pipClasses : fullscreenClasses} bg-[#0a0a0e]`}
          >
            <DynamicMiniMap 
              currentLat={currentPos.lat} 
              currentLng={currentPos.lng} 
              targetLat={sourceItem.lat || undefined}
              targetLng={sourceItem.lng || undefined}
              zoom={14}
              className="w-full h-full"
              interactive={isMapFullscreen}
              onLocationClick={(lat, lng) => {
                panoramaRef.current?.navigateTo(lat, lng);
                setIsMapFullscreen(false);
              }}
            />
            {/* Click overlay for PIP mode */}
            {!isMapFullscreen && (
              <div 
                className="absolute inset-0 z-50 cursor-pointer" 
                onClick={() => setIsMapFullscreen(true)}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>





      {/* ─── NAMING STATE ─── User enters their display name before seeing the result */}
      <AnimatePresence>
        {step === 'naming' && capturedFeedItem && (
          <motion.div
            key="naming-screen"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ type: 'spring', damping: 24, stiffness: 120 }}
            className="absolute inset-0 z-40 flex flex-col items-center justify-center px-6"
          >
            {/* Blurred postcard preview in background */}
            <div className="absolute inset-0 z-0 overflow-hidden">
              {capturedDataUrl && (
                <img
                  src={capturedDataUrl}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover blur-2xl scale-110 opacity-40"
                />
              )}
              <div className="absolute inset-0 bg-[#0a0a0e]/70" />
            </div>

            {/* Content */}
            <div className="relative z-10 flex flex-col items-center gap-6 w-full max-w-[360px]">
              {/* Postcard mini preview */}
              <motion.div
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1, type: 'spring', stiffness: 200, damping: 20 }}
                className="w-24 h-24 rounded-xl overflow-hidden shadow-2xl border border-white/10"
              >
                <img
                  src={capturedFeedItem.illustration_url || capturedDataUrl || ''}
                  alt=""
                  className="w-full h-full object-cover"
                />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-center"
              >
                <h2 className="text-white font-black text-2xl tracking-tight">
                  {t({ es: '¡Postal lista! 🎉', en: 'Postcard ready! 🎉' }, lang)}
                </h2>
                <p className="text-white/50 text-sm mt-1">
                  {t({ es: '¿Cómo quieres que te llamen?', en: 'What should we call you?' }, lang)}
                </p>
              </motion.div>

              {/* Name input */}
              <NamingForm
                initialName={creatorName}
                lang={lang}
                onConfirm={handleConfirmName}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── ILLUSTRATING STATE ─── Polaroid with photo and watercolor blobs overlay */}
      <AnimatePresence>
        {step === 'illustrating' && capturedDataUrl && (
          <motion.div
            key="illustrating-polaroid"
            initial={{ opacity: 0, y: 60, scale: 0.85 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: 'spring', damping: 22, stiffness: 120 }}
            className="absolute inset-0 z-30 flex flex-col items-center justify-center px-6 overflow-y-auto"
          >
            <div className="relative w-[85vw] max-w-[420px] bg-[#F9F8F4] p-3 pb-14 shadow-[0_30px_60px_rgba(0,0,0,0.6)] rounded-sm flex-shrink-0" style={{ transform: 'rotate(-1.5deg)' }}>
              <div className="relative aspect-square w-full bg-[#E5E5E5] overflow-hidden shadow-[inset_0_2px_10px_rgba(0,0,0,0.05)]">
                {/* Captured Photo */}
                <img 
                  src={capturedDataUrl} 
                  alt="Captured snapshot" 
                  className="absolute inset-0 w-full h-full object-cover object-top grayscale-[0.2]"
                />
                
                {/* Overlay to fade photo slightly */}
                <div className="absolute inset-0 bg-white/20 backdrop-blur-[1px]" />

                {/* Watercolor blobs animation */}
                <div className="absolute inset-0 flex items-center justify-center mix-blend-hard-light opacity-80">
                  <motion.div
                    animate={{ scale: [1, 1.5, 1], opacity: [0.4, 0.8, 0.4] }}
                    transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                    className="absolute w-32 h-32 bg-cyan-400 rounded-full blur-2xl -translate-x-4 -translate-y-4"
                  />
                  <motion.div
                    animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0.7, 0.3] }}
                    transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
                    className="absolute w-28 h-28 bg-fuchsia-400 rounded-full blur-2xl translate-x-8 translate-y-6"
                  />
                  <motion.div
                    animate={{ scale: [1, 1.4, 1], opacity: [0.2, 0.6, 0.2] }}
                    transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
                    className="absolute w-36 h-36 bg-yellow-300 rounded-full blur-3xl -translate-y-8 translate-x-4"
                  />
                </div>
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-14 flex items-center justify-center px-4">
                <motion.div 
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="text-gray-500 font-serif italic text-xl truncate w-full text-center"
                >
                  {t({ es: 'Revelando...', en: 'Developing...' }, lang)}
                </motion.div>
              </div>
            </div>

            {/* ─── Progressive Metadata Reveal ─── */}
            <LoadingMetadata
              metadata={loadingMetadata}
              city={sourceItem.city}
              country={sourceItem.country}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── ERROR STATE ─── */}
      <AnimatePresence>
        {step === 'error' && (
          <motion.div
            key="error-state"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-30 flex flex-col items-center justify-center px-6"
          >
            <div className="flex flex-col items-center gap-4 bg-black/60 backdrop-blur-xl rounded-2xl p-8 border border-red-500/30 max-w-[320px]">
              <AlertCircle className="w-10 h-10 text-red-400" />
              <p className="text-white/90 text-sm text-center">{errorMessage || 'Something went wrong'}</p>
              <button
                onClick={reset}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-semibold transition-all border border-white/10 active:scale-95"
              >
                <RotateCcw className="w-4 h-4" />
                {t({ es: 'Intentar de nuevo', en: 'Try Again' }, lang)}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── SUCCESS STATE ─── Flippable Postcard (front illustration + back metadata) */}
      <AnimatePresence>
        {step === 'success' && capturedFeedItem && (
          <motion.div
            key="success-postcard"
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ type: 'spring', damping: 20, stiffness: 100 }}
            className="absolute inset-0 z-30 flex flex-col items-center justify-center pointer-events-none px-6"
          >
            {/* Flippable Postcard Container */}
            <div 
              className="relative w-[85vw] max-w-[420px] aspect-[3/4] pointer-events-auto cursor-pointer"
              style={{ perspective: '1000px' }}
            >
              <motion.div
                ref={flipScope}
                className="w-full h-full relative"
                style={{
                  transformStyle: 'preserve-3d',
                  willChange: 'transform',
                  rotateY,
                }}
              >
                {/* FRONT — Illustration Postcard (using unified PostcardFront) */}
                <div
                  className={`absolute inset-0 w-full h-full rounded-xl overflow-hidden transition-colors duration-300 ${isClean ? 'bg-transparent' : 'bg-white'}`}
                  style={{
                    backfaceVisibility: 'hidden',
                    WebkitBackfaceVisibility: 'hidden',
                    boxShadow: isClean ? 'none' : `0 30px 60px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(0,0,0,0.05)${
                      capturedFeedItem.rarity === 'legendary' ? ', 0 0 30px rgba(245, 158, 11, 0.4)' :
                      capturedFeedItem.rarity === 'epic' ? ', 0 0 25px rgba(139, 92, 246, 0.3)' :
                      capturedFeedItem.rarity === 'rare' ? ', 0 0 20px rgba(59, 130, 246, 0.25)' : ''
                    }`,
                  }}
                >
                  <PostcardFront
                    item={capturedFeedItem}
                    mainImgUrl={capturedFeedItem.illustration_url}
                    onFlipCard={(view) => {
                      flipTo(true);
                    }}
                    handleImageError={() => {}}
                    hideActions={true}
                    isClean={isClean}
                    onToggleClean={toggleClean}
                  />
                </div>

                {/* BACK — Reusing PostcardBack without simplified mode */}
                <PostcardBack
                  item={capturedFeedItem}
                  polaroidUrl={capturedDataUrl || ''}
                  handleImageError={() => {}}
                  onFlipBack={() => flipTo(false)}
                  isActive={true}
                  isGridMode={true}
                />
              </motion.div>
            </div>


            {/* ─── Action Buttons ─── */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mt-6 w-[85vw] max-w-[420px] flex flex-col gap-3 pointer-events-auto"
            >

              {/* Action: Save and Back to Feed */}
              <div className="flex gap-2">
                <button
                  onClick={() => flipTo(!isFlipped)}
                  className="flex-1 py-3.5 px-4 rounded-xl bg-white/10 backdrop-blur-md text-white/90 text-sm font-semibold hover:bg-white/20 transition-all flex justify-center items-center gap-2 border border-white/15 active:scale-95 shadow-lg"
                >
                  <RotateCw className="w-4 h-4" />
                  {isFlipped ? t({ es: 'Ver frente', en: 'View front' }, lang) : t({ es: 'Acerca de', en: 'About' }, lang)}
                </button>

                <button
                  onClick={() => {
                    setIsFlipped(false);
                    handleSaveAndReturn();
                  }}
                  className="flex-1 py-3.5 px-4 rounded-xl bg-indigo-500/80 backdrop-blur-md text-white text-sm font-semibold hover:bg-indigo-600/80 transition-all flex justify-center items-center gap-2 border border-indigo-400/30 active:scale-95 shadow-lg"
                >
                  {isSaving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Compass className="w-4 h-4" />
                  )}
                  {t({ es: 'Volver al feed', en: 'Back to feed' }, lang)}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Viewfinder Onboarding Overlay (first-time only) ─── */}
      <ViewfinderOnboarding active={step === 'viewfinder'} />

      {/* ─── Bottom Toolbar — CameraFAB + Trip Counter ─── */}
      {step === 'viewfinder' && !isMapFullscreen && (
        <div className="absolute bottom-12 left-0 right-0 z-30 flex flex-col items-center gap-2 pointer-events-none">
          <div className="pointer-events-auto">
            <TripCounter remaining={tripRemaining} limit={tripLimit} />
          </div>
          <div className="pointer-events-auto">
            <CameraFAB onClick={triggerCapture} />
          </div>
        </div>
      )}

      {/* Global CSS for scrollbar hiding and edge masking */}
      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .mask-edges {
          mask-image: linear-gradient(to right, transparent, black 15%, black 85%, transparent);
          -webkit-mask-image: linear-gradient(to right, transparent, black 15%, black 85%, transparent);
        }
      `}
      </style>

      {/* Fullscreen overlay — portaled to body to escape transforms */}
      {createPortal(
        <AnimatePresence>
          {showOverlay && capturedFeedItem && (
            <FullscreenOverlay
              item={capturedFeedItem}
              cachedUrl={capturedFeedItem.illustration_url}
              onClose={toggleClean}
            />
          )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  );
}

// ─── NamingForm ──────────────────────────────────────────────────────────────
// Compact name input shown once when first postcard is generated.

function NamingForm({
  initialName,
  lang,
  onConfirm,
}: {
  initialName: string;
  lang: ReturnType<typeof useLang>;
  onConfirm: (name: string) => void;
}) {
  const [value, setValue] = React.useState(initialName);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm(value);
  };

  return (
    <motion.form
      onSubmit={handleSubmit}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="w-full flex flex-col gap-3"
    >
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={t({ es: 'Tu nombre o apodo...', en: 'Your name or nickname...' }, lang)}
        maxLength={32}
        autoFocus
        className="w-full px-4 py-3.5 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/30 text-base font-medium focus:outline-none focus:border-white/50 focus:bg-white/15 transition-all backdrop-blur-md"
      />
      <button
        type="submit"
        className="w-full py-3.5 rounded-xl bg-white text-black font-bold text-sm tracking-wide hover:bg-white/90 active:scale-95 transition-all shadow-lg"
      >
        {t({ es: '✉️ Ver mi postal', en: '✉️ See my postcard' }, lang)}
      </button>
      <button
        type="button"
        onClick={() => onConfirm('')}
        className="text-white/30 text-xs hover:text-white/50 transition-colors py-1"
      >
        {t({ es: 'Continuar sin nombre', en: 'Continue without a name' }, lang)}
      </button>
    </motion.form>
  );
}

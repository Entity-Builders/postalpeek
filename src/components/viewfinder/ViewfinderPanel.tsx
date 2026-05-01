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
 *   4. Success — final postcard shown in polaroid
 *
 * ref #94
 */

import React, { useCallback, useRef, useState } from 'react';
import {
  StreetViewPanorama,
  type StreetViewPOV,
  type StreetViewPanoramaHandle,
} from '../StreetViewPanorama';
import { ViewfinderBrackets } from './ViewfinderBrackets';
import { useViewfinder } from '../../hooks/useViewfinder';
import type { FeedItem } from '../Postcard';
import { MapPin, Eye, Camera, ArrowLeft, Sparkles, Loader2, RotateCcw, AlertCircle, Map, X, Grid3x3 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cdnImage } from '../../utils/imageUtils';
import { useLang, t } from '../../utils/i18n';
import { DynamicMiniMap } from './DynamicMiniMap';
import { CameraFAB } from './CameraFAB';
import { ZoomSlider } from './ZoomSlider';

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
  onBack?: () => void;
  onPositionChanged?: (pos: { lat: number; lng: number } | null) => void;
}

export function ViewfinderPanel({
  sourceItem,
  userId,
  userIsAnonymous,
  onPostcardCreated,
  onAuthRequired,
  onBack,
  onPositionChanged,
}: ViewfinderPanelProps) {
  const lang = useLang();
  const panoramaRef = useRef<StreetViewPanoramaHandle>(null);

  const {
    step,
    capturedPostcard,
    capturedDataUrl,
    errorMessage,
    illustrationStyle,
    setIllustrationStyle,
    handleSnapshot,
    handleGenerate,
    reset,
  } = useViewfinder(userId, sourceItem);

  const [isOriginalView, setIsOriginalView] = useState(false);
  const [showMiniMap, setShowMiniMap] = useState(true);

  // Two-mode camera: exploring (walking around) vs composing (framing the shot)
  const [cameraMode, setCameraMode] = useState<'exploring' | 'composing'>('exploring');
  const [zoomLevel, setZoomLevel] = useState(0);
  const [showGrid, setShowGrid] = useState(false);

  // When entering composing mode, sync slider with actual panorama zoom
  const enterComposingMode = useCallback(() => {
    const currentZoom = panoramaRef.current?.getZoomLevel() ?? 0;
    setZoomLevel(currentZoom);
    setCameraMode('composing');
  }, []);

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

  // Download or share the generated postcard
  const handleSaveOrShare = useCallback(async () => {
    if (!capturedPostcard?.illustration_url) return;

    if (userIsAnonymous && onAuthRequired) {
      onAuthRequired(handleSaveOrShare);
      return;
    }
    
    try {
      const locationName = `${sourceItem.city}-${sourceItem.country}`.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
      const fileName = `postalpeek-${locationName}.jpg`;

      const response = await fetch(capturedPostcard.illustration_url);
      const blob = await response.blob();
      const file = new File([blob], fileName, { type: blob.type });

      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: 'My PostalPeek Postcard',
          text: `Check out this postcard I captured from ${sourceItem.city}, ${sourceItem.country} on PostalPeek!`,
          url: `https://postalpeek.com/postcard/${capturedPostcard.id}`,
          files: [file],
        });
      } else {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        console.error('Error sharing/saving postcard:', error);
      }
    }
  }, [capturedPostcard?.illustration_url, sourceItem.city, sourceItem.country, userIsAnonymous, onAuthRequired]);

  // When in success state, disable Street View interaction
  const isSuccessState = step === 'success';
  const isPreviewOrBeyond = step !== 'viewfinder';

  return (
    <div className="relative w-full h-full bg-[#0a0a0e] overflow-hidden">
      {/* Street View Panorama — full bleed */}
      <div className={`absolute inset-0 z-0 ${isPreviewOrBeyond ? 'pointer-events-none' : ''}`}>
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
          onZoomChanged={(z) => setZoomLevel(z)}
        />
        {/* Blur overlay when showing preview/success */}
        {isPreviewOrBeyond && (
          <div className="absolute inset-0 z-10 bg-black/40 backdrop-blur-[2px]" />
        )}
        {/* Bottom gradient to cover Google branding */}
        <div className="absolute bottom-0 left-0 right-0 h-14 z-10 bg-gradient-to-t from-[#0a0a0e] via-[#0a0a0e]/80 to-transparent pointer-events-none" />
      </div>

      {/* Composition grid overlay — optional in composing mode */}
      <AnimatePresence>
        {step === 'viewfinder' && cameraMode === 'composing' && showGrid && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-10 pointer-events-none"
          >
            {/* Rule of thirds grid */}
            <div className="absolute inset-0 flex">
              <div className="flex-1 border-r border-white/15" />
              <div className="flex-1 border-r border-white/15" />
              <div className="flex-1" />
            </div>
            <div className="absolute inset-0 flex flex-col">
              <div className="flex-1 border-b border-white/15" />
              <div className="flex-1 border-b border-white/15" />
              <div className="flex-1" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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

      {/* ─── Mini Map ─── Toggleable, top-right */}
      {currentPos && step === 'viewfinder' && cameraMode === 'exploring' && (
        <div className="absolute top-20 right-4 z-20 flex flex-col items-end gap-2">
          {/* Toggle button */}
          <button
            onClick={() => setShowMiniMap(v => !v)}
            className="pointer-events-auto flex items-center justify-center w-8 h-8 rounded-full bg-black/50 backdrop-blur-md border border-white/15 text-white/70 hover:text-white hover:bg-black/70 transition-all active:scale-90 cursor-pointer shadow-lg"
            aria-label={showMiniMap ? 'Hide mini map' : 'Show mini map'}
          >
            {showMiniMap ? <X size={14} /> : <Map size={14} />}
          </button>
          {/* Map */}
          <AnimatePresence>
            {showMiniMap && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.2 }}
                className="w-28 h-28 sm:w-32 sm:h-32 rounded-xl overflow-hidden shadow-2xl border border-white/10"
              >
                <DynamicMiniMap 
                  currentLat={currentPos.lat} 
                  currentLng={currentPos.lng} 
                  targetLat={sourceItem.lat || undefined}
                  targetLng={sourceItem.lng || undefined}
                  zoom={14}
                  className="w-full h-full"
                  interactive
                  onLocationClick={(lat, lng) => {
                    panoramaRef.current?.navigateTo(lat, lng);
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ─── Zoom Slider — only in composing mode ─── */}
      <AnimatePresence>
        {step === 'viewfinder' && cameraMode === 'composing' && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2 z-20 pointer-events-auto">
            <ZoomSlider
              value={zoomLevel}
              min={0}
              max={3}
              onChange={(z) => {
                setZoomLevel(z);
                panoramaRef.current?.setZoomLevel(z);
              }}
            />
          </div>
        )}
      </AnimatePresence>

      {/* ─── Top Bar (iOS Camera Style) ─── */}
      <div className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between px-4 pt-4 pb-8 bg-gradient-to-b from-black/80 via-black/40 to-transparent pointer-events-none">
        
        {/* Back Button */}
        <div className="pointer-events-auto flex-1 flex justify-start">
          {onBack && (
            <button
              onClick={() => {
                if (isSuccessState) {
                  setIsOriginalView(false);
                  reset();
                }
                onBack();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-white/90 hover:text-white hover:bg-black/60 transition-all shadow-lg active:scale-95 cursor-pointer"
            >
              <ArrowLeft size={16} />
              <span className="text-sm font-semibold tracking-wide">
                {t({ es: 'Globo', en: 'Globe' }, lang)}
              </span>
            </button>
          )}
        </div>

        {/* Location Pill */}
        <div className="pointer-events-auto flex-1 flex justify-end">
          <div className="flex items-center gap-1.5 bg-black/40 backdrop-blur-md rounded-full px-3 py-1.5 border border-white/10 shadow-lg">
            <MapPin className="w-3 h-3 text-pink-400" />
            <span className="text-white text-xs font-medium truncate max-w-[120px] sm:max-w-[200px]">{locationLabel}</span>
          </div>
        </div>
      </div>

      {/* ─── PREVIEW STATE ─── Polaroid with captured snapshot */}
      <AnimatePresence>
        {step === 'preview' && capturedDataUrl && (
          <motion.div
            key="preview-polaroid"
            initial={{ opacity: 0, y: 60, scale: 0.85 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, y: -30 }}
            transition={{ type: 'spring', damping: 22, stiffness: 120 }}
            className="absolute inset-0 z-30 flex flex-col items-center justify-center px-6"
          >
            {/* Polaroid Card */}
            <div className="relative w-[85vw] max-w-[420px] bg-[#F9F8F4] p-3 pb-14 shadow-[0_30px_60px_rgba(0,0,0,0.6)] rounded-sm" style={{ transform: 'rotate(-1.5deg)' }}>
              {/* Photo Area — captured snapshot */}
              <div className="relative aspect-square w-full bg-[#E5E5E5] overflow-hidden shadow-[inset_0_2px_10px_rgba(0,0,0,0.05)]">
                <img 
                  src={capturedDataUrl} 
                  alt="Captured snapshot" 
                  className="w-full h-full object-cover object-top"
                />
              </div>
              {/* Label */}
              <div className="absolute bottom-0 left-0 right-0 h-14 flex items-center justify-center px-4">
                <div className="text-gray-800 font-serif italic text-xl truncate w-full text-center opacity-80">
                  {sourceItem.city || locationLabel}
                </div>
              </div>
            </div>

            {/* Style Picker (between polaroid and buttons) */}
            <div className="mt-6 w-[85vw] max-w-[420px] overflow-x-auto no-scrollbar flex items-center justify-center gap-4 px-2 mask-edges">
              {ILLUSTRATION_STYLES.map((style) => (
                <button
                  key={style.id}
                  onClick={() => setIllustrationStyle(style.id)}
                  className={`text-xs uppercase tracking-widest font-bold transition-all whitespace-nowrap ${
                    illustrationStyle === style.id
                      ? 'text-[#F5D44F] scale-105'
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  {style.label}
                </button>
              ))}
            </div>

            {/* Action Buttons */}
            <div className="mt-5 w-[85vw] max-w-[420px] flex gap-3">
              {/* Retake */}
              <button
                onClick={reset}
                className="flex-1 py-3 px-3 rounded-xl bg-black/40 backdrop-blur-md text-white/90 text-sm font-semibold hover:bg-black/60 hover:text-white transition-all flex justify-center items-center gap-1.5 border border-white/10 active:scale-95"
              >
                <RotateCcw className="w-4 h-4" />
                {t({ es: 'Volver a tomar', en: 'Retake' }, lang)}
              </button>
              
              {/* Generate Postcard */}
              <button
                onClick={handleGenerate}
                className="flex-[2] py-3 px-3 rounded-xl bg-gradient-to-r from-indigo-500 to-pink-500 hover:from-indigo-400 hover:to-pink-400 text-white text-sm font-bold transition-all shadow-lg flex justify-center items-center gap-2 active:scale-95"
              >
                <Sparkles className="w-4 h-4" />
                {t({ es: 'Generar Postal', en: 'Generate Postcard' }, lang)}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── ILLUSTRATING STATE ─── Polaroid with watercolor blobs */}
      <AnimatePresence>
        {step === 'illustrating' && (
          <motion.div
            key="illustrating-polaroid"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.4 }}
            className="absolute inset-0 z-30 flex flex-col items-center justify-center px-6"
          >
            <div className="relative w-[85vw] max-w-[420px] bg-[#F9F8F4] p-3 pb-14 shadow-[0_30px_60px_rgba(0,0,0,0.6)] rounded-sm" style={{ transform: 'rotate(-1.5deg)' }}>
              <div className="relative aspect-square w-full bg-[#E5E5E5] overflow-hidden shadow-[inset_0_2px_10px_rgba(0,0,0,0.05)]">
                {/* Watercolor blobs animation */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <motion.div
                    animate={{ scale: [1, 1.5, 1], opacity: [0.4, 0.8, 0.4] }}
                    transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                    className="absolute w-32 h-32 bg-cyan-400/40 rounded-full blur-2xl -translate-x-4 -translate-y-4"
                  />
                  <motion.div
                    animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0.7, 0.3] }}
                    transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
                    className="absolute w-28 h-28 bg-fuchsia-400/40 rounded-full blur-2xl translate-x-8 translate-y-6"
                  />
                  <motion.div
                    animate={{ scale: [1, 1.4, 1], opacity: [0.2, 0.6, 0.2] }}
                    transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
                    className="absolute w-36 h-36 bg-yellow-300/40 rounded-full blur-3xl -translate-y-8 translate-x-4"
                  />
                </div>
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-14 flex items-center justify-center px-4">
                <motion.div 
                  animate={{ opacity: [0.4, 1, 0.4] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="text-gray-400 font-medium text-sm tracking-widest uppercase"
                >
                  {t({ es: 'Revelando...', en: 'Developing...' }, lang)}
                </motion.div>
              </div>
            </div>
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

      {/* ─── SUCCESS STATE ─── Final postcard in polaroid */}
      <AnimatePresence>
        {step === 'success' && capturedPostcard?.illustration_url && (
          <motion.div
            key="success-polaroid"
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ 
              opacity: isOriginalView ? 0 : 1, 
              y: isOriginalView ? 50 : 0,
              scale: isOriginalView ? 0.9 : 1,
              rotate: isOriginalView ? 0 : -2 
            }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ type: 'spring', damping: 20, stiffness: 100 }}
            className="absolute inset-0 z-30 flex flex-col items-center justify-center pointer-events-none px-6"
          >
            {/* Physical Polaroid Card */}
            <div className="relative w-[85vw] max-w-[420px] bg-[#F9F8F4] p-3 pb-14 shadow-[0_30px_60px_rgba(0,0,0,0.6)] rounded-sm pointer-events-auto">
              <div className="relative aspect-square w-full bg-[#E5E5E5] overflow-hidden shadow-[inset_0_2px_10px_rgba(0,0,0,0.05)]">
                <motion.img
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 1 }}
                  src={capturedPostcard.illustration_url}
                  alt="Generated postcard"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-14 flex items-center justify-center px-4">
                <div className="text-gray-800 font-serif italic text-xl truncate w-full text-center opacity-80">
                  {sourceItem.city || locationLabel}
                </div>
              </div>
            </div>

            {/* Success Actions */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: isOriginalView ? 0 : 1, y: isOriginalView ? 20 : 0 }}
              transition={{ delay: 0.2 }}
              className="mt-8 w-[85vw] max-w-[420px] flex flex-col gap-3 pointer-events-auto"
            >
              {/* Toggle Original */}
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsOriginalView(!isOriginalView);
                }}
                className="w-full py-3 px-4 rounded-xl bg-white/10 backdrop-blur-md text-white text-sm font-semibold hover:bg-white/20 transition-all flex justify-center items-center gap-2 border border-white/15"
              >
                <Eye className="w-4 h-4" />
                {t({es: 'Ver Entorno Original', en: 'See Original View'}, lang)}
              </button>
              
              {/* Retake + Save Row */}
              <div className="flex gap-3">
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsOriginalView(false);
                    reset();
                  }}
                  className="flex-1 py-3 px-3 rounded-xl bg-black/40 backdrop-blur-md text-white/90 text-sm font-semibold hover:bg-black/60 hover:text-white transition-all flex justify-center items-center gap-1.5 border border-white/10"
                >
                  <Camera className="w-4 h-4" />
                  {t({ es: 'Retomar', en: 'Retake' }, lang)}
                </button>
                
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleSaveOrShare();
                  }}
                  className="flex-[2] py-3 px-3 rounded-xl bg-gradient-to-r from-indigo-500 to-pink-500 hover:from-indigo-400 hover:to-pink-400 text-white text-sm font-bold transition-all shadow-lg flex justify-center items-center"
                >
                  {t({ es: 'Guardar Postal', en: 'Save Postcard' }, lang)}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Invisible overlay to catch clicks and toggle back to postcard when in "Original View" */}
      {step === 'success' && isOriginalView && (
        <div 
          className="absolute inset-0 z-40 cursor-pointer"
          onClick={() => setIsOriginalView(false)}
        />
      )}

      {/* ─── Bottom Toolbar — depends on camera mode ─── */}
      {step === 'viewfinder' && (
        <div className="absolute bottom-0 left-0 right-0 z-30 flex flex-col items-center pointer-events-none">
          <AnimatePresence mode="wait">
            {cameraMode === 'exploring' ? (
              /* ─── EXPLORING: Camera FAB ─── */
              <motion.div
                key="exploring-toolbar"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="pointer-events-auto pb-12 pt-6"
              >
                <CameraFAB onClick={enterComposingMode} />
              </motion.div>
            ) : (
              /* ─── COMPOSING: Shutter + Dismiss (clean, focused) ─── */
              <motion.div
                key="composing-toolbar"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="pointer-events-auto flex flex-col items-center pb-12 pt-6"
              >
                {/* Shutter + dismiss row */}
                <div className="flex items-center justify-center w-full gap-6">
                  {/* Dismiss — back to exploring */}
                  <button
                    onClick={() => setCameraMode('exploring')}
                    className="flex items-center justify-center w-10 h-10 rounded-full bg-black/40 backdrop-blur-md border border-white/15 text-white/70 hover:text-white hover:bg-black/60 transition-all active:scale-90"
                  >
                    <X size={18} />
                  </button>

                  {/* Shutter button */}
                  <button
                    onClick={triggerCapture}
                    className="relative flex items-center justify-center w-[72px] h-[72px] rounded-full border-[3px] border-white hover:scale-105 active:scale-95 transition-all duration-300"
                  >
                    <div className="absolute bg-white rounded-full inset-[3px]" />
                  </button>

                  {/* Grid toggle */}
                  <button
                    onClick={() => setShowGrid(v => !v)}
                    className={`flex items-center justify-center w-10 h-10 rounded-full backdrop-blur-md border transition-all active:scale-90 ${
                      showGrid 
                        ? 'bg-white/20 border-white/30 text-white' 
                        : 'bg-black/40 border-white/15 text-white/70 hover:text-white hover:bg-black/60'
                    }`}
                  >
                    <Grid3x3 size={18} />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
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
      `}</style>
    </div>
  );
}

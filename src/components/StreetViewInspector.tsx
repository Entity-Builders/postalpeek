/**
 * StreetViewInspector.tsx
 *
 * Debug panel that renders an interactive Street View embed at the exact
 * coordinates and heading the pipeline would use for a given slot.
 *
 * Fetches exact camera parameters via edge function to simulate
 * geocoding and bearing calculations in real-time.
 */

import React, { useState, useEffect } from "react";
import { ExplorerLiveFeed } from "./ExplorerLiveFeed";
import { motion, AnimatePresence } from "framer-motion";
import {
  Eye,
  EyeOff,
  ExternalLink,
  AlertTriangle,
  Loader,
  Goal,
} from "lucide-react";
import { supabase } from "@eb-packages/logic/src/supabase";

const MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

// FOVs the pipeline randomly picks from for trip stops / wander
const TRIP_FOVS = [90, 70] as const;
const WANDER_FOVS = [110, 90, 60, 40] as const;

interface StreetViewInspectorProps {
  lat: number;
  lng: number;
  heading: number;
  /** When true the slot is a trip stop — smaller search radius, tighter bearing calc */
  isTripStop?: boolean;
  /** True if the generation_metadata_override has landmark precision enabled */
  isLandmarkPrecision?: boolean;
  /** Slot label for display and geocoding */
  label: string;
  /** Callback to persist manual overrides to the slot */
  onSaveOverride?: (overrides: {
    fov: number;
    pitch: number;
    heading: number;
  }) => void;
  /** Indicates if save action is currently processing */
  isSavingOverride?: boolean;
}

interface CameraPreview {
  fov: number;
  pitch: number;
  label: string;
}

export interface SpatialPanoMetadata {
  panoId: string;
  lat: number;
  lng: number;
  date: string;
  heading: number;
  label: string;
  fov?: number;
  pitch?: number;
}

interface PreviewData {
  lat: number; // Panorama lat
  lng: number; // Panorama lng
  target_lat: number;
  target_lng: number;
  original_lat: number;
  original_lng: number;
  pano_id: string;
  heading: number;
  pitch: number;
  fov: number;
  scout_frames?: SpatialPanoMetadata[];
  pilot_frames?: (SpatialPanoMetadata & {
    imageBase64?: string;
    lensType?: string;
    pilot_metadata?: {
      status: string;
      reason: string;
      /** Vivid one-sentence description of what is visible in the frame */
      scene_narration?: string;
      /** Estimated percentage of the frame occupied by the target (0-100) */
      target_prominence_pct?: number;
      scout_directive?: {
        move_direction: string;
        distance_meters: number;
        pitch_offset: number;
        zoom_fov: number;
      };
    };
  })[];
}

export function StreetViewInspector({
  lat: initialLat,
  lng: initialLng,
  heading: initialHeading,
  isTripStop = true,
  isLandmarkPrecision = false,
  label,
  onSaveOverride,
  isSavingOverride,
}: StreetViewInspectorProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [activeFov, setActiveFov] = useState<number>(90);
  const [activePitch, setActivePitch] = useState<number>(0);
  const [hdgOffset, setHdgOffset] = useState<number>(0);
  const [activeScoutIndex, setActiveScoutIndex] = useState<number | null>(null);
  const [showLiveFeed, setShowLiveFeed] = useState(false);

  const fovOptions = isTripStop ? TRIP_FOVS : WANDER_FOVS;

  // Camera preset previews
  const presets: CameraPreview[] = fovOptions.map((fov) => ({
    fov,
    pitch: 0,
    label: fov <= 50 ? "Telephoto" : fov <= 75 ? "Standard" : "Wide",
  }));

  useEffect(() => {
    if (!open) return;
    let isMounted = true;

    async function loadPreview() {
      setLoading(true);
      setError(null);
      try {
        const { data, error: fnError } = await supabase.functions.invoke(
          "postalpeek-camera-preview",
          {
            body: {
              lat: initialLat,
              lng: initialLng,
              heading: initialHeading,
              location_name: label,
              is_landmark: isLandmarkPrecision,
            },
          },
        );

        if (fnError) throw fnError;
        if (data?.error) throw new Error(data.error);

        if (isMounted && data) {
          setPreviewData(data);
          setActiveFov(data.fov || 90);
          setActivePitch(data.pitch || 0);
          setHdgOffset(0); // Reset on load
          setActiveScoutIndex(null); // Reset scout selection
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadPreview();

    return () => {
      isMounted = false;
    };
  }, [
    open,
    initialLat,
    initialLng,
    initialHeading,
    label,
    isLandmarkPrecision,
  ]);

  const runSimulator = async () => {
    // Show live SSE feed immediately — results land when stream is done
    setShowLiveFeed(true);
    setLoading(false); // don't show full-screen spinner — live feed IS the progress
    setError(null);
  };

  const onLiveFeedDone = async () => {
    // Stream finished — fetch the full pilot_frames JSON for the inspector
    setLoading(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke(
        "postalpeek-camera-preview",
        {
          body: {
            lat: initialLat,
            lng: initialLng,
            heading: initialHeading,
            location_name: label,
            is_landmark: isLandmarkPrecision,
            run_pilot: true,
            // no stream flag — get full JSON with base64 images
          },
        },
      );

      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);

      if (data) {
        setPreviewData(data);
        setActiveFov(data.fov || 90);
        setActivePitch(data.pitch || 0);
        setHdgOffset(0);
        setActiveScoutIndex(null);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to run pilot simulation');
    } finally {
      setLoading(false);
    }
  };

  const activeScout =
    activeScoutIndex !== null && previewData?.scout_frames
      ? previewData.scout_frames[activeScoutIndex]
      : null;

  const pLat = activeScout ? activeScout.lat : previewData?.lat ?? initialLat;
  const pLng = activeScout ? activeScout.lng : previewData?.lng ?? initialLng;
  // Normalize wrapper
  const wrapHdg = (h: number) => ((h % 360) + 360) % 360;
  const cHdg = wrapHdg(
    (activeScout ? activeScout.heading : previewData?.heading ?? initialHeading) + hdgOffset
  );
  const activePanoId = activeScout ? activeScout.panoId : previewData?.pano_id;

  // Google Maps Embed API Street View URL
  // Uses pano_id if available so it's perfectly accurate to what the backend sees
  let embedUrl = null;
  if (MAPS_KEY) {
    if (activePanoId) {
      embedUrl = `https://www.google.com/maps/embed/v1/streetview?key=${MAPS_KEY}&pano=${activePanoId}&heading=${cHdg}&pitch=${activePitch}&fov=${activeFov}`;
    } else {
      embedUrl = `https://www.google.com/maps/embed/v1/streetview?key=${MAPS_KEY}&location=${pLat},${pLng}&heading=${cHdg}&pitch=${activePitch}&fov=${activeFov}`;
    }
  }

  // Google Maps deep-link (no API key needed, opens in new tab)
  const mapsDeepLink = `https://maps.google.com/maps?q=&layer=c&cbll=${pLat},${pLng}&cbp=12,${cHdg},,0,${activePitch}`;
  const googleMapsLink = `https://www.google.com/maps/@${pLat},${pLng},3a,${activeFov}y,${cHdg}h,${90 + activePitch}t/data=!3m6!1e1`;

  const isGeocoded =
    previewData &&
    (previewData.target_lat !== previewData.original_lat ||
      previewData.target_lng !== previewData.original_lng);

  return (
    <div>
      {/* Toggle button */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-medium transition-all"
        style={{
          background: open ? "rgba(14,165,233,0.15)" : "rgba(255,255,255,0.04)",
          border: `1px solid ${open ? "rgba(14,165,233,0.35)" : "rgba(255,255,255,0.08)"}`,
          color: open ? "rgb(125,211,252)" : "rgba(255,255,255,0.4)",
        }}
        title="Preview Street View"
      >
        {open ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
        Street View Dry-Run
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div
              className="mt-3 rounded-xl overflow-hidden"
              style={{
                border: "1px solid rgba(14,165,233,0.2)",
                background: "rgba(0,0,0,0.4)",
              }}
            >
              {loading ? (
                <div className="flex flex-col items-center justify-center py-12 text-sky-400/80 gap-3">
                  <Loader className="w-6 h-6 animate-spin text-sky-400" />
                  <p className="text-xs font-medium">
                    Resolving exact camera trajectory...
                  </p>
                  <p className="text-[10px] text-sky-400/50">
                    Geocoding & computing bearing towards landmark
                  </p>
                </div>
              ) : error ? (
                <div className="px-4 py-8 flex flex-col items-center justify-center gap-2">
                  <AlertTriangle className="w-8 h-8 text-rose-400 mb-2" />
                  <p className="text-rose-400 text-xs font-medium">
                    Simulation Failed
                  </p>
                  <p className="text-white/40 text-[10px] max-w-sm text-center">
                    {error}
                  </p>
                </div>
              ) : (
                <>
                  {/* Header bar */}
                  <div
                    className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-2.5 gap-3"
                    style={{
                      background: "rgba(14,165,233,0.06)",
                      borderBottom: "1px solid rgba(14,165,233,0.12)",
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sky-400 text-sm">📡</span>
                      <span className="text-white/70 text-xs font-medium truncate max-w-[220px]">
                        {label}
                      </span>
                      <button
                        onClick={runSimulator}
                        disabled={loading}
                        className="ml-2 px-2 py-1 rounded bg-indigo-500/20 hover:bg-indigo-500/40 text-indigo-300 text-[10px] font-mono transition-colors border border-indigo-500/30 flex items-center gap-1"
                        title="Execute Autonomous Gemini Pilot (Costs API credits)"
                      >
                        🚁 Run Pilot Simulator
                      </button>
                    </div>

                    {/* ── Explorer v2 Live Feed ──────────────────────────────────── */}
                    {showLiveFeed && !previewData?.pilot_frames && MAPS_KEY && (
                      <div className="px-4 py-3">
                        <ExplorerLiveFeed
                          locationName={label ?? 'Target'}
                          lat={initialLat}
                          lng={initialLng}
                          mapsApiKey={MAPS_KEY}
                          supabaseUrl={import.meta.env.VITE_SUPABASE_URL ?? ''}
                          supabaseAnonKey={import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''}
                          onDone={onLiveFeedDone}
                        />
                      </div>
                    )}

                    {/* Simulation Result */}
                    <div className="flex items-center gap-3 bg-black/20 px-3 py-1.5 rounded-lg border border-white/5">
                      {isGeocoded ? (
                        <div
                          className="flex items-center gap-1.5 text-emerald-400/90 text-[10px] font-medium mr-2"
                          title={`Shifted by ${previewData.lat - previewData.original_lat} lat`}
                        >
                          <Goal className="w-3.5 h-3.5" /> Resolved
                        </div>
                      ) : (
                        <span className="text-white/30 text-[10px] font-mono mr-2">
                          Raw Coords
                        </span>
                      )}
                      <span className="text-white/30 text-[10px] font-mono">
                        pan: {pLat.toFixed(4)}, {pLng.toFixed(4)}
                      </span>
                      <span className="text-sky-300/80 text-[10px] font-mono bg-sky-500/10 px-1.5 rounded">
                        hdg {cHdg.toFixed(1)}°
                      </span>
                      <a
                        href={mapsDeepLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-[10px] text-white/30 hover:text-sky-300 transition-colors ml-2"
                        style={{ textDecoration: "none" }}
                      >
                        <ExternalLink className="w-3 h-3" />
                        Maps
                      </a>
                    </div>
                  </div>

                  {/* FOV + Pitch controls */}
                  <div
                    className="flex items-center gap-3 px-4 py-2 flex-wrap"
                    style={{
                      background: "rgba(255,255,255,0.02)",
                      borderBottom: "1px solid rgba(255,255,255,0.05)",
                    }}
                  >
                    <span className="text-white/30 text-[10px] uppercase tracking-wider">
                      FOV
                    </span>
                    <div className="flex gap-1">
                      {presets.map((p) => (
                        <button
                          key={p.fov}
                          onClick={() => setActiveFov(p.fov)}
                          className="px-2 py-0.5 rounded text-[10px] font-mono transition-all"
                          style={{
                            background:
                              activeFov === p.fov
                                ? "rgba(14,165,233,0.2)"
                                : "rgba(255,255,255,0.04)",
                            border: `1px solid ${activeFov === p.fov ? "rgba(14,165,233,0.4)" : "rgba(255,255,255,0.06)"}`,
                            color:
                              activeFov === p.fov
                                ? "rgb(125,211,252)"
                                : "rgba(255,255,255,0.4)",
                          }}
                        >
                          {p.fov}° {p.label}
                        </button>
                      ))}
                    </div>

                    <span className="text-white/30 text-[10px] uppercase tracking-wider ml-2 hidden sm:block">
                      Pitch
                    </span>
                    <div className="flex gap-1 hidden sm:flex">
                      {[-10, 0, 10, 20].map((p) => (
                        <button
                          key={p}
                          onClick={() => setActivePitch(p)}
                          className="px-2 py-0.5 rounded text-[10px] font-mono transition-all"
                          style={{
                            background:
                              activePitch === p
                                ? "rgba(14,165,233,0.2)"
                                : "rgba(255,255,255,0.04)",
                            border: `1px solid ${activePitch === p ? "rgba(14,165,233,0.4)" : "rgba(255,255,255,0.06)"}`,
                            color:
                              activePitch === p
                                ? "rgb(125,211,252)"
                                : "rgba(255,255,255,0.4)",
                          }}
                        >
                          {p > 0 ? `+${p}` : p}°
                        </button>
                      ))}
                    </div>

                    <span className="text-white/30 text-[10px] uppercase tracking-wider ml-2 hidden sm:block">
                      Hdg
                    </span>
                    <div className="flex gap-1 hidden sm:flex">
                      {[-20, -10, 0, 10, 20].map((h) => (
                        <button
                          key={h}
                          onClick={() => setHdgOffset(h)}
                          className="px-2 py-0.5 rounded text-[10px] font-mono transition-all"
                          style={{
                            background:
                              hdgOffset === h
                                ? "rgba(14,165,233,0.2)"
                                : "rgba(255,255,255,0.04)",
                            border: `1px solid ${hdgOffset === h ? "rgba(14,165,233,0.4)" : "rgba(255,255,255,0.06)"}`,
                            color:
                              hdgOffset === h
                                ? "rgb(125,211,252)"
                                : "rgba(255,255,255,0.4)",
                          }}
                        >
                          {h > 0 ? `+${h}` : h}°
                        </button>
                      ))}
                    </div>

                    {onSaveOverride && (
                      <button
                        onClick={() =>
                          onSaveOverride({
                            fov: activeFov,
                            pitch: activePitch,
                            heading: cHdg,
                          })
                        }
                        disabled={isSavingOverride}
                        className="ml-2 px-3 py-1 rounded text-[10px] font-semibold transition-all disabled:opacity-50"
                        style={{
                          background:
                            "linear-gradient(135deg, rgba(16,185,129,0.3), rgba(5,150,105,0.4))",
                          border: "1px solid rgba(16,185,129,0.5)",
                          color: "rgb(167,243,208)",
                        }}
                      >
                        {isSavingOverride ? (
                          <Loader className="w-3 h-3 animate-spin inline mr-1" />
                        ) : (
                          "💾 "
                        )}
                        Override Slot
                      </button>
                    )}

                    <a
                      href={googleMapsLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-auto flex items-center gap-1 text-[10px] text-white/25 hover:text-indigo-300 transition-colors"
                      style={{ textDecoration: "none" }}
                    >
                      <ExternalLink className="w-3 h-3" />
                      Open panorama ↗
                    </a>
                  </div>

                  {/* Embed or fallback */}
                  {embedUrl ? (
                    <div className="flex flex-col">
                      <div
                        className="relative border-t border-sky-500/20"
                        style={{ height: 360 }}
                      >
                        <iframe
                          key={`${pLat}-${pLng}-${cHdg}-${activeFov}-${activePitch}`}
                          src={embedUrl}
                          width="100%"
                          height="100%"
                          style={{ border: 0, display: "block" }}
                          allowFullScreen
                          loading="lazy"
                          referrerPolicy="no-referrer-when-downgrade"
                          title={`Street View: ${label}`}
                        />
                        {/* Overlay params */}
                        <div
                          className="absolute bottom-3 left-3 flex gap-2 flex-wrap"
                          style={{ pointerEvents: "none" }}
                        >
                          {[
                            { label: "FOV", value: `${activeFov}°` },
                            { label: "HDG", value: `${cHdg.toFixed(1)}°` },
                            { label: "PITCH", value: `${activePitch}°` },
                          ].map((item) => (
                            <span
                              key={item.label}
                              className="text-[9px] font-mono px-2 py-1 rounded shadow-lg"
                              style={{
                                background: "rgba(0,0,0,0.85)",
                                color: "rgba(125,211,252,0.9)",
                                backdropFilter: "blur(4px)",
                                border: "1px solid rgba(125,211,252,0.2)",
                              }}
                            >
                              {item.label}: {item.value}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Scout Frames Grid */}
                      {previewData?.scout_frames && previewData.scout_frames.length > 0 && (
                        <div className="bg-black/30 border-t border-white/5 p-3">
                          <div className="flex items-center gap-2 mb-2 px-1">
                            <span className="text-white/40 text-[10px] uppercase tracking-wider font-semibold">
                              Spatial Scout Previews
                            </span>
                            <span className="bg-sky-500/20 text-sky-400 px-1.5 py-0.5 rounded text-[9px] font-mono">
                              {previewData.scout_frames.length} found
                            </span>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                            {previewData.scout_frames.map((scout, idx) => {
                              const isActive = activeScoutIndex === idx;
                              const sFov = scout.fov ?? 90;
                              const sPitch = scout.pitch ?? 0;
                              const scoutUrl = `https://www.google.com/maps/embed/v1/streetview?key=${MAPS_KEY}&pano=${scout.panoId}&heading=${scout.heading}&pitch=${sPitch}&fov=${sFov}`;
                              return (
                                <div
                                  key={idx}
                                  onClick={() => {
                                    setActiveScoutIndex(idx);
                                    setActiveFov(sFov);
                                    setActivePitch(sPitch);
                                  }}
                                  className="relative rounded overflow-hidden cursor-pointer transition-all hover:ring-2 hover:ring-sky-500/50"
                                  style={{
                                    height: 80,
                                    border: isActive
                                      ? "2px solid rgb(14,165,233)"
                                      : "1px solid rgba(255,255,255,0.1)",
                                    opacity: isActive ? 1 : 0.6,
                                  }}
                                  title={`Pano index: ${idx} (${scout.panoId})`}
                                >
                                  <div className="absolute top-1 left-1 z-10 bg-black/60 backdrop-blur-md px-1.5 py-0.5 rounded text-[9px] font-mono text-white/90 shadow-sm border border-white/10">
                                    {scout.label}
                                  </div>
                                  <div className="absolute inset-0 pointer-events-none">
                                    <iframe
                                      src={scoutUrl}
                                      width="100%"
                                      height="100%"
                                      style={{ border: 0, display: "block" }}
                                      loading="lazy"
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Flight Simulator Timeline */}
                      {previewData?.pilot_frames && previewData.pilot_frames.length > 0 && (
                        <div className="bg-indigo-950/30 border-t border-indigo-500/20 p-3">
                          <div className="flex items-center gap-2 mb-3 px-1">
                            <span className="text-indigo-300/80 text-[10px] uppercase tracking-wider font-semibold">
                              🛸 Flight Simulator Path ({previewData.pilot_frames.length})
                            </span>
                          </div>
                          <div className="flex flex-col gap-3">
                            {previewData.pilot_frames.map((frame, idx) => {
                              const isBase64 = !!frame.imageBase64;
                              const imgSrc = isBase64 
                                ? `data:image/jpeg;base64,${frame.imageBase64}` 
                                : `https://maps.googleapis.com/maps/api/streetview?size=600x400&pano=${frame.panoId}&heading=${frame.heading}&pitch=${frame.pitch || 0}&fov=${frame.fov || 90}&key=${MAPS_KEY}`;
                              
                              const pm = frame.pilot_metadata;
                              const isPerfect = pm?.status === 'perfect';
                              const isWinner = idx === 0; // first frame returned is always the best
                              const prominencePct = pm?.target_prominence_pct ?? 0;
                              const isDiscovery = frame.lensType?.includes('Discovery');
                              const isRefinement = frame.lensType?.includes('Refinement');
                              
                              return (
                                <div
                                  key={idx}
                                  className="flex flex-col sm:flex-row gap-3 rounded-lg p-2 border shadow-inner"
                                  style={{
                                    background: isWinner ? 'rgba(16,185,129,0.08)' : 'rgba(0,0,0,0.40)',
                                    border: isWinner
                                      ? '1px solid rgba(16,185,129,0.4)'
                                      : '1px solid rgba(255,255,255,0.05)',
                                  }}
                                >
                                  {/* Frame image */}
                                  <div className="relative shrink-0 rounded overflow-hidden" style={{ width: 140, height: 100 }}>
                                    <img 
                                      src={imgSrc} 
                                      alt={`Flight step ${idx + 1}`} 
                                      className="w-full h-full object-cover"
                                    />
                                    {/* Winner crown */}
                                    {isWinner && (
                                      <div className="absolute top-1 right-1 text-sm" title="Best frame selected">
                                        👑
                                      </div>
                                    )}
                                    {/* Frame type badge */}
                                    {(isDiscovery || isRefinement) && (
                                      <div
                                        className="absolute bottom-1 left-1 text-[8px] font-mono px-1 py-0.5 rounded"
                                        style={{
                                          background: isRefinement ? 'rgba(99,102,241,0.8)' : 'rgba(0,0,0,0.7)',
                                          color: isRefinement ? '#c7d2fe' : 'rgba(255,255,255,0.6)',
                                        }}
                                      >
                                        {isRefinement ? 'Refinement' : 'Discovery'}
                                      </div>
                                    )}
                                  </div>
                                  
                                  {/* Frame details & AI analysis */}
                                  <div className="flex-1 flex flex-col pt-1 gap-1.5">
                                    {/* Header row */}
                                    <div className="flex justify-between items-start">
                                      <span className="text-white/50 text-[10px] font-mono">
                                        Step {idx + 1}/{previewData.pilot_frames!.length} • <span className="text-indigo-300">lat: {frame.lat.toFixed(4)} lng: {frame.lng.toFixed(4)}</span>
                                      </span>
                                      {pm?.status && (
                                        <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${isPerfect ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                                          {pm.status}
                                        </span>
                                      )}
                                    </div>
                                    
                                    {/* Scene narration - primary text */}
                                    {(pm?.scene_narration || pm?.reason) && (
                                      <div className="text-white/70 text-xs italic leading-relaxed">
                                        "{pm.scene_narration || pm.reason}"
                                      </div>
                                    )}
                                    
                                    {/* Target prominence bar */}
                                    {prominencePct > 0 && (
                                      <div className="flex items-center gap-2 mt-0.5">
                                        <span className="text-white/30 text-[9px] font-mono shrink-0">Target</span>
                                        <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                                          <div
                                            className="h-full rounded-full transition-all"
                                            style={{
                                              width: `${Math.min(prominencePct, 100)}%`,
                                              background: prominencePct >= 35
                                                ? 'rgba(16,185,129,0.8)'
                                                : prominencePct >= 15
                                                  ? 'rgba(245,158,11,0.8)'
                                                  : 'rgba(239,68,68,0.7)',
                                            }}
                                          />
                                        </div>
                                        <span className="text-white/40 text-[9px] font-mono shrink-0">{prominencePct}%</span>
                                      </div>
                                    )}
                                    
                                    {/* Movement directive (refinement shots only) */}
                                    {pm?.scout_directive && pm.status !== "perfect" && (
                                      <div className="mt-auto bg-indigo-500/10 rounded px-2 py-1 flex items-center justify-between border border-indigo-500/20">
                                        <span className="text-indigo-400 text-[10px] font-mono">
                                          Moving {pm.scout_directive.move_direction} ({pm.scout_directive.distance_meters}m)
                                        </span>
                                        <span className="text-indigo-400/50 text-[10px] font-mono">
                                          pitch: {Math.round(pm.scout_directive.pitch_offset || 0)}°
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* No API key fallback */
                    <div className="px-4 py-6 space-y-3">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-amber-300/80 text-xs font-medium">
                            Maps Embed API key not configured
                          </p>
                          <p className="text-white/30 text-[10px] mt-0.5 leading-relaxed">
                            Add{" "}
                            <code className="text-sky-300/70 font-mono">
                              VITE_GOOGLE_MAPS_API_KEY
                            </code>{" "}
                            to your{" "}
                            <code className="text-sky-300/70 font-mono">
                              .env.local
                            </code>
                            . Must have "Maps Embed API" enabled on GCP.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

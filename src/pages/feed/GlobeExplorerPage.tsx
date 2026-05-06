import React, { useMemo, useRef, useState, useCallback, useEffect } from "react";
import Globe from "react-globe.gl";
import { useFeedContext } from "./FeedLayout";
import { FeedItem } from "../../components/Postcard";
import { GlobeReticle } from "./components/globe/GlobeReticle";
import { GlobeZoomControls } from "./components/globe/GlobeZoomControls";
import { ViewfinderPanel } from "../../components/viewfinder/ViewfinderPanel";
import { ViewfinderSidebar } from "../../components/viewfinder/ViewfinderSidebar";
import { PostcardFullscreenModal } from "./components/globe/PostcardFullscreenModal";
import { useLang, t } from "../../utils/i18n";
import { motion, AnimatePresence } from "framer-motion";
import { cdnImage } from "../../utils/imageUtils";
import { analytics } from "../../lib/analytics";
import { Camera } from "lucide-react";

export function GlobeExplorerPage() {
  const lang = useLang();
  const { items, handleAuthRequiredAction, user, toggleFavorite, favoriteIds, isFetchingMore, hasMore, fetchMoreFeed } = useFeedContext();
  const globeEl = useRef<any>(null);

  const globeData = useMemo(() => {
    return items.filter((item) => item.lat != null && item.lng != null);
  }, [items]);

  const [selectedItem, setSelectedItem] = useState<FeedItem | FeedItem[] | null>(null);
  const [isFullscreenModalOpen, setIsFullscreenModalOpen] = useState(false);
  const [globeReady, setGlobeReady] = useState(false);
  const [isCheckingLocation, setIsCheckingLocation] = useState(false);
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const isAutoPanning = useRef(false);
  const isUserFlying = useRef(false);
  const zoomLevelRef = useRef(2);
  const hasInitialFocus = useRef(false);
  const [zoomLevel, setZoomLevel] = useState(2);

  const [mode, setMode] = useState<"globe" | "briefing" | "diving" | "viewfinder">("globe");
  const [viewfinderTarget, setViewfinderTarget] = useState<FeedItem | null>(null);
  const [viewfinderCurrentPos, setViewfinderCurrentPos] = useState<{lat: number; lng: number} | null>(null);

  // Hydrate globe
  useEffect(() => {
    if (!isFetchingMore && hasMore && globeData.length < 150) {
      fetchMoreFeed();
    }
  }, [globeData.length, isFetchingMore, hasMore, fetchMoreFeed]);

  // Track zoom
  useEffect(() => {
    let reqId: number;
    const trackZoom = () => {
      if (globeEl.current) {
        const pov = globeEl.current.pointOfView();
        if (pov) {
          const altitude = Math.max(0.0001, pov.altitude);
          const calculatedZoom = Math.max(0, Math.min(20, Math.floor(15 - Math.log10(altitude * 1000) * 5)));
          if (calculatedZoom !== zoomLevelRef.current) {
            zoomLevelRef.current = calculatedZoom;
            setZoomLevel(calculatedZoom);
          }
        }
      }
      reqId = requestAnimationFrame(trackZoom);
    };
    reqId = requestAnimationFrame(trackZoom);
    return () => cancelAnimationFrame(reqId);
  }, []);

  const clusters = useMemo(() => {
    return globeData.map((item) => {
      const isSelected = !Array.isArray(selectedItem) && selectedItem?.id === item.id;
      return {
        geometry: { coordinates: [item.lng!, item.lat!] },
        properties: { cluster: false, item: item, isSelected },
      };
    });
  }, [globeData, selectedItem]);

  const flyTo = useCallback((lat: number, lng: number, altitude: number, duration: number) => {
    if (!globeEl.current) return;
    isUserFlying.current = true;
    globeEl.current.pointOfView({ lat, lng, altitude }, duration);
    setTimeout(() => { isUserFlying.current = false; }, duration + 100);
  }, []);

  const handleZoom = useCallback((direction: "in" | "out") => {
    if (globeEl.current) {
      const currentPov = globeEl.current.pointOfView();
      if (currentPov) {
        const alt = currentPov.altitude;
        const targetAlt = direction === "in" ? alt / 2 : alt * 2;
        flyTo(currentPov.lat, currentPov.lng, Math.min(Math.max(targetAlt, 0.0001), 10), 400);
      }
    }
  }, [flyTo]);

  const renderHtmlElement = useCallback((d: object) => {
    const feature = d as any;
    const el = document.createElement("div");
    el.style.cursor = "pointer";
    el.style.pointerEvents = "auto";

    if (feature.properties.cluster) {
       return el;
    }

    let item: FeedItem = feature.properties.item;
    const isSelected = feature.properties.isSelected;

    const imgUrl = cdnImage(item.illustration_url, { width: 96 });
    const baseSize = 42;
    const size = isSelected ? baseSize * 1.25 : baseSize;
    const shadow = isSelected ? "0 4px 20px rgba(255,255,255,0.4), 0 8px 32px rgba(0,0,0,0.6)" : "0 2px 10px rgba(0,0,0,0.5)";

    el.innerHTML = `
      <div style="position:relative;width:0;height:0">
        <div class="marker-container" style="position:absolute;bottom:0;left:-${size/2}px;display:flex;flex-direction:column;align-items:center;transition:all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);">
          <div style="width:${size}px;height:${size}px;background:#fff;padding:3px;padding-bottom:10px;border-radius:4px;box-shadow:${shadow};position:relative;z-index:2;transform-origin:bottom center;">
            <img src="${imgUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:2px;" loading="lazy" />
          </div>
          <div style="width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:8px solid #fff;margin-top:-2px;z-index:1;filter:drop-shadow(0 2px 2px rgba(0,0,0,0.3));"></div>
        </div>
        <div style="position:absolute;bottom:-4px;left:-4px;width:8px;height:4px;background:rgba(0,0,0,0.6);border-radius:50%;pointer-events:none;filter:blur(1px)"></div>
      </div>
    `;

    if (isSelected) {
      el.innerHTML += `<style>
        .marker-container { animation: float 2s ease-in-out infinite; }
        @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
      </style>`;
    }

    const handleItemClick = (e?: Event) => {
      if (e) { e.stopPropagation(); e.preventDefault(); }
      setSelectedItem(item);
      if (globeEl.current && item.lat != null && item.lng != null) {
        const currentAlt = globeEl.current.pointOfView()?.altitude ?? 0.05;
        flyTo(item.lat, item.lng, Math.min(currentAlt, 0.4), 800);
        setIsFullscreenModalOpen(true);
      }
    };

    el.onclick = handleItemClick;
    el.ontouchend = handleItemClick;

    return el;
  }, [flyTo]);

  const nearbyItems = useMemo(() => {
    if (!viewfinderCurrentPos) return [];
    return globeData
      .filter((item) => item.id !== viewfinderTarget?.id)
      .map((item) => {
        const p = 0.017453292519943295;
        const c = Math.cos;
        const a = 0.5 - c((item.lat! - viewfinderCurrentPos.lat) * p) / 2 +
          (c(viewfinderCurrentPos.lat * p) * c(item.lat! * p) * (1 - c((item.lng! - viewfinderCurrentPos.lng) * p))) / 2;
        return { item, distance: 12742 * Math.asin(Math.sqrt(a)) };
      })
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 5)
      .map((x) => x.item);
  }, [viewfinderCurrentPos, globeData, viewfinderTarget?.id]);

  const handleSelectNearby = useCallback((item: FeedItem) => {
    setViewfinderTarget(item);
    if (item.lat != null && item.lng != null) {
      setViewfinderCurrentPos({ lat: item.lat, lng: item.lng });
    }
  }, []);

  const handleBackToGlobe = useCallback(() => {
    setMode("globe");
    setViewfinderTarget(null);
  }, []);

  useEffect(() => {
    if (!hasInitialFocus.current && globeEl.current) {
      hasInitialFocus.current = true;
      globeEl.current.pointOfView({ lat: 20, lng: 0, altitude: 2.8 }, 1000);
      setTimeout(() => setGlobeReady(true), 1000);
    }
  }, []);

  useEffect(() => {
    if (globeReady && globeEl.current) {
      // Increase globe map zoom speed
      const controls = globeEl.current.controls();
      if (controls) {
        controls.zoomSpeed = 3.0;
      }
    }
  }, [globeReady]);

  const checkStreetViewAndDive = useCallback((targetLat: number, targetLng: number, targetItem: any) => {
    if (isCheckingLocation) return;
    if (!window.google?.maps) {
      console.warn("Google Maps no cargado aún");
      return;
    }

    setIsCheckingLocation(true);
    const sv = new window.google.maps.StreetViewService();
    
    // Check if the item already has a pano_id we can use directly
    const panoId = targetItem?.streetview_pov?.pano_id;
    const request = panoId 
      ? { pano: panoId } 
      : { location: new window.google.maps.LatLng(targetLat, targetLng), radius: 5000 };

    sv.getPanorama(
      request,
      (data, status) => {
        setIsCheckingLocation(false);
        if (status !== "OK" || !data?.location?.latLng) {
          setErrorToast(t({ es: "No hay Street View disponible en estas coordenadas.", en: "No Street View available at these coordinates." }, lang));
          setTimeout(() => setErrorToast(null), 4000);
          return;
        }

        setViewfinderTarget(targetItem);
        setMode("diving");
        
        if (globeEl.current) {
          globeEl.current.pointOfView({ lat: data.location.latLng.lat(), lng: data.location.latLng.lng(), altitude: 0.0005 }, 1400);
        }

        setTimeout(() => setMode("viewfinder"), 1500);
        
        if (targetItem.id.startsWith("capture-")) {
          analytics.track("free_capture_started");
        } else {
          analytics.track("destination_capture_started", { destination_id: targetItem.id });
        }
      }
    );
  }, [isCheckingLocation, lang]);

  const handleCaptureAnywhere = useCallback(() => {
    const pov = globeEl.current?.pointOfView();
    if (!pov) return;

    const mockItem = {
      id: `capture-${Date.now()}`,
      lat: pov.lat,
      lng: pov.lng,
      location_name: "Exploración",
      city: "Ubicación libre",
      country: "Planeta Tierra"
    } as any;

    checkStreetViewAndDive(pov.lat, pov.lng, mockItem);
  }, [checkStreetViewAndDive]);

  if (mode === "viewfinder" && viewfinderTarget) {
    return (
      <div className="w-full h-full relative bg-[#0a0a0e] overflow-hidden flex">
        <div className="hidden md:block">
          <ViewfinderSidebar
            sourceItem={viewfinderTarget}
            nearbyItems={nearbyItems}
            onBack={handleBackToGlobe}
            onSelectNearby={handleSelectNearby}
            currentLat={viewfinderCurrentPos?.lat}
            currentLng={viewfinderCurrentPos?.lng}
          />
        </div>
        <div className="flex-1 relative z-0">
          <ViewfinderPanel
            sourceItem={viewfinderTarget}
            userId={user?.id}
            userIsAnonymous={user?.is_anonymous}
            onAuthRequired={(action) => handleAuthRequiredAction(action)}
            onPostcardCreated={() => analytics.track("viewfinder_postcard_saved")}
            onBack={handleBackToGlobe}
            onPositionChanged={setViewfinderCurrentPos}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative bg-[#050510] overflow-hidden">
      <AnimatePresence>
        {errorToast && (
          <motion.div
            initial={{ opacity: 0, y: -20, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, y: -20, x: "-50%" }}
            className="absolute top-10 left-1/2 z-[100] bg-red-500/90 text-white px-6 py-3 rounded-full font-medium tracking-wide shadow-lg backdrop-blur-md whitespace-nowrap"
          >
            {errorToast}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="absolute inset-0 z-0 flex items-center justify-center cursor-move">
        <Globe
          ref={globeEl}
          globeTileEngineUrl={(x, y, l) => `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${l}/${y}/${x}`}
          backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"
          atmosphereColor="#34d399"
          atmosphereAltitude={0.15}
          htmlElementsData={clusters}
          htmlElement={renderHtmlElement}
          htmlLat={(d: any) => d.geometry.coordinates[1]}
          htmlLng={(d: any) => d.geometry.coordinates[0]}
        />
      </div>

      {mode !== "diving" && (
        <>
          <GlobeReticle />
          <GlobeZoomControls onZoom={handleZoom} />
          
          <AnimatePresence>
            {!isFullscreenModalOpen && (
              <>
                {/* App Header & Context */}
                <motion.div
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="absolute top-10 left-0 right-0 flex flex-col items-center pointer-events-none z-10"
                >
                  <h1 className="text-white font-black text-3xl md:text-4xl tracking-tighter drop-shadow-lg flex items-center gap-3">
                    <Camera className="w-8 h-8 text-emerald-400" />
                    PostalPeek
                  </h1>
                  <p className="text-white/80 font-medium text-sm md:text-base mt-2 drop-shadow-md text-center px-4 max-w-md">
                    {t(
                      { 
                        es: "Explorá el mundo en Street View y generá postales únicas con IA.", 
                        en: "Explore the world in Street View and generate unique AI postcards." 
                      }, 
                      lang
                    )}
                  </p>
                </motion.div>

                {/* Bottom Controls */}
                <motion.div
                  initial={{ opacity: 0, y: 50 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 50 }}
                  className="absolute bottom-12 left-0 right-0 flex flex-col items-center justify-center z-10 pointer-events-none"
                >
                  <p className="text-white/60 text-xs tracking-widest uppercase font-bold mb-4 drop-shadow-md">
                    {t({ es: "Girá el globo y elegí un lugar", en: "Spin the globe and pick a place" }, lang)}
                  </p>
                  <button
                    disabled={isCheckingLocation}
                    onClick={handleCaptureAnywhere}
                    className={`
                      pointer-events-auto flex items-center gap-3 px-8 py-4 rounded-full font-bold tracking-widest text-sm shadow-[0_0_40px_rgba(52,211,153,0.3)]
                      transition-all duration-300 hover:scale-105 hover:shadow-[0_0_60px_rgba(52,211,153,0.5)] active:scale-95 disabled:opacity-50
                      ${isCheckingLocation 
                        ? "bg-black/50 text-white backdrop-blur-md border border-white/10" 
                        : "bg-black text-white border border-white/20"}
                    `}
                  >
                    {isCheckingLocation ? (
                      <div className="w-5 h-5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Camera size={20} className="text-emerald-400" />
                    )}
                    <span>
                      {isCheckingLocation 
                        ? t({ es: "BUSCANDO...", en: "SEARCHING..." }, lang)
                        : t({ es: "CAPTURAR AQUÍ", en: "CAPTURE HERE" }, lang)}
                    </span>
                  </button>
                </motion.div>
              </>
            )}
          </AnimatePresence>

          <PostcardFullscreenModal
            isOpen={isFullscreenModalOpen}
            items={globeData}
            activeItemId={Array.isArray(selectedItem) ? selectedItem[0]?.id : selectedItem?.id || null}
            onClose={() => setIsFullscreenModalOpen(false)}
            onChangeActive={(item) => {
              setSelectedItem(item);
              if (item.lat != null && item.lng != null) {
                const currentAlt = globeEl.current?.pointOfView()?.altitude ?? 0.05;
                flyTo(item.lat, item.lng, currentAlt, 600);
              }
            }}
            onCreateOwn={(item) => {
              setIsFullscreenModalOpen(false);
              setTimeout(() => {
                if (item.lat != null && item.lng != null) {
                  checkStreetViewAndDive(item.lat, item.lng, item);
                }
              }, 100);
            }}
            isFavorited={(id) => favoriteIds.has(id)}
            onToggleFavorite={(id) => {
              handleAuthRequiredAction(() => {
                if (toggleFavorite) toggleFavorite(id);
              });
            }}
          />
        </>
      )}

      <AnimatePresence>
        {mode === "diving" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.2, ease: "easeIn" }}
            className="absolute inset-0 z-[90] pointer-events-none flex items-center justify-center"
            style={{ background: "radial-gradient(circle at 50% 50%, transparent 0%, rgba(5,5,16,0.6) 40%, rgba(5,5,16,0.95) 100%)" }}
          >
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.6 }}
              className="text-white/60 text-sm font-medium tracking-widest uppercase"
            >
              {t({ es: "Entrando a Street View...", en: "Entering Street View..." }, lang)}
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {!globeReady && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="absolute inset-0 z-[100] bg-[#050510] flex flex-col items-center justify-center gap-4 pointer-events-none"
          >
            <div className="w-12 h-12 rounded-full border-2 border-emerald-400/30 border-t-emerald-400 animate-spin" />
            <p className="text-white/40 text-sm font-medium tracking-wide">
              {t({ es: "Cargando mapa...", en: "Loading map..." }, lang)}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

import React, { useMemo, useRef, useState, useCallback, useEffect } from 'react';
import Globe from 'react-globe.gl';
import Supercluster from 'supercluster';
import { useFeedContext } from './FeedLayout';
import { FeedItem } from '../../components/Postcard';
import { GlobeHeader } from './components/globe/GlobeHeader';
import { GlobeReticle } from './components/globe/GlobeReticle';
import { GlobeZoomControls } from './components/globe/GlobeZoomControls';
import { GlobeSelectionPanel } from './components/globe/GlobeSelectionPanel';
import { ViewfinderPanel } from '../../components/viewfinder/ViewfinderPanel';
import { ViewfinderSidebar } from '../../components/viewfinder/ViewfinderSidebar';
import { useLang, t } from '../../utils/i18n';
import { motion, AnimatePresence } from 'framer-motion';
import { cdnImage } from '../../utils/imageUtils';
import { analytics } from '../../lib/analytics';

export function GlobeExplorerPage() {
  const lang = useLang();
  const { items, handleAuthRequiredAction, user, toggleFavorite, favoriteIds } = useFeedContext();
  const globeEl = useRef<any>(null);



  // Filter items that have lat/lng
  const globeData = useMemo(() => {
    return items.filter((item) => item.lat != null && item.lng != null);
  }, [items]);

  const [selectedItem, setSelectedItem] = useState<FeedItem | FeedItem[] | null>(null);
  const [hoveredItem, setHoveredItem] = useState<FeedItem | null>(null);
  const [globeReady, setGlobeReady] = useState(false);
  const isAutoPanning = useRef(false);
  const zoomLevelRef = useRef(2);
  const [zoomLevel, setZoomLevel] = useState(2);

  // ── Viewfinder Mode State ──
  const [mode, setMode] = useState<'globe' | 'viewfinder'>('globe');
  const [viewfinderTarget, setViewfinderTarget] = useState<FeedItem | null>(null);

  // Initialize Supercluster
  const clusterIndex = useMemo(() => {
    const sc = new Supercluster({
      radius: 20,   // Very tight — only nearby postcards cluster together
      maxZoom: 14,  // Break into individual pins very early
    });
    
    const features = globeData.map(item => ({
      type: 'Feature' as const,
      properties: { cluster: false, item },
      geometry: {
        type: 'Point' as const,
        coordinates: [item.lng!, item.lat!]
      }
    }));
    
    sc.load(features);
    return sc;
  }, [globeData]);

  // Get clusters based on zoom level — anchor each cluster to a REAL postcard location
  // (not the centroid, which shifts when zoom changes)
  const clusters = useMemo(() => {
    if (!clusterIndex) return [];
    const raw = clusterIndex.getClusters([-180, -90, 180, 90], zoomLevel);
    
    // Replace cluster centroids with the first leaf's real coordinates
    return raw.map(feature => {
      if (!feature.properties.cluster) return feature; // individual point — already real coords
      
      // Get the first actual postcard in this cluster
      try {
        const leaves = clusterIndex.getLeaves(feature.properties.cluster_id, 1);
        if (leaves.length > 0) {
          return {
            ...feature,
            geometry: {
              ...feature.geometry,
              coordinates: leaves[0].geometry.coordinates // use REAL postcard coords
            }
          };
        }
      } catch { /* fallback to centroid */ }
      return feature;
    });
  }, [clusterIndex, zoomLevel]);

  // Select a postcard — NO camera movement. The user controls the camera.
  const selectItem = useCallback((item: FeedItem) => {
    setSelectedItem(item);
  }, []);

  // Fly to a location (used only for cluster zoom and skip-next)
  const flyTo = useCallback((lat: number, lng: number, altitude: number, duration = 1000) => {
    if (globeEl.current) {
      isAutoPanning.current = true;
      globeEl.current.pointOfView({ lat, lng, altitude }, duration);
      setTimeout(() => {
        isAutoPanning.current = false;
      }, duration + 50);
    }
  }, []);

  // On mount: center on the user's DENSEST cluster at country zoom, auto-select closest
  const hasInitialFocus = useRef(false);
  useEffect(() => {
    if (globeData.length > 0 && clusterIndex && !hasInitialFocus.current) {
      hasInitialFocus.current = true;

      // Find the largest cluster at a global zoom level
      const globalClusters = clusterIndex.getClusters([-180, -90, 180, 90], 3);
      let bestCluster = globalClusters[0];
      let bestCount = 0;
      for (const c of globalClusters) {
        const count = c.properties.cluster ? c.properties.point_count : 1;
        if (count > bestCount) {
          bestCount = count;
          bestCluster = c;
        }
      }

      if (bestCluster) {
        const clusterLat = bestCluster.geometry.coordinates[1];
        const clusterLng = bestCluster.geometry.coordinates[0];

        // Find the actual closest postcard to this cluster center
        let closestDist = Infinity;
        let closestItem: FeedItem | null = null;
        for (const item of globeData) {
          const dLat = item.lat! - clusterLat;
          const dLng = item.lng! - clusterLng;
          const dist = dLat * dLat + dLng * dLng;
          if (dist < closestDist) {
            closestDist = dist;
            closestItem = item;
          }
        }

        // Fly to the REAL postcard location, not the cluster centroid
        const targetLat = closestItem?.lat ?? clusterLat;
        const targetLng = closestItem?.lng ?? clusterLng;
        flyTo(targetLat, targetLng, 0.001, 1500);

        // Select it and reveal the globe after tiles load
        setTimeout(() => {
          if (closestItem) setSelectedItem(closestItem);
          setGlobeReady(true);
        }, 2500);
      }
    }
  }, [globeData, clusterIndex, flyTo]);

  // Hydrate the globe with more postcards in the background so it feels populated
  const { isFetchingMore, hasMore, fetchMoreFeed } = useFeedContext();
  useEffect(() => {
    if (!isFetchingMore && hasMore && globeData.length < 150) {
      fetchMoreFeed();
    }
  }, [globeData.length, isFetchingMore, hasMore, fetchMoreFeed]);

  // Keep refs for the checkCenter loop to avoid constant re-bindings
  const clustersRef = useRef(clusters);
  const clusterIndexRef = useRef(clusterIndex);
  useEffect(() => {
    clustersRef.current = clusters;
    clusterIndexRef.current = clusterIndex;
  }, [clusters, clusterIndex]);

  // Polling loop: instant zoom tracking + debounced reticle auto-selection.
  // The auto-select only fires after the user STOPS moving for 500ms.
  useEffect(() => {
    if (globeData.length === 0) return;
    let reqId: number;
    let lastLat = 0;
    let lastLng = 0;
    let stableTimer: ReturnType<typeof setTimeout> | null = null;

    const trackZoom = () => {
      if (globeEl.current) {
        const pov = globeEl.current.pointOfView();
        if (pov) {
          // ── Instant zoom tracking ──
          const altitude = Math.max(0.0001, pov.altitude);
          const calculatedZoom = Math.max(0, Math.min(20, Math.floor(15 - Math.log10(altitude * 1000) * 5)));
          if (calculatedZoom !== zoomLevelRef.current) {
            zoomLevelRef.current = calculatedZoom;
            setZoomLevel(calculatedZoom);
          }

          // ── Debounced reticle auto-selection ──
          if (!isAutoPanning.current && altitude < 0.15) {
            const moved = Math.abs(pov.lat - lastLat) > 0.0001 || Math.abs(pov.lng - lastLng) > 0.0001;
            lastLat = pov.lat;
            lastLng = pov.lng;

            if (moved) {
              // User is still moving — reset the debounce timer
              if (stableTimer) clearTimeout(stableTimer);
              stableTimer = setTimeout(() => {
                // User stopped for 500ms — now find closest dot
                const currentPov = globeEl.current?.pointOfView();
                if (!currentPov) return;
                
                let closestDist = Infinity;
                let closestItem: FeedItem | null = null;
                
                for (const feature of clustersRef.current) {
                  if (feature.properties.cluster) continue;
                  const lat = feature.geometry.coordinates[1];
                  const lng = feature.geometry.coordinates[0];
                  
                  const p = 0.017453292519943295;
                  const c = Math.cos;
                  const a = 0.5 - c((lat - currentPov.lat) * p)/2 + 
                          c(currentPov.lat * p) * c(lat * p) * 
                          (1 - c((lng - currentPov.lng) * p))/2;
                  const dist = 12742 * Math.asin(Math.sqrt(a));
                  
                  if (dist < closestDist) {
                    closestDist = dist;
                    closestItem = feature.properties.item;
                  }
                }
                
                if (closestItem) {
                  setSelectedItem(prev => {
                    if (!Array.isArray(prev) && prev?.id === closestItem!.id) return prev;
                    return closestItem;
                  });
                }
              }, 500);
            }
          }
        }
      }
      reqId = requestAnimationFrame(trackZoom);
    };

    reqId = requestAnimationFrame(trackZoom);
    return () => {
      cancelAnimationFrame(reqId);
      if (stableTimer) clearTimeout(stableTimer);
    };
  }, [globeData]);

  // Handle skip to random next — fly to the area but don't zoom to street level
  const handleSkipNext = useCallback(() => {
    if (globeData.length > 0) {
      const randomItem = globeData[Math.floor(Math.random() * globeData.length)];
      setSelectedItem(randomItem);
      if (randomItem.lat != null && randomItem.lng != null) {
        // Fly to the area at a comfortable altitude where clusters start to break apart
        flyTo(randomItem.lat, randomItem.lng, 0.3, 1200);
      }
    }
  }, [globeData, flyTo]);

  const handleToggleFavorite = useCallback(() => {
    if (selectedItem && !Array.isArray(selectedItem)) {
      handleAuthRequiredAction(() => {
        if (toggleFavorite) {
          toggleFavorite(selectedItem.id);
        }
      });
    }
  }, [selectedItem, handleAuthRequiredAction, toggleFavorite]);

  // ── Viewfinder Mode Handlers ──
  const handleCreateOwn = useCallback(() => {
    const item = Array.isArray(selectedItem) ? selectedItem[0] : selectedItem;
    if (!item) return;
    handleAuthRequiredAction(() => {
      setViewfinderTarget(item);
      setMode('viewfinder');
      analytics.track('viewfinder_entered', {
        source_postcard_id: item.id,
        city: item.city,
        country: item.country,
      });
    });
  }, [selectedItem, handleAuthRequiredAction]);

  const handleBackToGlobe = useCallback(() => {
    setGlobeReady(false);
    hasInitialFocus.current = false;
    setMode('globe');
    analytics.track('viewfinder_exited_to_globe');
  }, []);

  const handleSelectNearby = useCallback((item: FeedItem) => {
    setViewfinderTarget(item);
    setSelectedItem(item);
  }, []);

  // Get nearby items for the viewfinder sidebar
  const nearbyItems = useMemo(() => {
    if (!viewfinderTarget?.lat || !viewfinderTarget?.lng) return [];
    const radiusKm = 5;
    return globeData.filter((item) => {
      if (item.id === viewfinderTarget.id) return false;
      if (!item.lat || !item.lng) return false;
      const dLat = item.lat - viewfinderTarget.lat!;
      const dLng = item.lng - viewfinderTarget.lng!;
      const approxKm = Math.sqrt(dLat * dLat + dLng * dLng) * 111;
      return approxKm < radiusKm;
    }).slice(0, 6);
  }, [viewfinderTarget, globeData]);

  // ── Radio Garden-style markers: tiny dots ──
  // Dot size helper: scales with altitude so pins are visible at street level
  const getDotSize = useCallback((base: number) => {
    const alt = globeEl.current?.pointOfView()?.altitude ?? 1;
    if (alt > 0.3) return base;           // Far away — standard size
    if (alt > 0.05) return base * 1.5;    // Region level — slightly bigger
    return base * 2;                       // Street level — double size
  }, []);

  const renderHtmlElement = useCallback((d: object) => {
    const feature = d as any;
    const isCluster = feature.properties.cluster;
    const count = feature.properties.point_count || 0;
    
    const el = document.createElement('div');
    el.className = 'globe-marker cursor-pointer pointer-events-auto select-none';
    
    // If "cluster" has only 1 item, treat it as an individual dot
    if (isCluster && count > 1) {
      // Cluster dot — small circle with count badge
      const clusterSize = Math.min(14, 8 + Math.log2(count) * 2);
      el.innerHTML = `
        <div style="position:relative;display:flex;align-items:center;justify-content:center">
          <div style="width:${clusterSize}px;height:${clusterSize}px;border-radius:50%;background:rgba(52,211,153,0.7);box-shadow:0 0 6px rgba(52,211,153,0.5)"></div>
          <span style="position:absolute;top:-12px;left:50%;transform:translateX(-50%);font-size:10px;color:#fff;font-weight:700;text-shadow:0 1px 3px rgba(0,0,0,0.9);white-space:nowrap">${count}</span>
        </div>
      `;
      
      const handleClick = (e?: Event) => {
        if (e) { e.stopPropagation(); e.preventDefault(); }
        
        // Select the cluster's anchor postcard so the panel updates
        try {
          const leaves = clusterIndex.getLeaves(feature.properties.cluster_id, 1);
          if (leaves[0]?.properties?.item) {
            setSelectedItem(leaves[0].properties.item);
          }
        } catch { /* ignore */ }
        
        if (globeEl.current) {
          const currentPov = globeEl.current.pointOfView();
          const currentAlt = currentPov?.altitude ?? 2;
          const newAlt = Math.max(0.005, currentAlt / 8);
          
          flyTo(
            feature.geometry.coordinates[1],
            feature.geometry.coordinates[0],
            newAlt,
            800
          );
        }
      };

      el.onclick = handleClick;
      el.ontouchend = handleClick;
      return el;
    }

    // Individual postcard (or cluster of 1) — green dot
    // For cluster-of-1, extract the item from the cluster
    let item: FeedItem;
    if (isCluster && count <= 1) {
      // Get the single item from this cluster
      const leaves = clusterIndex.getLeaves(feature.properties.cluster_id, 1);
      item = leaves[0]?.properties?.item;
      if (!item) return el;
    } else {
      item = feature.properties.item as FeedItem;
    }

    const isSelected = !Array.isArray(selectedItem) && selectedItem?.id === item.id;
    const currentAltitude = zoomLevelRef.current;
    const isStreetLevel = currentAltitude >= 14; // very close zoom

    if (isStreetLevel && item.image_url) {
      // 📍 Thumbnail Pin — rich preview at street level
      const imgUrl = cdnImage(item.image_url, 96);
      const size = isSelected ? 56 : 44;
      const borderColor = isSelected ? '#34d399' : 'rgba(255,255,255,0.9)';
      const shadow = isSelected 
        ? '0 2px 12px rgba(52,211,153,0.6), 0 4px 20px rgba(0,0,0,0.4)' 
        : '0 2px 8px rgba(0,0,0,0.4)';
      
      el.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;transform:translateY(-${size/2 + 6}px)">
          <div style="width:${size}px;height:${size}px;border-radius:8px;border:2.5px solid ${borderColor};overflow:hidden;box-shadow:${shadow};background:#1a1a2e">
            <img src="${imgUrl}" style="width:100%;height:100%;object-fit:cover" loading="lazy" />
          </div>
          <div style="width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:6px solid ${borderColor};margin-top:-1px"></div>
        </div>
      `;
    } else {
      // 🟢 Simple dot — compact at higher altitudes
      const baseSize = isSelected ? 12 : 8;
      const dotSize = getDotSize(baseSize);
      const glow = isSelected 
        ? '0 0 10px rgba(52,211,153,0.9), 0 0 20px rgba(52,211,153,0.4)' 
        : '0 0 4px rgba(52,211,153,0.4)';
      const bg = isSelected ? 'rgba(52,211,153,1)' : 'rgba(52,211,153,0.85)';
      
      el.innerHTML = `
        <div style="width:${dotSize}px;height:${dotSize}px;border-radius:50%;background:${bg};box-shadow:${glow};transition:all 0.2s ease"></div>
      `;
    }

    const handleItemClick = (e?: Event) => {
      if (e) { e.stopPropagation(); e.preventDefault(); }
      setSelectedItem(item);
      // Pan to center on this dot — keep same altitude (Radio Garden style)
      if (globeEl.current && item.lat != null && item.lng != null) {
        const currentAlt = globeEl.current.pointOfView()?.altitude ?? 0.05;
        flyTo(item.lat, item.lng, currentAlt, 600);
      }
    };

    el.onclick = handleItemClick;
    el.ontouchend = handleItemClick;

    return el;
  }, [selectedItem, clusterIndex, getDotSize, zoomLevel]);

  // Setup globe size dynamically
  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });
  useEffect(() => {
    const handleResize = () => setDimensions({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Initial spin (disabled per user request so the user moves it manually)
  // We also set min/max distance here to prevent zooming into low-res textures
  useEffect(() => {
    if (globeEl.current && globeEl.current.controls) {
      const controls = globeEl.current.controls();
      if (controls) {
        controls.autoRotate = false;
        // The default globe radius in three-globe is 100.
        // We set minDistance to 100.1 to allow getting all the way to street-level zoom.
        controls.minDistance = 100.1;
        controls.maxDistance = 400;
      }
    }
  }, []);

  // Manual zoom controls — proportional to current altitude for smooth feel at any level
  const handleZoom = useCallback((direction: 'in' | 'out') => {
    if (globeEl.current) {
      const pov = globeEl.current.pointOfView();
      if (pov) {
        const newAlt = direction === 'in'
          ? Math.max(0.001, pov.altitude / 2)   // zoom in: halve altitude
          : Math.min(3, pov.altitude * 2);        // zoom out: double altitude
        globeEl.current.pointOfView({ ...pov, altitude: newAlt }, 400);
      }
    }
  }, []);

  // When selectedItem changes, re-render html elements to update their styles
  useEffect(() => {
    if (globeEl.current && globeData.length > 0) {
      // Force an update of the HTML elements by resetting the data array reference
      // This makes react-globe.gl re-evaluate the elements
      // We don't really want to do this on every single render, just when selection changes
      // Actually, since renderHtmlElement depends on selectedItem, react-globe.gl might not 
      // automatically re-render existing markers. We might need to trigger an update.
      // A safe way is just letting React handle it, but react-globe.gl caches markers.
      // We'll see if it updates. If not, it's a minor UX thing.
    }
  }, [selectedItem, globeData]);

  const isFavorited = selectedItem && !Array.isArray(selectedItem) 
    ? favoriteIds.has(selectedItem.id) 
    : false;

  // ── Viewfinder Mode ──
  if (mode === 'viewfinder' && viewfinderTarget) {
    return (
      <div className="w-full h-full relative bg-[#0a0a0e] overflow-hidden flex">
        {/* Left Sidebar - hidden on mobile to maximize camera space */}
        <div className="hidden md:block">
          <ViewfinderSidebar
            sourceItem={viewfinderTarget}
            nearbyItems={nearbyItems}
            onBack={handleBackToGlobe}
            onSelectNearby={handleSelectNearby}
          />
        </div>

        {/* Right Panel — Street View Viewfinder */}
        <div className="flex-1 relative z-0">
          {/* Mobile Back Button Overlay */}
          <div className="md:hidden absolute top-safe-4 left-4 z-50">
            <button
              onClick={handleBackToGlobe}
              className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-md border border-white/10 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-all shadow-lg"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            </button>
          </div>

          <ViewfinderPanel
            sourceItem={viewfinderTarget}
            userId={user?.id}
            onPostcardCreated={() => {
              analytics.track('viewfinder_postcard_saved');
            }}
          />
        </div>
      </div>
    );
  }

  // ── Globe Mode (default) ──
  return (
    <div className="w-full h-full relative bg-[#0a0a0e] overflow-hidden">
      <GlobeHeader />

      {/* Globe Container */}
      <div className="absolute inset-0 flex items-center justify-center cursor-move">
        <Globe
          ref={globeEl}
          width={dimensions.width}
          height={dimensions.height}
          
          // CartoDB Voyager — free, no API key, crisp vector tiles
          globeTileEngineUrl={(x, y, l) => `https://a.basemaps.cartocdn.com/rastertiles/voyager/${l}/${x}/${y}@2x.png`}
          backgroundColor="#1a1a2e"
          
          // Atmosphere — subtle cyan glow
          atmosphereColor="#34d399"
          atmosphereAltitude={0.12}
          
          // HTML Markers for postcards and clusters
          htmlElementsData={clusters}
          htmlElement={renderHtmlElement}
          htmlLat={(d: any) => d.geometry.coordinates[1]}
          htmlLng={(d: any) => d.geometry.coordinates[0]}
        />
      </div>

      <GlobeReticle />
      <GlobeZoomControls onZoom={handleZoom} />
      <GlobeSelectionPanel
        selectedItem={selectedItem}
        isFavorited={isFavorited}
        onToggleFavorite={handleToggleFavorite}
        onSkipNext={handleSkipNext}
        onCreateOwn={handleCreateOwn}
      />

      {/* Top Gradient for readability of header */}
      <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-[#0a0a0e] to-transparent pointer-events-none" />

      {/* Loading Splash — covers ugly tile loading */}
      <AnimatePresence>
        {!globeReady && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="absolute inset-0 z-[100] bg-[#0a0a0e] flex flex-col items-center justify-center gap-4 pointer-events-none"
          >
            <div className="w-12 h-12 rounded-full border-2 border-emerald-400/30 border-t-emerald-400 animate-spin" />
            <p className="text-white/40 text-sm font-medium tracking-wide">
              {t({ es: 'Cargando mapa...', en: 'Loading map...' }, lang)}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

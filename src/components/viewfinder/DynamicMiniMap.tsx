import React, { useEffect, useRef, useState } from 'react';

// Dark theme map styles
const darkMapStyles = [
  { elementType: 'geometry', stylers: [{ color: '#242f3e' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#242f3e' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#746855' }] },
  {
    featureType: 'administrative.locality',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#d59563' }]
  },
  {
    featureType: 'poi',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#d59563' }]
  },
  {
    featureType: 'poi.park',
    elementType: 'geometry',
    stylers: [{ color: '#263c3f' }]
  },
  {
    featureType: 'poi.park',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#6b9a76' }]
  },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: '#38414e' }]
  },
  {
    featureType: 'road',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#212a37' }]
  },
  {
    featureType: 'road',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#9ca5b3' }]
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{ color: '#746855' }]
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#1f2835' }]
  },
  {
    featureType: 'road.highway',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#f3d19c' }]
  },
  {
    featureType: 'transit',
    elementType: 'geometry',
    stylers: [{ color: '#2f3948' }]
  },
  {
    featureType: 'transit.station',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#d59563' }]
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#17263c' }]
  },
  {
    featureType: 'water',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#515c6d' }]
  },
  {
    featureType: 'water',
    elementType: 'labels.text.stroke',
    stylers: [{ color: '#17263c' }]
  }
];

interface DynamicMiniMapProps {
  currentLat: number;
  currentLng: number;
  targetLat?: number;
  targetLng?: number;
  zoom?: number;
  className?: string;
  interactive?: boolean;
  darkMode?: boolean;
  onLocationClick?: (lat: number, lng: number) => void;
}

export function DynamicMiniMap({
  currentLat,
  currentLng,
  targetLat,
  targetLng,
  zoom = 16,
  className = "",
  interactive = false,
  darkMode = true,
  onLocationClick,
}: DynamicMiniMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const userMarkerRef = useRef<google.maps.marker.AdvancedMarkerElement | google.maps.Marker | null>(null);
  const targetMarkerRef = useRef<google.maps.marker.AdvancedMarkerElement | google.maps.Marker | null>(null);

  // Initialize Map
  useEffect(() => {
    if (!mapRef.current || !window.google?.maps) return;

    const newMap = new window.google.maps.Map(mapRef.current, {
      center: { lat: currentLat, lng: currentLng },
      zoom: zoom,
      disableDefaultUI: true,
      fullscreenControl: false,
      streetViewControl: false,
      mapTypeControl: false,
      zoomControl: false,
      gestureHandling: interactive ? 'auto' : 'none',
      styles: darkMode ? darkMapStyles : undefined,
    });

    setMap(newMap);

    // Click to navigate — move Street View to clicked location
    if (onLocationClick) {
      newMap.addListener('click', (e: google.maps.MapMouseEvent) => {
        if (e.latLng) {
          onLocationClick(e.latLng.lat(), e.latLng.lng());
        }
      });
    }

    return () => {
      // Clean up markers if any
      if (userMarkerRef.current) userMarkerRef.current.map = null;
      if (targetMarkerRef.current) targetMarkerRef.current.map = null;
    };
  }, []);

  // Update center when current location changes
  useEffect(() => {
    if (map) {
      const pos = new window.google.maps.LatLng(currentLat, currentLng);
      // Pan smoothly
      map.panTo(pos);
    }
  }, [currentLat, currentLng, map]);

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Google Map Container */}
      <div ref={mapRef} className="w-full h-full" />
      
      {/* Instead of Google Maps markers which can be heavy/annoying to style perfectly without AdvancedMarkers, 
          we can overlay HTML elements dead-center if we only care about the user position being the center.
          Wait, the map center is always the current position! So we can just overlay a UI dot in the exact center of the div!
      */}
      
      {/* Center dot (User) */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10">
        <div className="relative">
          <div className="w-4 h-4 bg-emerald-400 rounded-full shadow-[0_0_12px_rgba(52,211,153,0.6)] border-2 border-white/20" />
          <div className="absolute inset-0 w-4 h-4 bg-emerald-400 rounded-full animate-ping opacity-40" />
        </div>
      </div>

      {/* Bottom gradient to cover Google branding */}
      <div className="absolute bottom-0 left-0 right-0 h-5 bg-gradient-to-t from-black/90 to-transparent pointer-events-none z-10" />
    </div>
  );
}

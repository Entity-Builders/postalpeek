import React, { useState } from "react";
import { motion } from "framer-motion";
import { Globe, Clock, Star, MapPin, ChevronRight, Lock, Camera, Search } from "lucide-react";
import { FeedItem } from "../Postcard";
import { useLang, t } from "../../utils/i18n";
import { cdnImage, WIDTHS } from "../../utils/imageUtils";
import { DynamicMiniMap } from "./DynamicMiniMap";

interface MissionBriefingProps {
  sourceItem: FeedItem;
  onStartMission: (coords?: {lat: number; lng: number; address?: string; city?: string; country?: string}) => void;
  onBack: () => void;
}

export function MissionBriefing({ sourceItem, onStartMission, onBack }: MissionBriefingProps) {
  const lang = useLang();
  
  // Local state for Free Slot location selection
  const [selectedLocation, setSelectedLocation] = useState<{lat: number, lng: number, address?: string, city?: string, country?: string} | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const isOwned = sourceItem.owner_id !== null;
  const targetImage = isOwned
    ? sourceItem.illustration_url
    : sourceItem.original_image_url;

  // For free slots, we show the selected location if any, otherwise default text
  const title = sourceItem.is_free 
    ? (selectedLocation?.city || "Choose a Location") 
    : (sourceItem.location_name || "Unknown Location");
    
  const locationText = sourceItem.is_free
    ? (selectedLocation ? `${selectedLocation.city || ''}, ${selectedLocation.country || ''}`.replace(/^, /, '').replace(/, $/, '') : "Anywhere")
    : (sourceItem.city ? `${sourceItem.city}, ${sourceItem.country}` : "Unknown Location");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || !window.google?.maps) return;
    
    setIsSearching(true);
    setSearchError(null);
    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ address: searchQuery }, (results, status) => {
      setIsSearching(false);
      if (status === 'OK' && results?.[0]) {
        const result = results[0];
        const loc = result.geometry.location;
        
        let city = "";
        let country = "";
        for (const component of result.address_components) {
          if (component.types.includes("locality")) city = component.long_name;
          if (component.types.includes("country")) country = component.long_name;
        }
        
        setSelectedLocation({
          lat: loc.lat(),
          lng: loc.lng(),
          address: result.formatted_address,
          city: city || result.formatted_address,
          country
        });
      } else {
        setSearchError("Location not found");
      }
    });
  };

  const handleMapClick = (lat: number, lng: number) => {
    if (!sourceItem.is_free || !window.google?.maps) return;
    
    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ location: { lat, lng } }, (results, status) => {
      if (status === 'OK' && results?.[0]) {
        const result = results[0];
        let city = "";
        let country = "";
        for (const component of result.address_components) {
          if (component.types.includes("locality")) city = component.long_name;
          if (component.types.includes("country")) country = component.long_name;
        }
        setSelectedLocation({
          lat,
          lng,
          address: result.formatted_address,
          city: city || "Unknown Location",
          country
        });
      } else {
        setSelectedLocation({ lat, lng, city: "Selected Pin", country: "" });
      }
    });
  };

  const handleStart = () => {
    if (sourceItem.is_free) {
      if (!selectedLocation) {
        setSearchError("Please select a location first");
        return;
      }
      onStartMission(selectedLocation);
    } else {
      onStartMission();
    }
  };

  // Determine which coords to show on map
  const mapLat = sourceItem.is_free ? (selectedLocation?.lat ?? 20) : sourceItem.lat;
  const mapLng = sourceItem.is_free ? (selectedLocation?.lng ?? 0) : sourceItem.lng;
  const mapZoom = sourceItem.is_free && !selectedLocation ? 2 : 15;

  return (
    <div className="absolute inset-0 z-50 bg-[#111115] flex flex-col font-sans overflow-hidden">
      
      {/* Top Header */}
      <div className="p-5 pb-2 pt-10">
        <div className="flex items-center gap-3">
          <Globe className="w-6 h-6 text-white/90" />
          <h1 className="text-white text-xl font-bold tracking-wide">
            {sourceItem.is_free ? t({ es: "VIAJE LIBRE", en: "FREE DIVE" }, lang) : t({ es: "MISSION BRIEFING", en: "MISSION BRIEFING" }, lang)}
          </h1>
        </div>
        <div className="text-white/60 text-[10px] tracking-widest mt-1 ml-9">
          {sourceItem.is_free ? "PICK YOUR DESTINATION" : "MAP // MISSION"}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-6">
        
        {/* Polaroid — NO blur, shows the illustration clearly with lock overlay */}
        {!sourceItem.is_free && (
          <div className="py-5 flex justify-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, rotate: -4 }}
              animate={{ opacity: 1, scale: 1, rotate: 3 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="w-full max-w-[340px] bg-white p-3 pb-8 rounded shadow-2xl relative"
            >
              <div className="aspect-[4/3] bg-black rounded-sm overflow-hidden relative">
                {targetImage ? (
                  <img
                    src={cdnImage(targetImage, { width: WIDTHS.mobile })}
                    alt="Target"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center opacity-30">
                    <Camera className="w-12 h-12 text-white" />
                  </div>
                )}
                
                {/* Lock overlay — semi-transparent, no blur on the image itself */}
                {!isOwned && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/30">
                    <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center shadow-lg mb-2">
                      <Lock className="w-7 h-7 text-white" />
                    </div>
                    <div className="text-white text-[10px] font-bold tracking-widest uppercase mb-0.5 drop-shadow-md">
                      GOAL: {title}
                    </div>
                    <div className="text-white text-2xl font-black italic tracking-wider uppercase drop-shadow-lg" style={{ WebkitTextStroke: '1px rgba(0,0,0,0.5)' }}>
                      LOCKED
                    </div>
                  </div>
                )}
              </div>
              
              {/* Polaroid Footer — date + location */}
              <div className="absolute bottom-2.5 left-4 right-4 flex justify-between items-center text-black/80 text-[10px] font-bold uppercase tracking-wider">
                <span>20 OCT 2023</span>
                <span>{locationText}</span>
              </div>
            </motion.div>
          </div>
        )}

        {/* Mission Title & Stats Row */}
        <div className={`flex justify-between items-end mb-3 ${sourceItem.is_free ? 'mt-4' : 'mt-1'}`}>
          <div>
            <h2 className="text-white/80 text-sm font-medium uppercase tracking-wider">
              {sourceItem.is_free ? "DESTINATION:" : "MISSION:"} <span className="text-white font-bold">{title}</span>
            </h2>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-1.5 text-white/90 text-xs font-medium">
              <Clock className="w-3.5 h-3.5" />
              <span>5:00 MIN</span>
            </div>
            <div className="flex items-center gap-0.5">
              <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
              <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
              <Star className="w-3.5 h-3.5 text-white/40" />
            </div>
          </div>
        </div>
        
        {/* Search Bar for Free Slots */}
        {sourceItem.is_free && (
          <form onSubmit={handleSearch} className="mb-4">
            <div className="relative flex items-center w-full bg-[#1c1c24] border border-white/10 rounded-xl overflow-hidden focus-within:border-indigo-500/50 focus-within:shadow-[0_0_15px_rgba(99,102,241,0.2)] transition-all">
              <div className="pl-4 flex items-center justify-center text-white/40">
                <Search className="w-5 h-5" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t({ es: "Busca una ciudad o lugar...", en: "Search a city or place..." }, lang)}
                className="w-full py-4 px-3 bg-transparent text-white placeholder:text-white/30 focus:outline-none text-sm"
              />
              <button
                type="submit"
                disabled={!searchQuery.trim() || isSearching}
                className="px-4 text-indigo-400 font-bold uppercase text-xs hover:text-indigo-300 transition-colors disabled:opacity-50"
              >
                {isSearching ? "..." : "GO"}
              </button>
            </div>
            {searchError && (
              <p className="text-red-400 text-xs mt-2 ml-1">{searchError}</p>
            )}
          </form>
        )}

        {/* Map Block — dark themed */}
        <div className="w-full aspect-video rounded-2xl overflow-hidden relative border border-white/10 shadow-lg mb-4">
          {mapLat != null && mapLng != null ? (
            <DynamicMiniMap 
              targetLat={mapLat}
              targetLng={mapLng}
              currentLat={mapLat}
              currentLng={mapLng}
              zoom={mapZoom}
              className="w-full h-full"
              interactive={sourceItem.is_free}
              darkMode={false}
              onLocationClick={sourceItem.is_free ? handleMapClick : undefined}
            />
          ) : (
            <div className="w-full h-full bg-[#1c1c24] flex items-center justify-center">
              <span className="text-white/40 text-xs uppercase tracking-widest">Map Unavailable</span>
            </div>
          )}

          {/* Target Overlay Chip */}
          <div className="absolute top-3 left-3 bg-[#111115]/90 backdrop-blur-md px-3 py-1.5 rounded-full flex items-center gap-2 border border-white/10">
            <MapPin className="w-3.5 h-3.5 text-white" />
            <span className="text-white text-xs font-medium">{sourceItem.is_free ? "Select Area" : "Target"}</span>
          </div>

        </div>

        {/* Objective Text */}
        <p className="text-white/90 text-sm leading-relaxed mb-6">
          <span className="text-white font-bold uppercase tracking-wider mr-2">OBJECTIVE:</span>
          {sourceItem.is_free 
            ? t({
                es: "Este es un viaje libre. Selecciona cualquier lugar en el mapa, cae ahí y captura una postal única. ¡Tú decides el destino!",
                en: "This is a free dive. Select any location on the map, drop in, and capture a unique postcard. You decide the destination!"
              }, lang)
            : t({ 
                es: "Cae en el mundo, encuentra esta ubicación exacta y toma una foto para desbloquear tu coleccionable digital. ¡50 XP y Medalla!", 
                en: "Drop into the world, find this exact location, and snap a photo to unlock your unique digital collectible! 50 XP & Badge" 
              }, lang)}
        </p>

        {/* Start Button */}
        <div className="mt-auto">
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.4 }}
            onClick={handleStart}
            className="w-full h-14 rounded-full font-bold text-white text-lg flex items-center justify-center gap-2 relative overflow-hidden group shadow-[0_0_30px_rgba(139,92,246,0.3)] hover:shadow-[0_0_40px_rgba(139,92,246,0.5)] transition-shadow"
            style={{
              background: 'linear-gradient(90deg, #06b6d4 0%, #8b5cf6 100%)'
            }}
          >
            <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
            <span className="tracking-wide uppercase relative z-10 font-black italic">
              {t({ es: "INICIAR EXPLORACIÓN", en: "START EXPLORING" }, lang)}
            </span>
            <ChevronRight className="w-5 h-5 relative z-10" />
          </motion.button>
          
          <button 
            onClick={onBack}
            className="w-full py-4 text-center text-white/60 text-xs font-bold uppercase tracking-widest mt-2 hover:text-white/90 transition-colors"
          >
            {t({ es: "VOLVER", en: "GO BACK" }, lang)}
          </button>
        </div>

      </div>
    </div>
  );
}



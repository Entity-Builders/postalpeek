import React from "react";
import { motion } from "framer-motion";
import { Globe, Clock, Star, MapPin, ChevronRight, Lock, Camera } from "lucide-react";
import { FeedItem } from "../Postcard";
import { useLang, t } from "../../utils/i18n";
import { cdnImage, WIDTHS } from "../../utils/imageUtils";
import { DynamicMiniMap } from "./DynamicMiniMap";

interface MissionBriefingProps {
  sourceItem: FeedItem;
  onStartMission: () => void;
  onBack: () => void;
}

export function MissionBriefing({ sourceItem, onStartMission, onBack }: MissionBriefingProps) {
  const lang = useLang();

  const isOwned = sourceItem.owner_id !== null;
  const targetImage = isOwned
    ? sourceItem.illustration_url
    : sourceItem.original_image_url;

  const title = sourceItem.slot_label || "Unknown Location";
  const locationText = sourceItem.city ? `${sourceItem.city}, ${sourceItem.country}` : "Unknown Location";

  return (
    <div className="absolute inset-0 z-50 bg-[#111115] flex flex-col font-sans overflow-hidden">
      
      {/* Top Header */}
      <div className="p-5 pb-2 pt-10">
        <div className="flex items-center gap-3">
          <Globe className="w-6 h-6 text-white/90" />
          <h1 className="text-white text-xl font-bold tracking-wide">
            {t({ es: "MISSION BRIEFING", en: "MISSION BRIEFING" }, lang)}
          </h1>
        </div>
        <div className="text-white/60 text-[10px] tracking-widest mt-1 ml-9">
          MAP // MISSION
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-6">
        
        {/* Polaroid — NO blur, shows the illustration clearly with lock overlay */}
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

        {/* Mission Title & Stats Row */}
        <div className="flex justify-between items-end mb-3 mt-1">
          <div>
            <h2 className="text-white/80 text-sm font-medium uppercase tracking-wider">
              MISSION: <span className="text-white font-bold">{title}</span>
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

        {/* Map Block — dark themed */}
        <div className="w-full aspect-video rounded-2xl overflow-hidden relative border border-white/10 shadow-lg mb-4">
          {sourceItem.lat != null && sourceItem.lng != null ? (
            <DynamicMiniMap 
              targetLat={sourceItem.lat}
              targetLng={sourceItem.lng}
              currentLat={sourceItem.lat}
              currentLng={sourceItem.lng}
              zoom={15}
              className="w-full h-full"
              interactive={false}
              darkMode={false}
            />
          ) : (
            <div className="w-full h-full bg-[#1c1c24] flex items-center justify-center">
              <span className="text-white/40 text-xs uppercase tracking-widest">Map Unavailable</span>
            </div>
          )}

          {/* Target Overlay Chip */}
          <div className="absolute top-3 left-3 bg-[#111115]/90 backdrop-blur-md px-3 py-1.5 rounded-full flex items-center gap-2 border border-white/10">
            <MapPin className="w-3.5 h-3.5 text-white" />
            <span className="text-white text-xs font-medium">Target</span>
          </div>


        </div>

        {/* Objective Text */}
        <p className="text-white/90 text-sm leading-relaxed mb-6">
          <span className="text-white font-bold uppercase tracking-wider mr-2">OBJECTIVE:</span>
          {t({ 
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
            onClick={onStartMission}
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


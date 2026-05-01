import React from "react";
import { motion } from "framer-motion";
import { X, ChevronRight, Lock, MapPin, Eye } from "lucide-react";
import { FeedItem } from "../../../../components/Postcard";
import { useLang, t } from "../../../../utils/i18n";
import { cdnImage, WIDTHS } from "../../../../utils/imageUtils";

interface MissionCTACardProps {
  item: FeedItem;
  onStartMission: (item: FeedItem) => void;
  onDismiss: () => void;
}

export function MissionCTACard({ item, onStartMission, onDismiss }: MissionCTACardProps) {
  const lang = useLang();

  const isOwned = item.owner_id !== null;
  const imgUrl = item.illustration_url || item.original_image_url || "";
  const thumbUrl = imgUrl ? cdnImage(imgUrl, { width: WIDTHS.albumCard }) : "";
  const slotLabel = (item as any).slot_label || item.city || "Unknown";

  // Strip emoji prefix from label
  const landmarkName = slotLabel
    .replace(/^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F?)\s*/u, "")
    .trim();

  const locationText = item.city
    ? `${item.city}, ${item.country}`
    : "Unknown Location";

  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.9 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      className="absolute bottom-52 md:bottom-56 left-3 right-3 md:left-1/2 md:-translate-x-1/2 md:max-w-xs z-[55]"
    >
      {/* Marker card */}
      <div className="relative bg-black/80 backdrop-blur-xl rounded-2xl border border-white/15 shadow-[0_4px_30px_rgba(0,0,0,0.5)] overflow-hidden">
        {/* Close */}
        <button
          onClick={(e) => { e.stopPropagation(); onDismiss(); }}
          className="absolute top-2 right-2 z-10 w-6 h-6 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
        >
          <X className="w-3 h-3 text-white/60" />
        </button>

        <div className="flex items-center gap-3 p-2.5 pr-9">
          {/* Thumbnail — round like a marker pin */}
          <div className="relative w-12 h-12 rounded-full overflow-hidden shrink-0 bg-stone-800 ring-2 ring-white/20">
            {thumbUrl ? (
              <img src={thumbUrl} alt={landmarkName} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <MapPin className="w-4 h-4 text-white/30" />
              </div>
            )}
            {!isOwned && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <Lock className="w-3 h-3 text-white/80" />
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h3 className="text-white font-bold text-[13px] leading-tight truncate">
              {landmarkName}
            </h3>
            <p className="text-white/45 text-[10px] font-medium truncate mt-0.5">
              <MapPin className="w-2.5 h-2.5 inline-block mr-0.5 -translate-y-px" />
              {locationText}
            </p>
            {/* Adventure teaser */}
            <p className="text-white/30 text-[9px] mt-1 leading-snug">
              {isOwned
                ? t({ es: "Ya tenés esta postal 🎨", en: "You already have this postcard 🎨" }, lang)
                : t({ es: "Explora los alrededores y crea tu postal 📸", en: "Explore the surroundings and create your postcard 📸" }, lang)
              }
            </p>
          </div>
        </div>

        {/* CTA row — different for owned vs unowned */}
        <div className="px-2.5 pb-2.5">
          <button
            onClick={(e) => { e.stopPropagation(); onStartMission(item); }}
            className="w-full h-9 rounded-full font-bold text-white text-[11px] flex items-center justify-center gap-1.5 tracking-wide uppercase transition-all hover:shadow-[0_0_20px_rgba(139,92,246,0.3)] active:scale-[0.97]"
            style={{
              background: isOwned
                ? "linear-gradient(90deg, #6b7280 0%, #4b5563 100%)"
                : "linear-gradient(90deg, #06b6d4 0%, #8b5cf6 100%)",
            }}
          >
            {isOwned ? (
              <>
                <Eye className="w-3.5 h-3.5" />
                <span>{t({ es: "VER MI POSTAL", en: "VIEW MY POSTCARD" }, lang)}</span>
              </>
            ) : (
              <>
                <span className="italic">
                  {t({ es: "IR A EXPLORAR", en: "GO EXPLORE" }, lang)}
                </span>
                <ChevronRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>
      </div>

      {/* Marker tail — triangle pointing down */}
      <div className="flex justify-center -mt-px">
        <div
          className="w-4 h-2.5"
          style={{
            clipPath: "polygon(0 0, 100% 0, 50% 100%)",
            background: "rgba(0,0,0,0.8)",
          }}
        />
      </div>
    </motion.div>
  );
}

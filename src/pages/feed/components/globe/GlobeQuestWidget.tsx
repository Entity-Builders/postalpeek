import React from "react";
import { Globe2 } from "lucide-react";
import { useLang, t, BilingualText } from "../../../../utils/i18n";

interface GlobeQuestWidgetProps {
  albumTitle: string | BilingualText;
  collectedSlots: number;
  totalSlots: number;
}

export function GlobeQuestWidget({
  albumTitle,
  collectedSlots,
  totalSlots,
}: GlobeQuestWidgetProps) {
  const lang = useLang();
  const progress =
    totalSlots > 0 ? (collectedSlots / totalSlots) * 100 : 0;

  const title =
    typeof albumTitle === "object" && albumTitle !== null
      ? t(albumTitle, lang)
      : albumTitle;

  return (
    <div className="absolute bottom-44 md:bottom-48 left-4 right-4 md:left-auto md:right-auto md:left-1/2 md:-translate-x-1/2 z-[50] pointer-events-none">
      <div className="bg-black/50 backdrop-blur-xl border border-white/10 rounded-2xl px-4 py-3 flex items-center gap-3 max-w-sm mx-auto shadow-2xl pointer-events-auto">
        {/* Globe icon */}
        <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center shrink-0">
          <Globe2 size={18} className="text-white/90" />
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <span className="text-white/90 font-bold text-xs uppercase tracking-widest block">
            {t({ es: "Explorador Mundial", en: "World Explorer" }, lang)}
          </span>
          <span className="text-white/60 text-[10px] font-semibold block mt-0.5">
            {t({ es: "Quest activa:", en: "Active Quest:" }, lang)}{" "}
            <span className="text-white/80">
              {t({ es: "Descubre", en: "Discover" }, lang)} {totalSlots}{" "}
              {t({ es: "lugares", en: "Landmarks" }, lang)}
            </span>
          </span>

          {/* Mini progress bar */}
          <div className="flex items-center gap-2 mt-1.5">
            <div className="flex-1 h-[3px] bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-all duration-700 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-white/60 text-[10px] font-bold tabular-nums shrink-0">
              {collectedSlots}/{totalSlots}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

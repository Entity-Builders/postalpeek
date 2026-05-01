import React from "react";
import { useLang, t } from "../../../../utils/i18n";

interface GlobeProgressHeaderProps {
  ownedCount: number;
  totalCount: number;
}

export function GlobeProgressHeader({
  ownedCount,
  totalCount,
}: GlobeProgressHeaderProps) {
  const lang = useLang();
  const progress = totalCount > 0 ? (ownedCount / totalCount) * 100 : 0;

  // Dynamic coaching subtitle based on progress
  const getSubtitle = () => {
    if (ownedCount === 0) {
      return t(
        {
          es: "Toca un destino abajo para comenzar tu aventura ✨",
          en: "Tap a destination below to begin your adventure ✨",
        },
        lang,
      );
    }
    if (ownedCount >= totalCount && totalCount > 0) {
      return t(
        { es: "¡Álbum completo! 🏆", en: "Album complete! 🏆" },
        lang,
      );
    }
    return t(
      {
        es: `Llevas ${ownedCount} de ${totalCount} — ¡sigue explorando!`,
        en: `${ownedCount} of ${totalCount} collected — keep exploring!`,
      },
      lang,
    );
  };

  return (
    <div className="absolute top-0 left-0 right-0 z-[60] pointer-events-none">
      {/* Top gradient for readability */}
      <div className="absolute inset-0 h-32 bg-gradient-to-b from-black/70 via-black/30 to-transparent" />

      <div className="relative px-4 pt-4 pb-2 flex flex-col gap-2">
        {/* Title row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg leading-none">🌍</span>
            <h1 className="text-white font-black text-base md:text-lg tracking-tight uppercase leading-none">
              Postal Peek
            </h1>
          </div>
          {/* Collection pill */}
          <div className="flex items-center gap-1.5 px-3 py-1 bg-white/10 border border-white/10 rounded-full backdrop-blur-sm">
            <span className="text-xs">🎨</span>
            <span className="text-white font-bold text-xs tabular-nums">
              {ownedCount}/{totalCount}
            </span>
          </div>
        </div>

        {/* Coaching subtitle */}
        <p className="text-white/45 text-[11px] font-medium leading-snug">
          {getSubtitle()}
        </p>

        {/* Progress bar — thin and subtle */}
        <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-cyan-400 to-violet-500 rounded-full transition-all duration-700 ease-out shadow-[0_0_6px_rgba(139,92,246,0.5)]"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}

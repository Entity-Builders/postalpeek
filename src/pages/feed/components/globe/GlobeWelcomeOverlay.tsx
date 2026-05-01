import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { Camera } from "lucide-react";
import { useLang, t } from "../../../../utils/i18n";
import type { FeedItem } from "../../../../components/Postcard";

const STORAGE_KEY = "postalpeek_onboarded";

interface GlobeWelcomeOverlayProps {
  destinations: FeedItem[];
  onSelectDestination: (item: FeedItem) => void;
  onDismiss: () => void;
}

export function GlobeWelcomeOverlay({
  destinations,
  onSelectDestination,
  onDismiss,
}: GlobeWelcomeOverlayProps) {
  const lang = useLang();

  // Pick a random unowned destination (or any if all owned)
  const suggestedDest = useMemo(() => {
    const unowned = destinations.filter((d) => d.owner_id === null);
    const pool = unowned.length > 0 ? unowned : destinations;
    if (pool.length === 0) return null;
    return pool[Math.floor(Math.random() * pool.length)];
  }, [destinations]);

  // Extract clean city name from the suggested destination
  const destName = useMemo(() => {
    if (!suggestedDest) return "";
    const label = (suggestedDest as any).slot_label || suggestedDest.city || "";
    // Strip emoji prefix
    return label.replace(/^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F?)\s*/u, "").trim();
  }, [suggestedDest]);

  const handleStart = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    if (suggestedDest) {
      onSelectDestination(suggestedDest);
    } else {
      onDismiss();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className="absolute inset-0 z-[200] flex flex-col items-center justify-end pb-[14vh] px-6 cursor-pointer"
      onClick={handleStart}
    >
      {/* Vignette — globe shows through center */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 45%, transparent 15%, rgba(5,5,16,0.5) 45%, rgba(5,5,16,0.92) 75%)",
        }}
      />

      {/* Top gradient */}
      <div className="absolute top-0 left-0 right-0 h-40 bg-gradient-to-b from-[#050510] via-[#050510]/50 to-transparent" />

      {/* Bottom gradient for readability */}
      <div className="absolute bottom-0 left-0 right-0 h-72 bg-gradient-to-t from-[#050510] via-[#050510]/90 to-transparent" />

      {/* Content */}
      <div className="relative flex flex-col items-center text-center max-w-sm">
        {/* Camera icon */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3, type: "spring", stiffness: 300 }}
          className="mb-5"
        >
          <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center backdrop-blur-sm">
            <Camera className="w-7 h-7 text-white/70" />
          </div>
        </motion.div>

        {/* Main headline */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            delay: 0.5,
            type: "spring",
            stiffness: 300,
            damping: 25,
          }}
          className="text-white font-black text-[26px] md:text-[32px] leading-[1.15] tracking-tight mb-4"
        >
          {t(
            {
              es: "Agarra tu cámara y viajá por el mundo",
              en: "Grab your camera and travel the world",
            },
            lang,
          )}
        </motion.h1>

        {/* Story */}
        <motion.p
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="text-white/45 text-[13px] leading-relaxed mb-8 max-w-[300px]"
        >
          {t(
            {
              es: "Elegí un destino del mapa, explorá sus calles en Street View y sacá tu propia postal artística de cada aventura.",
              en: "Pick a destination from the map, explore its streets in Street View, and snap your own artistic postcard from each adventure.",
            },
            lang,
          )}
        </motion.p>

        {/* Destination reveal — "Te ha tocado viajar a..." */}
        {suggestedDest && destName && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9 }}
            className="mb-6 px-5 py-3 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm"
          >
            <p className="text-white/40 text-[11px] uppercase tracking-widest mb-1">
              {t(
                { es: "Tu primer destino", en: "Your first destination" },
                lang,
              )}
            </p>
            <p className="text-white font-bold text-lg leading-tight">
              {t(
                {
                  es: `Te ha tocado viajar a`,
                  en: `You're traveling to`,
                },
                lang,
              )}{" "}
              <span
                className="bg-clip-text text-transparent"
                style={{
                  backgroundImage:
                    "linear-gradient(90deg, #06b6d4, #8b5cf6, #ec4899)",
                }}
              >
                {destName}
              </span>{" "}
              ✈️
            </p>
          </motion.div>
        )}

        {/* CTA */}
        <motion.button
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{
            delay: 1.1,
            type: "spring",
            stiffness: 400,
            damping: 25,
          }}
          onClick={(e) => {
            e.stopPropagation();
            handleStart();
          }}
          className="group relative h-14 px-10 rounded-full font-bold text-white text-[14px] flex items-center justify-center gap-2.5 tracking-wide transition-all active:scale-[0.96]"
          style={{
            background:
              "linear-gradient(135deg, #06b6d4 0%, #8b5cf6 50%, #ec4899 100%)",
            boxShadow:
              "0 0 40px rgba(139,92,246,0.3), 0 4px 20px rgba(0,0,0,0.3)",
          }}
        >
          <span>
            {suggestedDest
              ? t(
                  { es: `🛫 VIAJAR A ${destName.toUpperCase()}`, en: `🛫 TRAVEL TO ${destName.toUpperCase()}` },
                  lang,
                )
              : t(
                  { es: "📍 ELEGIR MI PRIMER DESTINO", en: "📍 PICK MY FIRST DESTINATION" },
                  lang,
                )}
          </span>
        </motion.button>

        {/* Subtle hint */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
          className="text-white/15 text-[10px] mt-5 tracking-wider uppercase"
        >
          {t(
            { es: "Toca para continuar", en: "Tap to continue" },
            lang,
          )}
        </motion.p>
      </div>
    </motion.div>
  );
}

/** Utility to check if the user has already been onboarded */
export function shouldShowWelcome(): boolean {
  try {
    return !localStorage.getItem(STORAGE_KEY);
  } catch {
    return false;
  }
}

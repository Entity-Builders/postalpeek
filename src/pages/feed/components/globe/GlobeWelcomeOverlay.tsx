import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin } from "lucide-react";
import { useLang, t } from "../../../../utils/i18n";
import type { FeedItem } from "../../../../components/Postcard";
import { cdnImage, WIDTHS } from "../../../../utils/imageUtils";

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
  
  // Filter out 'Free Slot' from onboarding destinations so they only see real places
  const realDestinations = destinations.filter(d => !d.is_free);

  const [activeItemId, setActiveItemId] = useState<string | null>(
    realDestinations.length > 0 ? realDestinations[0].id : null
  );

  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollingByCode = useRef(false);

  // Auto-scroll to active item when it changes from outside
  useEffect(() => {
    if (activeItemId && scrollRef.current && !scrollingByCode.current) {
      const container = scrollRef.current;
      const card = container.querySelector(
        `[data-id="${activeItemId}"]`,
      ) as HTMLElement;
      if (card) {
        scrollingByCode.current = true;
        const containerCenter = container.offsetWidth / 2;
        const cardCenter = card.offsetLeft + card.offsetWidth / 2;
        container.scrollTo({
          left: cardCenter - containerCenter,
          behavior: "smooth",
        });
        setTimeout(() => {
          scrollingByCode.current = false;
        }, 800);
      }
    }
  }, [activeItemId, realDestinations]);

  const handleScroll = () => {
    if (scrollingByCode.current) return;
    if (!scrollRef.current) return;

    const container = scrollRef.current;
    const containerCenter = container.scrollLeft + container.offsetWidth / 2;

    let closestItem: FeedItem | null = null;
    let closestDist = Infinity;

    const cards = container.querySelectorAll(".onboarding-card");
    cards.forEach((cardEl) => {
      const card = cardEl as HTMLElement;
      const cardCenter = card.offsetLeft + card.offsetWidth / 2;
      const dist = Math.abs(containerCenter - cardCenter);

      if (dist < closestDist) {
        closestDist = dist;
        const id = card.getAttribute("data-id");
        closestItem = realDestinations.find((i) => i.id === id) ?? null;
      }
    });

    if (closestItem && (closestItem as FeedItem).id !== activeItemId) {
      scrollingByCode.current = true;
      setActiveItemId(closestItem.id);
      setTimeout(() => {
        scrollingByCode.current = false;
      }, 500);
    }
  };

  const scrollTimeout = useRef<any>(null);
  const onScrollDebounced = () => {
    if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
    scrollTimeout.current = setTimeout(handleScroll, 150);
  };

  const handleStart = (item?: FeedItem) => {
    localStorage.setItem(STORAGE_KEY, "1");
    if (item) {
      onSelectDestination(item);
    } else {
      onDismiss();
    }
  };

  const getThumbnailUrl = (url: string) => {
    if (!url) return "";
    return cdnImage(url, { width: WIDTHS.albumCard });
  };

  const getLandmarkName = (label: string): string => {
    if (!label) return '';
    return label.replace(/^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F?)\s*/u, '').trim();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8 }}
      className="absolute inset-0 z-[200] flex flex-col items-center justify-center cursor-default overflow-hidden"
    >
      {/* Immersive background - clean gradient to darken top and bottom, very subtle blur */}
      <div className="absolute inset-0 bg-[#050510]/10 backdrop-blur-[2px] pointer-events-none" />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "linear-gradient(to bottom, rgba(5,5,16,0.6) 0%, rgba(5,5,16,0.1) 40%, rgba(5,5,16,0.8) 70%, rgba(5,5,16,1) 100%)",
        }}
      />

      {/* Minimalist Typographic Overlay */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 1, ease: "easeOut" }}
        className="relative z-10 flex flex-col items-center text-center w-full px-6 mb-[15vh] pointer-events-none"
      >
        <h1 className="text-white font-black text-4xl md:text-5xl leading-tight tracking-tighter mb-5 drop-shadow-2xl">
          {t(
            {
              es: "Capturá el mundo.",
              en: "Capture the world.",
            },
            lang,
          )}
        </h1>
        
        <p className="text-white/80 text-lg md:text-xl leading-relaxed max-w-sm font-medium drop-shadow-lg">
          {t(
            {
              es: "Elegí un destino, explorá sus calles y registrá una postal única a tu nombre.",
              en: "Pick a destination, explore its streets, and register a unique postcard under your name.",
            },
            lang,
          )}
        </p>

        {/* Elegant subtle separator */}
        <div className="w-12 h-[2px] bg-gradient-to-r from-transparent via-white/40 to-transparent mt-8" />
      </motion.div>

      {/* Interactive Carousel Zone - Polaroid Style */}
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, type: "spring", stiffness: 300, damping: 25 }}
        className="absolute bottom-10 left-0 right-0 w-full"
      >
        <div className="flex flex-col items-center mb-6 pointer-events-none">
          <p className="text-white/60 font-bold text-[10px] uppercase tracking-[0.3em] mb-2 drop-shadow-md">
            {t({ es: "Seleccioná tu destino", en: "Select your destination" }, lang)}
          </p>
          <div className="w-8 h-[2px] bg-white/20 rounded-full" />
        </div>
        
        <div className="relative pointer-events-auto">
          <div
            ref={scrollRef}
            onScroll={onScrollDebounced}
            className="flex gap-4 overflow-x-auto px-[50vw] pb-8 pt-4 snap-x snap-mandatory hide-scrollbar"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            {realDestinations.map((item) => {
              const isActive = item.id === activeItemId;
              const slotLabel = (item as any).slot_label || t(item.city, lang) || '???';
              const landmarkName = getLandmarkName(slotLabel) || t(item.city, lang);
              const thumbUrl = getThumbnailUrl(item.original_image_url || item.illustration_url);

              return (
                <div
                  key={item.id}
                  data-id={item.id}
                  className={`onboarding-card snap-center shrink-0 cursor-pointer transition-all duration-300 ease-out`}
                  style={{
                    // Slightly larger than bottom carousel to be more prominent
                    width: '180px',
                    transform: isActive ? 'scale(1) translateY(-10px)' : 'scale(0.85) translateY(10px)',
                    opacity: isActive ? 1 : 0.6,
                    zIndex: isActive ? 10 : 0
                  }}
                  onClick={() => {
                    if (!isActive) {
                      setActiveItemId(item.id);
                    } else {
                      handleStart(item);
                    }
                  }}
                >
                  {/* Polaroid Frame */}
                  <div className={`
                    bg-[#F9F8F4] p-3 pb-12 shadow-[0_20px_40px_rgba(0,0,0,0.5)] rounded-sm relative
                    ${isActive ? 'ring-4 ring-white/20' : ''}
                  `}>
                    <div className="relative aspect-square w-full bg-[#E5E5E5] overflow-hidden shadow-[inset_0_2px_10px_rgba(0,0,0,0.05)]">
                      {thumbUrl ? (
                        <img
                          src={thumbUrl}
                          alt={landmarkName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-[#0a0a0e]/10">
                          <MapPin className="w-8 h-8 text-black/20" />
                        </div>
                      )}
                    </div>
                    {/* Label */}
                    <div className="absolute bottom-0 left-0 right-0 h-12 flex items-center justify-center px-2">
                      <span className="text-gray-800 font-serif italic text-sm text-center truncate">
                        {landmarkName}
                      </span>
                    </div>
                  </div>
                  
                  {/* CTA Button below active card */}
                  <div className={`absolute -bottom-14 left-0 right-0 flex justify-center transition-all duration-300 ${isActive ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'}`}>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStart(item);
                      }}
                      className="bg-white text-black px-6 py-2 rounded-full font-bold text-xs tracking-widest shadow-lg hover:scale-105 transition-transform"
                    >
                      {t({ es: "EXPLORAR", en: "EXPLORE" }, lang)}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          
          {/* Edge fades */}
          <div className="absolute left-0 top-0 bottom-0 w-[15vw] bg-gradient-to-r from-[#050510] to-transparent pointer-events-none" />
          <div className="absolute right-0 top-0 bottom-0 w-[15vw] bg-gradient-to-l from-[#050510] to-transparent pointer-events-none" />
        </div>
      </motion.div>
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


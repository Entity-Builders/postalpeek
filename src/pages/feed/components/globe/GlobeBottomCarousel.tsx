import React, { useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, Check } from "lucide-react";
import { FeedItem } from "../../../../components/Postcard";
import { useLang, t } from "../../../../utils/i18n";
import { cdnImage, WIDTHS } from "../../../../utils/imageUtils";

interface GlobeBottomCarouselProps {
  items: FeedItem[];
  activeItemId: string | null;
  onItemSelect: (item: FeedItem) => void;
  onItemClick: (item: FeedItem) => void;
}

export function GlobeBottomCarousel({
  items,
  activeItemId,
  onItemSelect,
  onItemClick,
}: GlobeBottomCarouselProps) {
  const lang = useLang();
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
  }, [activeItemId, items]);

  const handleScroll = () => {
    if (scrollingByCode.current) return;
    if (!scrollRef.current) return;

    const container = scrollRef.current;
    const containerCenter = container.scrollLeft + container.offsetWidth / 2;

    let closestItem: FeedItem | null = null;
    let closestDist = Infinity;

    const cards = container.querySelectorAll(".carousel-card");
    cards.forEach((cardEl) => {
      const card = cardEl as HTMLElement;
      const cardCenter = card.offsetLeft + card.offsetWidth / 2;
      const dist = Math.abs(containerCenter - cardCenter);

      if (dist < closestDist) {
        closestDist = dist;
        const id = card.getAttribute("data-id");
        closestItem = items.find((i) => i.id === id) || null;
      }
    });

    if (closestItem && closestItem.id !== activeItemId) {
      scrollingByCode.current = true;
      onItemSelect(closestItem);
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

  const getThumbnailUrl = (url: string) => {
    if (!url) return "";
    return cdnImage(url, { width: WIDTHS.albumCard });
  };

  // Get the landmark name without emoji
  const getLandmarkName = (label: string): string => {
    if (!label) return '';
    return label.replace(/^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F?)\s*/u, '').trim();
  };

  if (items.length === 0) return null;

  // Check if any card is owned (for first-unowned pulse logic)
  const hasAnyOwned = items.some((i) => i.owner_id !== null);
  const firstUnownedId = !hasAnyOwned
    ? items.find((i) => i.owner_id === null)?.id
    : null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 50 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        className="absolute bottom-6 left-0 right-0 z-[50] pointer-events-auto"
      >
        <div
          ref={scrollRef}
          onScroll={onScrollDebounced}
          className="flex gap-3 overflow-x-auto px-4 pb-4 pt-2 snap-x snap-mandatory hide-scrollbar"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {items.map((item) => {
            const isActive = item.id === activeItemId;
            const isOwned = item.owner_id !== null;
            const imgUrl = item.illustration_url || item.original_image_url || "";
            const thumbUrl = getThumbnailUrl(imgUrl);
            const slotLabel = (item as any).slot_label || t(item.city, lang) || '???';
            const landmarkName = getLandmarkName(slotLabel) || t(item.city, lang);
            const shouldPulse = item.id === firstUnownedId;

            return (
              <div
                key={item.id}
                data-id={item.id}
                className={`carousel-card snap-center shrink-0 w-28 md:w-36 ${shouldPulse ? "animate-pulse-subtle" : ""}`}
                onClick={() => {
                  onItemSelect(item);
                  onItemClick(item);
                }}
              >
                <div
                  className={`
                  relative h-36 md:h-40 bg-stone-900 rounded-2xl overflow-hidden cursor-pointer
                  transition-all duration-300 shadow-xl border
                  ${isActive ? "border-white/40 scale-100 ring-2 ring-white/20" : "border-white/10 scale-95 opacity-75"}
                `}
                >
                  {/* Illustration */}
                  {thumbUrl ? (
                    <img
                      src={thumbUrl}
                      alt={landmarkName}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-stone-800 to-stone-900 flex items-center justify-center">
                      <span className="text-3xl">📍</span>
                    </div>
                  )}

                  {/* Bottom gradient for text readability */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />

                  {/* Status badge — top-right */}
                  <div className="absolute top-1.5 right-1.5">
                    {isOwned ? (
                      <div className="w-5 h-5 rounded-full bg-emerald-500/90 flex items-center justify-center shadow-lg">
                        <Check className="w-3 h-3 text-white" strokeWidth={3} />
                      </div>
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-black/50 backdrop-blur-sm border border-white/20 flex items-center justify-center">
                        <Lock className="w-2.5 h-2.5 text-white/70" />
                      </div>
                    )}
                  </div>

                  {/* Landmark name */}
                  <div className="absolute bottom-2 left-2 right-2 flex flex-col">
                    <span className="font-bold text-[10px] md:text-xs text-white tracking-wide leading-tight line-clamp-2 drop-shadow-md">
                      {landmarkName}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Scroll hint — right edge fade */}
        <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-[#050510]/80 to-transparent pointer-events-none" />
      </motion.div>
    </AnimatePresence>
  );
}

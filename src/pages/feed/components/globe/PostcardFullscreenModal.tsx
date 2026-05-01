import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FeedItem } from "../../../../components/Postcard";
import { Heart, X, Camera, ChevronLeft, ChevronRight, Lock, MapPin } from "lucide-react";
import { useLang, t } from "../../../../utils/i18n";
import { useSwipeable } from "react-swipeable";
import { cdnImage, WIDTHS } from "../../../../utils/imageUtils";

interface PostcardFullscreenModalProps {
  isOpen: boolean;
  items: FeedItem[];
  activeItemId: string | null;
  onClose: () => void;
  onChangeActive: (item: FeedItem) => void;
  onCreateOwn: (item: FeedItem) => void;
  isFavorited: (id: string) => boolean;
  onToggleFavorite: (id: string) => void;
}

export function PostcardFullscreenModal({
  isOpen,
  items,
  activeItemId,
  onClose,
  onChangeActive,
  onCreateOwn,
  isFavorited,
  onToggleFavorite,
}: PostcardFullscreenModalProps) {
  const lang = useLang();

  // Local state to handle fast swiping without waiting for props
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (isOpen && activeItemId) {
      const idx = items.findIndex((item) => item.id === activeItemId);
      if (idx !== -1) {
        setCurrentIndex(idx);
      }
    }
  }, [isOpen, activeItemId, items]);

  const activeItem = items[currentIndex];

  const handleNext = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (currentIndex < items.length - 1) {
      const nextItem = items[currentIndex + 1];
      setCurrentIndex(currentIndex + 1);
      onChangeActive(nextItem);
    }
  };

  const handlePrev = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (currentIndex > 0) {
      const prevItem = items[currentIndex - 1];
      setCurrentIndex(currentIndex - 1);
      onChangeActive(prevItem);
    }
  };

  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => handleNext(),
    onSwipedRight: () => handlePrev(),
    preventScrollOnSwipe: true,
    trackMouse: false,
  });

  const getFullUrl = (url: string) => {
    if (!url) return "";
    return cdnImage(url, { width: WIDTHS.desktop, quality: 85 });
  };

  // Extract emoji from slot_label
  const getEmoji = (label: string): string => {
    if (!label) return '📍';
    const match = label.match(/^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F?)/u);
    return match ? match[0] : '📍';
  };

  const getLandmarkName = (label: string): string => {
    if (!label) return '';
    return label.replace(/^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F?)\s*/u, '').trim();
  };

  if (!activeItem) return null;

  const imgUrl =
    activeItem.illustration_url || activeItem.original_image_url || "";
  const fullImgUrl = getFullUrl(imgUrl);
  const isLocked = !activeItem.owner_id;
  const slotLabel = (activeItem as any).slot_label || '';
  const emoji = getEmoji(slotLabel);
  const landmarkName = getLandmarkName(slotLabel) || t(activeItem.city, lang);
  const paginationText = `${currentIndex + 1} / ${items.length}`;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[10000] bg-black/95 backdrop-blur-xl flex flex-col pointer-events-auto"
        >
          {/* Header */}
          <div className="flex justify-between items-center px-4 py-3 md:p-6 z-10">
            <div className="flex items-center gap-3">
              {/* Emoji avatar */}
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-xl">
                {emoji}
              </div>
              <div className="flex flex-col">
                <h2 className="text-white text-base font-bold tracking-tight leading-tight">
                  {landmarkName}
                </h2>
                <div className="flex items-center gap-1 text-white/50 text-xs">
                  <MapPin size={10} />
                  <span>{t(activeItem.city, lang)}, {t(activeItem.country, lang)}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Pagination */}
              <span className="text-white/30 text-xs font-mono">{paginationText}</span>
              <button
                onClick={onClose}
                className="p-2.5 bg-white/10 hover:bg-white/20 rounded-full transition-colors active:scale-95 cursor-pointer"
              >
                <X size={18} className="text-white" />
              </button>
            </div>
          </div>

          {/* Main Content Area (Swipable) */}
          <div
            {...swipeHandlers}
            className="flex-1 relative flex items-center justify-center overflow-hidden"
          >
            {/* Desktop Left Button */}
            <button
              onClick={handlePrev}
              disabled={currentIndex === 0}
              className="hidden md:flex absolute left-4 z-20 p-3 bg-black/40 hover:bg-black/60 rounded-full text-white disabled:opacity-20 transition-all cursor-pointer"
            >
              <ChevronLeft size={24} />
            </button>

            {/* The Image */}
            <motion.div
              key={activeItem.id}
              initial={{ opacity: 0, scale: 0.95, x: 20 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.95, x: -20 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="w-full max-w-2xl px-4 md:px-0 h-full max-h-[70vh] flex items-center justify-center"
            >
              <div
                className={`relative w-full h-full rounded-2xl overflow-hidden shadow-2xl bg-[#111] ${
                  isLocked ? "border border-white/[0.06]" : "border border-white/10"
                }`}
              >
                {isLocked ? (
                  /* ── LOCKED STATE: System postcard preview + mystery overlay ── */
                  <>
                    {/* Background: system postcard with heavy blur */}
                    {fullImgUrl ? (
                      <img
                        src={fullImgUrl}
                        alt=""
                        className="absolute inset-0 w-full h-full object-cover blur-[6px] scale-105 brightness-[0.4]"
                      />
                    ) : (
                      <div className="absolute inset-0 bg-gradient-to-br from-[#1a1a2e] to-[#0a0a14]" />
                    )}

                    {/* Gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-black/50" />

                    {/* Center content */}
                    <div className="relative h-full flex flex-col items-center justify-center gap-4 px-6">
                      {/* Big emoji */}
                      <span className="text-5xl drop-shadow-xl">{emoji}</span>

                      {/* Lock badge */}
                      <div className="w-14 h-14 rounded-full bg-white/[0.08] border border-white/10 flex items-center justify-center backdrop-blur-sm">
                        <Lock size={22} className="text-white/40" />
                      </div>

                      {/* Text */}
                      <div className="flex flex-col items-center gap-1.5 text-center">
                        <p className="text-white/80 font-bold text-lg tracking-tight">
                          {landmarkName}
                        </p>
                        <p className="text-white/40 text-sm max-w-[240px] leading-relaxed">
                          {t(
                            {
                              es: 'Viaja a este lugar y captura tu propia postal para desbloquear',
                              en: 'Travel to this location and capture your own postcard to unlock',
                            },
                            lang,
                          )}
                        </p>
                      </div>
                    </div>
                  </>
                ) : (
                  /* ── OWNED STATE: Full quality postcard ── */
                  <>
                    <img
                      src={fullImgUrl}
                      alt={landmarkName}
                      className="w-full h-full object-contain transition-all duration-300"
                    />

                    {/* Category badge */}
                    {t(activeItem.category) && (
                      <div className="absolute top-3 left-3 px-2.5 py-1 bg-black/60 backdrop-blur-md text-white/90 text-xs font-medium rounded-full border border-white/10 shadow-lg">
                        {t(activeItem.category)}
                      </div>
                    )}

                    {/* Collected badge */}
                    <div className="absolute top-3 right-3 px-2.5 py-1 bg-emerald-500/20 backdrop-blur-md rounded-full border border-emerald-400/30 flex items-center gap-1">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                      <span className="text-emerald-400 text-[10px] font-bold uppercase tracking-wider">
                        {t({ es: 'Coleccionada', en: 'Collected' }, lang)}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </motion.div>

            {/* Desktop Right Button */}
            <button
              onClick={handleNext}
              disabled={currentIndex === items.length - 1}
              className="hidden md:flex absolute right-4 z-20 p-3 bg-black/40 hover:bg-black/60 rounded-full text-white disabled:opacity-20 transition-all cursor-pointer"
            >
              <ChevronRight size={24} />
            </button>
          </div>

          {/* Footer Actions */}
          <div className="px-4 pb-6 pt-3 md:px-8 flex items-center gap-3">
            {isLocked ? (
              /* ── LOCKED CTA ── */
              <button
                onClick={() => onCreateOwn(activeItem)}
                className="flex-1 py-3.5 bg-gradient-to-r from-fuchsia-500 to-cyan-500 hover:opacity-90 active:scale-[0.98] text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-fuchsia-500/20 cursor-pointer"
              >
                <Camera size={18} />
                {t(
                  { es: '📸 Capturar tu postal', en: '📸 Capture your postcard' },
                  lang,
                )}
              </button>
            ) : (
              /* ── OWNED CTAs ── */
              <>
                <button
                  onClick={() => onCreateOwn(activeItem)}
                  className="flex-1 py-3.5 bg-white/10 hover:bg-white/15 active:scale-[0.98] text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-all border border-white/10 cursor-pointer"
                >
                  <Camera size={16} />
                  {t({ es: 'Crear otra', en: 'Create another' }, lang)}
                </button>
                <button
                  onClick={() => onToggleFavorite(activeItem.id)}
                  className="p-3.5 bg-white/10 hover:bg-white/15 active:scale-95 rounded-xl transition-all cursor-pointer"
                >
                  <Heart
                    size={20}
                    className={
                      isFavorited(activeItem.id)
                        ? "fill-emerald-400 text-emerald-400"
                        : "text-white/80"
                    }
                  />
                </button>
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

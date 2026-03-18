import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Info, ChevronLeft, ChevronRight } from 'lucide-react';
import useEmblaCarousel from 'embla-carousel-react';
import { useSignedImage } from '../utils/useSignedImage';
import { WIDTHS } from '../utils/imageUtils';
import type { FeedItem } from './Postcard';
import { analytics } from '../lib/analytics';

interface ImageLightboxProps {
  items: FeedItem[];
  initialIndex: number;
  sourceRect?: DOMRect;
  onClose: () => void;
  onOpenDetail: (item: FeedItem) => void;
}

/* ── Slide with progressive loading ── */

function LightboxSlide({
  item,
  isActive,
}: {
  item: FeedItem;
  isActive: boolean;
}) {
  const mobileUrl = useSignedImage(item.illustration_url, { width: WIDTHS.mobile });
  const desktopUrl = useSignedImage(item.illustration_url, { width: WIDTHS.desktop });
  const [hiResReady, setHiResReady] = useState(false);

  return (
    <div className="embla__slide flex-[0_0_100%] min-w-0 h-full relative">
      {mobileUrl && (
        <img
          src={mobileUrl}
          alt={item.city}
          className="absolute inset-0 w-full h-full object-contain select-none"
          draggable={false}
          style={{ opacity: hiResReady ? 0 : 1, transition: 'opacity 0.3s ease' }}
        />
      )}
      {isActive && desktopUrl && (
        <img
          src={desktopUrl}
          alt={item.city}
          className="absolute inset-0 w-full h-full object-contain select-none"
          draggable={false}
          style={{ opacity: hiResReady ? 1 : 0, transition: 'opacity 0.4s ease' }}
          onLoad={() => setHiResReady(true)}
        />
      )}
    </div>
  );
}

/* ── Main component ── */

export function ImageLightbox({
  items,
  initialIndex,
  onClose,
  onOpenDetail,
}: ImageLightboxProps) {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    startIndex: initialIndex,
    loop: false,
    dragFree: false,
  });
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  useEffect(() => {
    analytics.track('image_lightbox_opened', {
      postcard_id: items[initialIndex]?.id,
      country: items[initialIndex]?.country,
      city: items[initialIndex]?.city,
      total_items: items.length,
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setCurrentIndex(emblaApi.selectedScrollSnap());
    emblaApi.on('select', onSelect);
    return () => { emblaApi.off('select', onSelect); };
  }, [emblaApi]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') emblaApi?.scrollPrev();
      if (e.key === 'ArrowRight') emblaApi?.scrollNext();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [emblaApi, onClose]);

  const activeItem = items[currentIndex];
  const canPrev = currentIndex > 0;
  const canNext = currentIndex < items.length - 1;
  const isSingle = items.length === 1;

  return (
    <motion.div
      key="lightbox"
      className="fixed inset-0 z-[250] flex flex-col"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' as const }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black" />

      {/* Top controls */}
      <motion.div
        className="shrink-0 flex items-center justify-between px-4 pt-4 pb-2 z-20 absolute top-0 left-0 right-0"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, delay: 0.1 }}
      >
        <button
          onClick={onClose}
          className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-all active:scale-90 backdrop-blur-sm"
        >
          <X className="w-5 h-5" />
        </button>

        {!isSingle && (
          <span className="text-white/30 text-xs font-mono tabular-nums">
            {currentIndex + 1} / {items.length}
          </span>
        )}

        {!isSingle ? (
          <button
            onClick={() => onOpenDetail(activeItem)}
            className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-all active:scale-90 backdrop-blur-sm"
          >
            <Info className="w-5 h-5" />
          </button>
        ) : (
          <div className="w-10" />
        )}
      </motion.div>

      {/* Image carousel */}
      <motion.div
        className="flex-1 min-h-0 overflow-hidden z-10"
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{
          type: 'spring' as const,
          stiffness: 400,
          damping: 30,
          mass: 0.6,
          opacity: { duration: 0.15 },
        }}
      >
        <div
          className="w-full h-full"
          ref={emblaRef}
          onClick={isSingle ? onClose : undefined}
        >
          <div className="embla__container flex h-full">
            {items.map((item, idx) => (
              <LightboxSlide
                key={item.id}
                item={item}
                isActive={Math.abs(idx - currentIndex) <= 1}
              />
            ))}
          </div>
        </div>
      </motion.div>

      {/* Desktop nav arrows */}
      {!isSingle && (
        <div className="hidden md:block">
          {canPrev && (
            <button
              onClick={() => emblaApi?.scrollPrev()}
              className="absolute left-3 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white/60 hover:text-white transition-all active:scale-90 backdrop-blur-sm"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}
          {canNext && (
            <button
              onClick={() => emblaApi?.scrollNext()}
              className="absolute right-3 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white/60 hover:text-white transition-all active:scale-90 backdrop-blur-sm"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          )}
        </div>
      )}

      {/* Bottom info */}
      <motion.div
        className="shrink-0 text-center pb-6 pt-3 z-20 absolute bottom-0 left-0 right-0 pointer-events-none"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, delay: 0.1 }}
      >
        <div className="bg-gradient-to-t from-black/70 via-black/30 to-transparent absolute inset-0" />
        <AnimatePresence mode="wait">
          <motion.p
            key={activeItem.id}
            className="text-white/50 text-sm relative"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2, ease: 'easeOut' as const }}
          >
            {activeItem.city}, {activeItem.country}
          </motion.p>
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}

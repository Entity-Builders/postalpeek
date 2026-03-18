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
  onClose: () => void;
  onOpenDetail: (item: FeedItem) => void;
}

/* ── Single slide with progressive loading ── */

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

  // Only load hi-res for active slide
  const shouldLoadHiRes = isActive;

  return (
    <div className="embla__slide flex-[0_0_100%] min-w-0 h-full relative">
      {/* Low-res (cached from grid) */}
      {mobileUrl && (
        <img
          src={mobileUrl}
          alt={item.city}
          className="absolute inset-0 w-full h-full object-contain select-none"
          draggable={false}
          style={{ opacity: hiResReady ? 0 : 1, transition: 'opacity 0.3s ease' }}
        />
      )}

      {/* Hi-res — loads in background, fades in */}
      {shouldLoadHiRes && desktopUrl && (
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

/* ── Main gallery component ── */

export function ImageLightbox({ items, initialIndex, onClose, onOpenDetail }: ImageLightboxProps) {
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

  // Keyboard navigation
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

  return (
    <motion.div
      className="fixed inset-0 z-[250] bg-black flex flex-col"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      {/* Top bar */}
      <div className="shrink-0 flex items-center justify-between px-4 pt-4 pb-2 z-20 absolute top-0 left-0 right-0">
        <button
          onClick={onClose}
          className="p-2.5 rounded-full bg-black/40 hover:bg-black/60 text-white/80 hover:text-white transition-colors backdrop-blur-sm"
        >
          <X className="w-5 h-5" />
        </button>

        <span className="text-white/40 text-xs font-mono tabular-nums">
          {currentIndex + 1} / {items.length}
        </span>

        <button
          onClick={() => onOpenDetail(activeItem)}
          className="p-2.5 rounded-full bg-black/40 hover:bg-black/60 text-white/80 hover:text-white transition-colors backdrop-blur-sm"
        >
          <Info className="w-5 h-5" />
        </button>
      </div>

      {/* Carousel — full-bleed */}
      <div className="flex-1 min-h-0 overflow-hidden" ref={emblaRef}>
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

      {/* Desktop nav arrows */}
      <div className="hidden md:block">
        {canPrev && (
          <button
            onClick={() => emblaApi?.scrollPrev()}
            className="absolute left-3 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-black/40 hover:bg-black/60 text-white/70 hover:text-white transition-colors backdrop-blur-sm"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}
        {canNext && (
          <button
            onClick={() => emblaApi?.scrollNext()}
            className="absolute right-3 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-black/40 hover:bg-black/60 text-white/70 hover:text-white transition-colors backdrop-blur-sm"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        )}
      </div>

      {/* Bottom info */}
      <div className="shrink-0 text-center pb-5 pt-2 z-20 absolute bottom-0 left-0 right-0 pointer-events-none bg-gradient-to-t from-black/60 via-black/20 to-transparent">
        <AnimatePresence mode="wait">
          <motion.p
            key={activeItem.id}
            className="text-white/60 text-sm"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
          >
            {activeItem.city}, {activeItem.country}
          </motion.p>
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

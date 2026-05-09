import React, { useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Minimize2 } from 'lucide-react';
import { cn } from '../utils/cn';
import { WIDTHS, cdnImage } from '../utils/imageUtils';
import { t } from '../utils/i18n';
import type { FeedItem } from './Postcard';
import { AmbientBackground } from './ui/AmbientBackground';

interface FullscreenOverlayProps {
  item: FeedItem;
  /** The card's image URL — already in the browser cache */
  cachedUrl: string;
  onClose: () => void;
}

/** Zoom level inside the loupe circle */
const LOUPE_ZOOM = 2.5;
/** Radius of the visible loupe circle in px */
const LOUPE_RADIUS = 60;

export function FullscreenOverlay({ item, cachedUrl, onClose }: FullscreenOverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLImageElement>(null);
  const lensRef = useRef<HTMLImageElement>(null);

  const ambientUrl = cdnImage(item.illustration_url, {
    width: WIDTHS.blur,
    quality: 50,
  });

  // ── ESC to close (tap handled by onClick) ──
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    window.dispatchEvent(new CustomEvent('postalpeek:fullscreen', { detail: true }));
    return () => {
      window.removeEventListener('keydown', handleKey);
      window.dispatchEvent(new CustomEvent('postalpeek:fullscreen', { detail: false }));
    };
  }, [onClose]);

  return (
    <motion.div
      className="fixed inset-0 z-[200] flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      ref={containerRef}
      onClick={onClose}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Ambient background */}
      <AmbientBackground imageUrl={ambientUrl} />

      {/* Dark scrim */}
      <div
        className="absolute inset-0 z-[1]"
        style={{ background: 'rgba(0,0,0,0.5)' }}
      />

      {/* Hero image — shared element transition via layoutId */}
      <motion.img
        ref={heroRef}
        layoutId={`pp-hero-${item.id}`}
        src={cachedUrl}
        alt={t(item.category)}
        draggable={false}
        className="relative z-[2] select-none"
        style={{
          maxWidth: '100%',
          maxHeight: '100%',
          objectFit: 'contain',
          userSelect: 'none',
          WebkitUserSelect: 'none',
        }}
        onClick={(e) => e.stopPropagation()} // don't close when clicking image
        transition={{
          type: 'spring',
          stiffness: 300,
          damping: 30,
          mass: 0.8,
        }}
      />

      {/* Close button */}
      <motion.button
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className={cn(
          'fixed bottom-5 right-5 z-[10] flex items-center gap-2',
          'px-4 py-2.5 rounded-full',
          'bg-black/40 backdrop-blur-md',
          'text-white/80 hover:text-white',
          'text-xs font-semibold',
          'border border-white/15',
          'hover:bg-black/60 transition-all',
          'shadow-lg cursor-pointer',
        )}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.25 }}
      >
        <Minimize2 className="w-3.5 h-3.5" />
        {t({ es: 'Volver', en: 'Back' })}
      </motion.button>
    </motion.div>
  );
}

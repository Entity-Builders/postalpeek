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

  // ── Loupe helpers ──
  const updateLens = useCallback((clientX: number, clientY: number) => {
    const hero = heroRef.current;
    const lens = lensRef.current;
    if (!hero || !lens) return;

    const rect = hero.getBoundingClientRect();

    // Cursor position relative to the image element (0 to 1)
    const rx = (clientX - rect.left) / rect.width;
    const ry = (clientY - rect.top) / rect.height;

    // Ignore if cursor is outside the image bounds
    if (rx < 0 || rx > 1 || ry < 0 || ry > 1) {
      lens.style.opacity = '0';
      return;
    }

    const px = rx * 100;
    const py = ry * 100;

    // Position lens: the lens is the same size as the hero, scaled up by LOUPE_ZOOM
    // We translate it so the point at (px%, py%) lands under the cursor
    const ox = rx * rect.width;
    const oy = ry * rect.height;
    const tx = (clientX - rect.left) - ox * LOUPE_ZOOM;
    const ty = (clientY - rect.top) - oy * LOUPE_ZOOM;

    lens.style.opacity = '1';
    lens.style.width = `${rect.width}px`;
    lens.style.height = `${rect.height}px`;
    lens.style.left = `${rect.left}px`;
    lens.style.top = `${rect.top}px`;
    lens.style.clipPath = `circle(${LOUPE_RADIUS}px at ${clientX - rect.left}px ${clientY - rect.top}px)`;
    lens.style.transform = `translate(${tx}px, ${ty}px) scale(${LOUPE_ZOOM})`;
    lens.style.transformOrigin = '0 0';
  }, []);

  const hideLens = useCallback(() => {
    if (lensRef.current) {
      lensRef.current.style.opacity = '0';
    }
  }, []);

  // ── Desktop: mouse move ──
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    updateLens(e.clientX, e.clientY);
  }, [updateLens]);

  // ── Mobile: touch-hold ──
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      e.preventDefault(); // prevent scroll
      updateLens(e.touches[0].clientX, e.touches[0].clientY);
    }
  }, [updateLens]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    if (e.touches.length === 1) {
      updateLens(e.touches[0].clientX, e.touches[0].clientY);
    }
  }, [updateLens]);

  return (
    <motion.div
      className="fixed inset-0 z-[200] flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      ref={containerRef}
      onClick={onClose}
      onMouseMove={handleMouseMove}
      onMouseLeave={hideLens}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={hideLens}
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
          cursor: 'crosshair',
        }}
        onClick={(e) => e.stopPropagation()} // don't close when clicking image
        transition={{
          type: 'spring',
          stiffness: 300,
          damping: 30,
          mass: 0.8,
        }}
      />

      {/* Loupe lens — same image, zoomed, clipped to circle around cursor */}
      <img
        ref={lensRef}
        src={cachedUrl}
        alt=""
        draggable={false}
        className="fixed z-[5] pointer-events-none select-none will-change-transform"
        style={{
          opacity: 0,
          transition: 'opacity 0.15s ease-out',
          objectFit: 'contain',
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

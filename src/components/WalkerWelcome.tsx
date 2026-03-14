import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import type { FeedItem } from './Postcard';
import { WIDTHS } from '../utils/imageUtils';
import { useSignedImage, useSignedSrcSet } from '../utils/useSignedImage';

interface WalkerWelcomeProps {
  /** First postcards from the feed to display as stacked preview */
  previewCards: FeedItem[];
}

/**
 * Reliable image-loaded detection using `new Image()`.
 * Handles both cold loads and browser cache hits (`img.complete`).
 */
function useImageLoaded(src: string): boolean {
  const [loaded, setLoaded] = useState(false);

  React.useEffect(() => {
    if (!src) {
      setLoaded(false);
      return;
    }

    const img = new Image();
    img.src = src;

    // Already cached by the browser — mark as loaded immediately
    if (img.complete) {
      setLoaded(true);
      return;
    }

    img.onload = () => setLoaded(true);
    img.onerror = () => setLoaded(true); // Don't block forever on error

    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [src]);

  return loaded;
}

/**
 * First-visit onboarding slide introducing "Kyle Walker".
 *
 * Cinematic reveal:
 * 1. Text content renders INSTANTLY — zero delay.
 * 2. Postcards load in background via signed Cloudflare URLs.
 * 3. Once the hero image is in the browser cache, the entire
 *    postcard stack fades + zooms in via framer-motion.
 */
export function WalkerWelcome({ previewCards }: WalkerWelcomeProps) {
  const cards = previewCards.slice(0, 3);

  // Deterministic hook calls (always 3 — pass undefined for missing cards)
  const imgUrl2 = useSignedImage(cards[2]?.illustration_url, { width: WIDTHS.thumb });
  const srcSet2 = useSignedSrcSet(cards[2]?.illustration_url, [WIDTHS.thumb]);

  const imgUrl1 = useSignedImage(cards[1]?.illustration_url, { width: WIDTHS.thumb });
  const srcSet1 = useSignedSrcSet(cards[1]?.illustration_url, [WIDTHS.thumb]);

  const imgUrl0 = useSignedImage(cards[0]?.illustration_url, { width: WIDTHS.thumb });
  const srcSet0 = useSignedSrcSet(cards[0]?.illustration_url, [WIDTHS.thumb]);

  // Programmatic image load detection — reliable for cached & fresh images
  const heroLoaded = useImageLoaded(imgUrl0);

  return (
    <div className="w-full h-full flex flex-col items-center justify-between px-6 py-10 select-none overflow-hidden">
      {/* ─── Top spacer (push content down from notch area) ─── */}
      <div className="flex-shrink-0 h-4 sm:h-8" />

      {/* ─── Main Content ─── */}
      <div className="flex flex-col items-center justify-center flex-1 min-h-0">
        {/* ─── Stacked Postcards — animated in by framer-motion ─── */}
        {cards.length > 0 && (
          <motion.div
            className="relative w-[120px] h-[140px] sm:w-[190px] sm:h-[210px] mb-4 sm:mb-8 flex-shrink-0"
            initial={{ opacity: 0, scale: 0.88, y: 16 }}
            animate={heroLoaded
              ? { opacity: 0.8, scale: 1, y: 0 }
              : { opacity: 0, scale: 0.88, y: 16 }
            }
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* Card 3 (back) */}
            {cards[2] && (
              <div className="absolute inset-0 bg-white p-1.5 rounded-sm shadow-md rotate-[7deg] translate-x-3 -translate-y-1 opacity-40">
                <div className="w-full h-full overflow-hidden rounded-[2px] bg-stone-100">
                  <img
                    src={imgUrl2}
                    srcSet={srcSet2}
                    alt=""
                    className="w-full h-full object-cover"
                    loading="eager"
                  />
                </div>
              </div>
            )}
            {/* Card 2 (middle) */}
            {cards[1] && (
              <div className="absolute inset-0 bg-white p-1.5 rounded-sm shadow-md -rotate-[5deg] -translate-x-3 translate-y-1 opacity-60">
                <div className="w-full h-full overflow-hidden rounded-[2px] bg-stone-100">
                  <img
                    src={imgUrl1}
                    srcSet={srcSet1}
                    alt=""
                    className="w-full h-full object-cover"
                    loading="eager"
                  />
                </div>
              </div>
            )}
            {/* Card 1 (front — hero) */}
            {cards[0] && (
              <div className="absolute inset-0 bg-white p-1.5 pb-6 rounded-sm shadow-xl -rotate-[1.5deg]">
                <div className="w-full h-[calc(100%-18px)] overflow-hidden rounded-[2px] bg-stone-100">
                  <img
                    src={imgUrl0}
                    srcSet={srcSet0}
                    alt={cards[0].category}
                    className="w-full h-full object-cover"
                    loading="eager"
                  />
                </div>
                <p className="text-center font-handwriting text-[9px] text-stone-500 mt-1 truncate px-1">
                  {cards[0].city}, {cards[0].country}
                </p>
              </div>
            )}

            {/* Postmark stamp */}
            <div className="absolute -top-2 -right-2 w-10 h-10 rounded-full border-2 border-stone-500/30 flex items-center justify-center rotate-12 pointer-events-none z-20">
              <div className="w-8 h-8 rounded-full border border-dashed border-stone-500/40 flex items-center justify-center bg-white/30 backdrop-blur-sm">
                <span className="font-mono text-[5px] text-stone-600 uppercase tracking-wider text-center leading-tight">
                  Postal
                  <br />
                  Peek
                </span>
              </div>
            </div>
          </motion.div>
        )}

        {/* ─── Walker Introduction (renders INSTANTLY) ─── */}
        <p className="text-stone-500 text-[10px] sm:text-[11px] font-mono tracking-[0.3em] uppercase mb-3 sm:mb-5 text-center">
          Entity Builders presents
        </p>
        <h1
          className="font-serif text-4xl sm:text-6xl text-stone-900 tracking-tight mb-2 sm:mb-3 text-center"
          style={{ textShadow: '0 1px 8px rgba(255,255,255,0.5)' }}
        >
          Kyle Walker
        </h1>
        <p className="text-stone-600 text-sm sm:text-base tracking-wide mb-4 sm:mb-8 font-medium text-center">
          Digital Agent · Photographer · Watercolor Artist
        </p>
        <p className="text-stone-700 text-base sm:text-xl text-center leading-relaxed max-w-[400px] mb-6 sm:mb-10 px-2">
          I travel the world and paint what I see.
          <br />
          Every street, every café, every hidden corner
          <br />
          becomes a watercolor postcard.
        </p>

        <div className="w-20 h-px bg-stone-400/60 mb-4 sm:mb-8" />

        <p className="text-stone-600 text-base sm:text-lg font-light italic font-serif text-center">
          These postcards are for you.
        </p>
      </div>

      {/* ─── Scroll Hint (in flow, not overlapping) ─── */}
      <div className="flex-shrink-0 flex flex-col items-center gap-1 sm:gap-2 text-stone-500 animate-bounce pt-4 pb-2">
        <ChevronDown className="w-5 h-5" />
        <span className="text-xs tracking-[0.2em] uppercase font-semibold">
          Scroll to explore
        </span>
      </div>
    </div>
  );
}

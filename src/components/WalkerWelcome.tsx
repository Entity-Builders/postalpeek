import React from 'react';
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
 */
function useImageLoaded(src: string): boolean {
  const [loaded, setLoaded] = React.useState(false);

  React.useEffect(() => {
    if (!src) { setLoaded(false); return; }
    const img = new Image();
    img.src = src;
    if (img.complete) { setLoaded(true); return; }
    img.onload = () => setLoaded(true);
    img.onerror = () => setLoaded(true);
    return () => { img.onload = null; img.onerror = null; };
  }, [src]);

  return loaded;
}

/* ─── Animation constants ─── */
const ease = [0.22, 1, 0.36, 1] as const;

/**
 * Cinematic opening:
 * 1. Postcards appear BIG and centered (hero moment)
 * 2. After 1.2s they shrink into their final position
 * 3. Text elements fade in one by one with generous spacing
 * 4. Scroll hint appears last
 */
export function WalkerWelcome({ previewCards }: WalkerWelcomeProps) {
  const cards = previewCards.slice(0, 3);

  const imgUrl2 = useSignedImage(cards[2]?.illustration_url, { width: WIDTHS.thumb });
  const srcSet2 = useSignedSrcSet(cards[2]?.illustration_url, [WIDTHS.thumb]);
  const imgUrl1 = useSignedImage(cards[1]?.illustration_url, { width: WIDTHS.thumb });
  const srcSet1 = useSignedSrcSet(cards[1]?.illustration_url, [WIDTHS.thumb]);
  const imgUrl0 = useSignedImage(cards[0]?.illustration_url, { width: WIDTHS.thumb });
  const srcSet0 = useSignedSrcSet(cards[0]?.illustration_url, [WIDTHS.thumb]);

  const heroLoaded = useImageLoaded(imgUrl0);

  return (
    <div className="w-full h-full flex flex-col items-center justify-between px-6 py-10 select-none overflow-hidden">
      <div className="flex-shrink-0 h-4 sm:h-8" />

      <div className="flex flex-col items-center justify-center flex-1 min-h-0">

        {/* ─── ACT 1: Postcards — appear big, then shrink ─── */}
        {cards.length > 0 && (
          <motion.div
            className="relative w-[120px] h-[140px] sm:w-[190px] sm:h-[210px] mb-6 sm:mb-10 flex-shrink-0"
            initial={{ opacity: 0, scale: 2.8, y: 60 }}
            animate={heroLoaded
              ? { opacity: 0.85, scale: 1, y: 0 }
              : { opacity: 0, scale: 2.8, y: 60 }
            }
            transition={{ duration: 1.4, ease, delay: 0.1 }}
          >
            {cards[2] && (
              <div className="absolute inset-0 bg-white p-1.5 rounded-sm shadow-md rotate-[7deg] translate-x-3 -translate-y-1 opacity-40">
                <div className="w-full h-full overflow-hidden rounded-[2px] bg-stone-100">
                  <img src={imgUrl2} srcSet={srcSet2} alt="" className="w-full h-full object-cover" loading="eager" />
                </div>
              </div>
            )}
            {cards[1] && (
              <div className="absolute inset-0 bg-white p-1.5 rounded-sm shadow-md -rotate-[5deg] -translate-x-3 translate-y-1 opacity-60">
                <div className="w-full h-full overflow-hidden rounded-[2px] bg-stone-100">
                  <img src={imgUrl1} srcSet={srcSet1} alt="" className="w-full h-full object-cover" loading="eager" />
                </div>
              </div>
            )}
            {cards[0] && (
              <div className="absolute inset-0 bg-white p-1.5 pb-6 rounded-sm shadow-xl -rotate-[1.5deg]">
                <div className="w-full h-[calc(100%-18px)] overflow-hidden rounded-[2px] bg-stone-100">
                  <img src={imgUrl0} srcSet={srcSet0} alt={cards[0].category} className="w-full h-full object-cover" loading="eager" />
                </div>
                <p className="text-center font-handwriting text-[9px] text-stone-500 mt-1 truncate px-1">
                  {cards[0].city}, {cards[0].country}
                </p>
              </div>
            )}
            <div className="absolute -top-2 -right-2 w-10 h-10 rounded-full border-2 border-stone-500/30 flex items-center justify-center rotate-12 pointer-events-none z-20">
              <div className="w-8 h-8 rounded-full border border-dashed border-stone-500/40 flex items-center justify-center bg-white/30 backdrop-blur-sm">
                <span className="font-mono text-[5px] text-stone-600 uppercase tracking-wider text-center leading-tight">
                  Postal<br />Peek
                </span>
              </div>
            </div>
          </motion.div>
        )}

        {/* ─── ACT 2: Text — each element gets its moment ─── */}
        <motion.p
          className="text-stone-500 text-[10px] sm:text-[11px] font-mono tracking-[0.3em] uppercase mb-3 sm:mb-5 text-center"
          initial={{ opacity: 0, y: 12 }}
          animate={heroLoaded ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, ease, delay: 1.4 }}
        >
          Entity Builders presents
        </motion.p>

        <motion.h1
          className="font-serif text-4xl sm:text-6xl text-stone-900 tracking-tight mb-2 sm:mb-3 text-center"
          style={{ textShadow: '0 1px 8px rgba(255,255,255,0.5)' }}
          initial={{ opacity: 0, y: 16, scale: 0.95 }}
          animate={heroLoaded ? { opacity: 1, y: 0, scale: 1 } : {}}
          transition={{ duration: 0.9, ease, delay: 1.8 }}
        >
          Kyle Walker
        </motion.h1>

        <motion.p
          className="text-stone-600 text-sm sm:text-base tracking-wide mb-4 sm:mb-8 font-medium text-center"
          initial={{ opacity: 0, y: 10 }}
          animate={heroLoaded ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, ease, delay: 2.3 }}
        >
          Digital Agent · Photographer · Watercolor Artist
        </motion.p>

        <motion.p
          className="text-stone-700 text-base sm:text-xl text-center leading-relaxed max-w-[400px] mb-6 sm:mb-10 px-2"
          initial={{ opacity: 0, y: 10 }}
          animate={heroLoaded ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, ease, delay: 2.9 }}
        >
          I travel the world and paint what I see.
          <br />
          Every street, every café, every hidden corner
          <br />
          becomes a watercolor postcard.
        </motion.p>

        <motion.div
          className="w-20 h-px bg-stone-400/60 mb-4 sm:mb-8"
          initial={{ opacity: 0, scaleX: 0 }}
          animate={heroLoaded ? { opacity: 1, scaleX: 1 } : {}}
          transition={{ duration: 0.6, ease, delay: 3.4 }}
        />

        <motion.p
          className="text-stone-600 text-base sm:text-lg font-light italic font-serif text-center"
          initial={{ opacity: 0, y: 10 }}
          animate={heroLoaded ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, ease, delay: 3.7 }}
        >
          These postcards are for you.
        </motion.p>
      </div>

      {/* ─── ACT 3: Scroll hint — the finale ─── */}
      <motion.div
        className="flex-shrink-0 flex flex-col items-center gap-1 sm:gap-2 text-stone-500 animate-bounce pt-4 pb-2"
        initial={{ opacity: 0 }}
        animate={heroLoaded ? { opacity: 1 } : {}}
        transition={{ delay: 4.2, duration: 0.8 }}
      >
        <ChevronDown className="w-5 h-5" />
        <span className="text-xs tracking-[0.2em] uppercase font-semibold">
          Scroll to explore
        </span>
      </motion.div>
    </div>
  );
}

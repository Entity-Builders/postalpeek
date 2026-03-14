import React from 'react';
import { motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import type { FeedItem } from './Postcard';
import { WIDTHS } from '../utils/imageUtils';
import { useSignedImage, useSignedSrcSet } from '../utils/useSignedImage';
import { useWelcomeAnimation } from '../utils/useWelcomeAnimation';

interface WalkerWelcomeProps {
  previewCards: FeedItem[];
}

/**
 * First-visit cinematic welcome screen.
 *
 * Layout: Postcards are absolutely positioned at the top of the screen
 * and drop in from above — they never push the text down. Text is centered
 * in the full height, starting from frame 0.
 */
export function WalkerWelcome({ previewCards }: WalkerWelcomeProps) {
  const cards = previewCards.slice(0, 3);

  // Image URLs (deterministic — always 3 hook calls)
  const imgUrl2 = useSignedImage(cards[2]?.illustration_url, { width: WIDTHS.thumb });
  const srcSet2 = useSignedSrcSet(cards[2]?.illustration_url, [WIDTHS.thumb]);
  const imgUrl1 = useSignedImage(cards[1]?.illustration_url, { width: WIDTHS.thumb });
  const srcSet1 = useSignedSrcSet(cards[1]?.illustration_url, [WIDTHS.thumb]);
  const imgUrl0 = useSignedImage(cards[0]?.illustration_url, { width: WIDTHS.thumb });
  const srcSet0 = useSignedSrcSet(cards[0]?.illustration_url, [WIDTHS.thumb]);

  const anim = useWelcomeAnimation(imgUrl0);

  return (
    <div className="w-full h-full flex flex-col items-center justify-center relative select-none overflow-hidden px-6">

      {/* ─── Postcards: absolutely positioned, drops from above ─── */}
      <motion.div
        className="absolute top-[4%] sm:top-[6%] left-1/2 -translate-x-1/2 w-[60vw] h-[35dvh] sm:w-[320px] sm:h-[380px] z-10"
        {...anim.postcards}
      >
        {/* Card 3 (back) — continuous sway */}
        {cards[2] && (
          <motion.div
            className="absolute inset-0 bg-white p-1.5 rounded-sm shadow-md opacity-40"
            {...anim.sway.back}
          >
            <div className="w-full h-full overflow-hidden rounded-[2px] bg-stone-100">
              <img src={imgUrl2} srcSet={srcSet2} alt="" className="w-full h-full object-cover" loading="eager" />
            </div>
          </motion.div>
        )}

        {/* Card 2 (middle) — continuous sway */}
        {cards[1] && (
          <motion.div
            className="absolute inset-0 bg-white p-1.5 rounded-sm shadow-md opacity-60"
            {...anim.sway.middle}
          >
            <div className="w-full h-full overflow-hidden rounded-[2px] bg-stone-100">
              <img src={imgUrl1} srcSet={srcSet1} alt="" className="w-full h-full object-cover" loading="eager" />
            </div>
          </motion.div>
        )}

        {/* Card 1 (front — hero, static) */}
        {cards[0] && (
          <div className="absolute inset-0 bg-white p-1.5 pb-6 rounded-sm shadow-xl -rotate-[1.5deg]">
            <div className="w-full h-[calc(100%-20px)] overflow-hidden rounded-[2px] bg-stone-100">
              <img src={imgUrl0} srcSet={srcSet0} alt={cards[0].category} className="w-full h-full object-cover" loading="eager" />
            </div>
            <p className="text-center font-handwriting text-[10px] sm:text-xs text-stone-500 mt-1 truncate px-1">
              {cards[0].city}, {cards[0].country}
            </p>
          </div>
        )}

        {/* Postmark stamp */}
        <div className="absolute -top-2 -right-2 w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2 border-stone-500/30 flex items-center justify-center rotate-12 pointer-events-none z-20">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full border border-dashed border-stone-500/40 flex items-center justify-center bg-white/30 backdrop-blur-sm">
            <span className="font-mono text-[5px] sm:text-[6px] text-stone-600 uppercase tracking-wider text-center leading-tight">
              Postal<br />Peek
            </span>
          </div>
        </div>
      </motion.div>

      {/* ─── Text content: centered, starts from frame 0 ─── */}
      <div className="flex flex-col items-center mt-[42dvh] sm:mt-[46%]">
        <motion.p
          className="text-stone-500 text-[10px] sm:text-[11px] font-mono tracking-[0.3em] uppercase mb-3 sm:mb-5 text-center"
          {...anim.presents}
        >
          Entity Builders presents
        </motion.p>

        <motion.h1
          className="font-serif text-4xl sm:text-6xl text-stone-900 tracking-tight mb-2 sm:mb-3 text-center"
          style={{ textShadow: '0 1px 8px rgba(255,255,255,0.5)' }}
          {...anim.title}
        >
          Kyle Walker
        </motion.h1>

        <motion.p
          className="text-stone-600 text-sm sm:text-base tracking-wide mb-4 sm:mb-8 font-medium text-center"
          {...anim.subtitle}
        >
          Digital Agent · Photographer · Watercolor Artist
        </motion.p>

        <motion.p
          className="text-stone-700 text-base sm:text-xl text-center leading-relaxed max-w-[400px] mb-6 sm:mb-10 px-2"
          {...anim.body}
        >
          I travel the world and paint what I see.
          <br />
          Every street, every café, every hidden corner
          <br />
          becomes a watercolor postcard.
        </motion.p>

        <motion.div className="w-20 h-px bg-stone-400/60 mb-4 sm:mb-8" {...anim.divider} />

        <motion.p
          className="text-stone-600 text-base sm:text-lg font-light italic font-serif text-center"
          {...anim.tagline}
        >
          These postcards are for you.
        </motion.p>
      </div>

      {/* ─── Scroll Hint ─── */}
      <motion.div
        className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 sm:gap-2 text-stone-500 animate-bounce"
        {...anim.scrollHint}
      >
        <ChevronDown className="w-5 h-5" />
        <span className="text-xs tracking-[0.2em] uppercase font-semibold">
          Scroll to explore
        </span>
      </motion.div>
    </div>
  );
}

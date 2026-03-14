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
 * First-visit onboarding slide — cinematic reveal powered by useWelcomeAnimation.
 *
 * Layout: postcards area is ALWAYS rendered (opacity 0 → 0.85) so the text
 * never jumps when images arrive. The postcard container always takes its space.
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

  // All animation configs from the centralized hook
  const anim = useWelcomeAnimation(imgUrl0);

  return (
    <div className="w-full h-full flex flex-col items-center justify-between px-6 py-10 select-none overflow-hidden">
      <div className="flex-shrink-0 h-4 sm:h-8" />

      <div className="flex flex-col items-center justify-center flex-1 min-h-0">

        {/* ─── Postcards stack ─── */}
        {/* Always rendered to reserve layout space — opacity handles visibility */}
        <motion.div
          className="relative w-[120px] h-[140px] sm:w-[190px] sm:h-[210px] mb-6 sm:mb-10 flex-shrink-0"
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
              <div className="w-full h-[calc(100%-18px)] overflow-hidden rounded-[2px] bg-stone-100">
                <img src={imgUrl0} srcSet={srcSet0} alt={cards[0].category} className="w-full h-full object-cover" loading="eager" />
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
                Postal<br />Peek
              </span>
            </div>
          </div>
        </motion.div>

        {/* ─── Text (animates from second 0, independent of images) ─── */}
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
        className="flex-shrink-0 flex flex-col items-center gap-1 sm:gap-2 text-stone-500 animate-bounce pt-4 pb-2"
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

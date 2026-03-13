import React from 'react';
import { ChevronDown } from 'lucide-react';
import type { FeedItem } from './Postcard';

interface WalkerWelcomeProps {
  /** First postcards from the feed to display as stacked preview */
  previewCards: FeedItem[];
}

/**
 * First-visit onboarding slide introducing "Kyle Walker" — the digital wanderer
 * behind PostalPeek. Appears as the first slide in the Embla carousel.
 * Controlled by localStorage so it only shows once per device.
 */
export function WalkerWelcome({ previewCards }: WalkerWelcomeProps) {
  const cards = previewCards.slice(0, 3);

  return (
    <div className="w-full h-full flex flex-col items-center justify-center px-6 select-none">
      {/* ─── Stacked Postcards ─── */}
      {cards.length > 0 && (
        <div className="relative w-[260px] h-[290px] sm:w-[320px] sm:h-[350px] mb-12">
          {/* Card 3 (back) */}
          {cards[2] && (
            <div className="absolute inset-0 bg-white p-2 rounded-sm shadow-md rotate-[7deg] translate-x-5 -translate-y-2 opacity-50">
              <div className="w-full h-full overflow-hidden rounded-[2px]">
                <img
                  src={cards[2].illustration_url}
                  alt=""
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
            </div>
          )}
          {/* Card 2 (middle) */}
          {cards[1] && (
            <div className="absolute inset-0 bg-white p-2 rounded-sm shadow-md -rotate-[5deg] -translate-x-4 translate-y-2 opacity-70">
              <div className="w-full h-full overflow-hidden rounded-[2px]">
                <img
                  src={cards[1].illustration_url}
                  alt=""
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
            </div>
          )}
          {/* Card 1 (front — hero) */}
          {cards[0] && (
            <div className="absolute inset-0 bg-white p-2 pb-8 rounded-sm shadow-xl -rotate-[1.5deg]">
              <div className="w-full h-[calc(100%-24px)] overflow-hidden rounded-[2px]">
                <img
                  src={cards[0].illustration_url}
                  alt={cards[0].category}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
              <p className="text-center font-handwriting text-xs text-stone-400 mt-2 truncate px-2">
                {cards[0].city}, {cards[0].country}
              </p>
            </div>
          )}

          {/* Postmark stamp */}
          <div className="absolute -top-3 -right-3 w-14 h-14 rounded-full border-2 border-stone-400/20 flex items-center justify-center rotate-12 pointer-events-none z-20">
            <div className="w-12 h-12 rounded-full border border-dashed border-stone-400/30 flex items-center justify-center">
              <span className="font-mono text-[6px] text-stone-500/60 uppercase tracking-wider text-center leading-tight">
                Postal<br />Peek
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ─── Walker Introduction ─── */}
      <p className="text-stone-400/60 text-[11px] font-mono tracking-[0.3em] uppercase mb-4">
        Entity Builders presents
      </p>
      <h1 className="font-serif text-4xl sm:text-5xl text-stone-800 tracking-tight mb-2">
        Kyle Walker
      </h1>
      <p className="text-stone-400/70 text-sm tracking-wide mb-6">
        Digital Agent · Photographer · Watercolor Artist
      </p>
      <p className="text-stone-500 text-base sm:text-lg text-center leading-relaxed max-w-[360px] mb-8 font-light">
        I travel the world and paint what I see.
        <br />
        Every street, every café, every hidden corner
        <br />
        becomes a watercolor postcard.
      </p>

      <div className="w-16 h-px bg-stone-300/50 mb-8" />

      <p className="text-stone-400/60 text-base font-light italic font-serif">
        These postcards are for you.
      </p>

      {/* ─── Scroll Hint ─── */}
      <div className="absolute bottom-10 left-0 right-0 flex flex-col items-center gap-1.5 text-stone-400/35 animate-bounce">
        <ChevronDown className="w-5 h-5" />
        <span className="text-[11px] tracking-[0.2em] uppercase font-light">
          Scroll to explore
        </span>
      </div>
    </div>
  );
}

/**
 * PostcardChin — single source of truth for the postcard bottom area.
 *
 * Renders consistently in ALL views: grid, list/feed, and carousel.
 *  - Storytelling fact (expandable amber card)
 *  - Album stop indicator  OR  city name
 *  - Action buttons: "Certificar Propiedad" pill | BookImage (owned) | ShareButton | Ticket (business)
 *  - Claimed-by-other badge
 */

import React, { useState } from 'react';
import {
  Ticket,
  Lock,
  ChevronDown,
  ChevronUp,
  Dice5,
  ArrowRightLeft,
  RotateCw,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '../../utils/cn';
import { analytics } from '../../lib/analytics';
import type { FeedItem } from '../Postcard';
import { ShareButton } from './ShareButton';
import { AlbumStopIndicator } from './AlbumStopIndicator';
import { PostalPeekStampSVG } from './PostalPeekStampSVG';
import { t, useLang } from '../../utils/i18n';
import { useNavigate } from 'react-router-dom';
import { useStampContext } from '../../contexts/StampContext';

// ── Fact type helpers ────────────────────────────────────────────────
const FACT_EMOJI: Record<string, string> = {
  historical: '🏛️',
  architectural: '🏗️',
  cultural: '🎭',
  gastronomic: '🍽️',
  natural: '🌿',
  artistic: '🎨',
};

const FACT_LABEL: Record<string, { es: string; en: string }> = {
  historical: { es: 'Dato Histórico', en: 'Historical Fact' },
  architectural: { es: 'Arquitectura', en: 'Architecture' },
  cultural: { es: 'Cultura', en: 'Culture' },
  gastronomic: { es: 'Gastronomía', en: 'Gastronomy' },
  natural: { es: 'Naturaleza', en: 'Nature' },
  artistic: { es: 'Arte', en: 'Art' },
};

// ── Props ────────────────────────────────────────────────────────────

export interface PostcardChinProps {
  item: FeedItem;
  /** Active item in carousel (may differ from item for album slides) */
  activeItem?: FeedItem;
  /** Current user owns this postcard */
  isClaimedByMe?: boolean;
  /** Anyone owns this postcard */
  hasOwner?: boolean;
  /** Trivia is gating the reveal — hide storytelling, show lock state */
  isTriviaLocked?: boolean;
  /** Clean/fullscreen mode — hide the entire chin */
  isClean?: boolean;
  /** Hide share + extra action buttons */
  hideActions?: boolean;
  /** Tutorial: show a pulsing guide tooltip on the claim button */
  showClaimGuide?: boolean;
  /** Album stop metadata keyed by sequence */
  albumStops?: Record<number, { stop_name: string; stop_description?: string }>;
  totalStops?: number;
  /** Play button callback (carousel): starts mini-games to grind stamps */
  onPlay?: () => void;
  /** Sellar button callback (carousel): spends stamps to claim */
  onClaim?: (rarity: 'common' | 'rare' | 'epic' | 'legendary') => void;
  /** Trade button callback (carousel): propose trade */
  onTrade?: () => void;
  /** Navigate to album (carousel) */
  onOpenAlbum?: (albumId: string) => void;
  /** Flip card (carousel only) */
  onFlipCard?: (view?: 'info' | 'coupon') => void;
  /** Simple click (grid mode): opens carousel for this card */
  onClick?: () => void;
  /** Show the coupon/ticket button */
  isBusiness?: boolean;
}

// ── Component ────────────────────────────────────────────────────────

export function PostcardChin({
  item,
  activeItem,
  isClaimedByMe = false,
  hasOwner = false,
  isTriviaLocked = false,
  isClean = false,
  hideActions = false,
  showClaimGuide = false,
  albumStops,
  totalStops,
  onPlay,
  onClaim,
  onTrade,
  onOpenAlbum,
  onFlipCard,
  onClick,
  isBusiness = false,
}: PostcardChinProps) {
  const lang = useLang();
  const navigate = useNavigate();
  const [storyExpanded, setStoryExpanded] = useState(false);

  const active = activeItem ?? item;
  const storytelling = active.generation_metadata?.storytelling;
  const albumId = active.album_id || item.album_id;

  const hasAlbumStop = !!active.album_id && active.album_sequence != null;
  const stopMeta =
    active.album_sequence != null
      ? albumStops?.[active.album_sequence]
      : undefined;

  const showStorytelling = !!storytelling && !isTriviaLocked;

  // Unified click handlers: prefer explicit callback (carousel), fall back to onClick (grid)
  const handleClaimClick = onClaim ?? onClick;
  const handleTradeClick = onTrade ?? onClick;

  const isPlayedToday = Boolean(
    active.last_played_at && 
    new Date(active.last_played_at).toDateString() === new Date().toDateString()
  );

  const rarity = (active.rarity as 'common' | 'rare' | 'epic' | 'legendary') || 'common';
  
  const stampCtx = useStampContext();
  const stamps = stampCtx?.stampBalances;
  const hasEnoughStamps = stamps ? (stamps[rarity] || 0) > 0 : false;

  return (
    <div
      className={cn(
        'transition-all duration-300 overflow-hidden shrink-0',
        isClean ? 'max-h-0 opacity-0' : 'max-h-[500px] opacity-100',
      )}
    >
      {/* ── Storytelling expandable fact ─────────────────────────── */}
      {showStorytelling && (
        <motion.button
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className='w-full mt-2 px-3 py-2.5 rounded-xl border border-amber-200/50 bg-gradient-to-br from-amber-50 to-orange-50/80 shadow-[0_2px_10px_rgba(251,191,36,0.12)] flex items-start justify-between gap-3 text-left'
          onClick={(e) => {
            e.stopPropagation();
            if (!storyExpanded) {
              setStoryExpanded(true);
            } else {
              // Second tap: flip card (carousel) or open carousel (grid)
              if (onFlipCard) onFlipCard('info');
              else if (onClick) onClick();
            }
          }}
        >
          <div className='flex-1 min-w-0'>
            <div className='flex items-center gap-1.5 mb-1'>
              <span className='text-[10px] bg-amber-200/60 rounded-full w-5 h-5 flex items-center justify-center shrink-0'>
                {FACT_EMOJI[storytelling.fact_type] || '📖'}
              </span>
              <span className='text-[10px] font-bold text-amber-800/80 uppercase tracking-widest'>
                {t(
                  FACT_LABEL[storytelling.fact_type] ?? {
                    es: 'Dato Curioso',
                    en: 'Fun Fact',
                  },
                  lang,
                )}
              </span>
            </div>
            <p
              className={cn(
                'text-xs text-stone-700/90 font-medium leading-relaxed',
                !storyExpanded && 'line-clamp-2',
              )}
            >
              {t(storytelling.did_you_know, lang)}
            </p>
          </div>
          <div className='text-amber-600 shrink-0 mt-0.5'>
            <div className='w-6 h-6 bg-amber-200/40 rounded-full flex items-center justify-center'>
              {storyExpanded ? (
                <ChevronUp className='w-3.5 h-3.5' />
              ) : (
                <ChevronDown className='w-3.5 h-3.5' />
              )}
            </div>
          </div>
        </motion.button>
      )}

      {/* ── Bottom row: context + actions ───────────────────────── */}
      <div className='flex flex-wrap justify-between items-center gap-y-2 gap-x-1 px-1 pb-1 mt-2'>
        {/* Left: album stop indicator or city */}
        <div className='mr-auto max-w-full'>
          {hasAlbumStop ? (
            <AlbumStopIndicator
              sequence={active.album_sequence!}
              totalStops={totalStops || 0}
              stopName={stopMeta?.stop_name}
              stopDescription={stopMeta?.stop_description}
            />
          ) : (
            <p className='text-[10px] md:text-xs text-stone-500 font-medium leading-tight'>
              {active.city || item.city}
            </p>
          )}
        </div>

        {/* Right: action buttons */}
        <div className='flex flex-wrap items-center justify-end gap-1.5'>
          {/* MVP: stamp/claim/trade/play buttons disabled for launch */}

          {/* Flip / Info */}
          {onFlipCard && (
            <button
              className='p-1.5 md:p-2 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-500 hover:text-stone-700 transition-colors shadow-sm'
              onClick={(e) => {
                e.stopPropagation();
                onFlipCard('info');
                analytics.track('postcard_flip_clicked', { postcard_id: item.id });
              }}
              title={t({ es: 'Ver reverso', en: 'View back' }, lang)}
            >
              <RotateCw className='w-4 h-4 md:w-5 md:h-5' />
            </button>
          )}

          {/* Share */}
          {!hideActions && (
            <ShareButton postcardId={item.id} country={item.country} />
          )}

          {/* Business coupon */}
          {isBusiness && onFlipCard && (
            <button
              className='p-2 md:p-2.5 rounded-full bg-rose-100 hover:bg-rose-200 text-rose-500 hover:text-rose-600 transition-colors'
              onClick={(e) => {
                e.stopPropagation();
                onFlipCard('coupon');
                analytics.track('coupon_viewed', { postcard_id: item.id });
              }}
              title='Special Offer'
            >
              <Ticket className='w-4 h-4 md:w-5 md:h-5' />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

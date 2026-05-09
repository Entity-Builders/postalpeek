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
  PlaneTakeoff,
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
  /** Travel to this postcard's location in Street View (only rendered when item has pano_id) */
  onTravelHere?: () => void;
  /** Whether the preflight check is running */
  isTravelChecking?: boolean;
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
  onTravelHere,
  isTravelChecking = false,
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
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className='w-full mt-3 mb-1 px-2 flex flex-col text-left cursor-pointer'
          onClick={(e) => {
            e.stopPropagation();
            if (!storyExpanded) {
              setStoryExpanded(true);
            } else {
              if (onFlipCard) onFlipCard('info');
              else if (onClick) onClick();
            }
          }}
        >
          <p
            className={cn(
              'text-[13px] md:text-sm text-stone-700 font-sans leading-relaxed',
              !storyExpanded && 'line-clamp-2',
            )}
          >
            {t(storytelling.did_you_know, lang)}
          </p>
          {!storyExpanded && (
            <div className='flex items-center gap-1 mt-1'>
              <span className='text-[9px] text-stone-400 font-bold uppercase tracking-wider'>Leer más</span>
              <ChevronDown className='w-3 h-3 text-stone-400' />
            </div>
          )}
        </motion.div>
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

          {/* MVP: Flip removed since storytelling is on the front */}

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

      {/* ── "Viaja aquí" CTA — only when card has verified pano_id ── */}
      {onTravelHere && !hideActions && item.streetview_pov?.pano_id && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (!isTravelChecking) onTravelHere();
          }}
          disabled={isTravelChecking}
          className={cn(
            'w-full mt-2 mb-1 mx-auto flex items-center justify-center gap-2',
            'py-2.5 rounded-xl text-[13px] font-semibold transition-all border',
            'bg-emerald-50 hover:bg-emerald-100 active:bg-emerald-200',
            'text-emerald-700 border-emerald-200/70',
            'disabled:opacity-60 disabled:cursor-not-allowed',
          )}
        >
          {isTravelChecking ? (
            <>
              <div className='w-3.5 h-3.5 border-2 border-emerald-500/40 border-t-emerald-600 rounded-full animate-spin' />
              <span>{t({ es: 'Verificando cobertura...', en: 'Checking coverage...' }, lang)}</span>
            </>
          ) : (
            <>
              <PlaneTakeoff className='w-3.5 h-3.5' />
              <span>{t({ es: 'Viaja aquí', en: 'Travel here' }, lang)}</span>
            </>
          )}
        </button>
      )}

    </div>
  );
}

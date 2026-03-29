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
  Stamp,
  Dice5,
  ArrowRightLeft,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '../../utils/cn';
import { analytics } from '../../lib/analytics';
import type { FeedItem } from '../Postcard';
import { ShareButton } from './ShareButton';
import { AlbumStopIndicator } from './AlbumStopIndicator';
import { t, useLang } from '../../utils/i18n';
import { useNavigate } from 'react-router-dom';

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
  onClaim?: (cost?: number) => void;
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

  const stampCost = active.stamp_cost ?? (active.rarity === 'legendary' ? 35 : active.rarity === 'epic' ? 15 : active.rarity === 'rare' ? 6 : 2);

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
          {/* Claimed by another user */}
          {hasOwner && !isClaimedByMe && (
            <span className='flex items-center gap-1.5 bg-stone-100/90 text-stone-500 text-[10px] font-semibold pl-0.5 pr-2 py-0.5 rounded-full border border-stone-200/60 shadow-sm'>
              <img 
                src={`https://api.dicebear.com/9.x/adventurer/svg?seed=${active.owner_id || item.owner_id || 'default'}`} 
                alt="Owner Avatar" 
                className="w-5 h-5 rounded-full bg-stone-200 border border-stone-300 shadow-inner" 
                loading="lazy"
              />
              <span className="flex items-center gap-0.5 text-[9px] uppercase tracking-wider">
                <Lock className='w-2.5 h-2.5 text-stone-400/80 mb-[1px]' />
                {t({ es: 'Reclamada', en: 'Claimed' }, lang)}
              </span>
            </span>
          )}

          {/* Owned (by me) → Certification Seal */}
          {isClaimedByMe && (
            <button
              className='flex items-center gap-1 px-2 py-1 rounded-sm border-2 border-emerald-600/60 text-emerald-700 bg-emerald-50/80 hover:bg-emerald-100 transition-colors shadow-sm rotate-[-1deg] hover:rotate-0'
              style={{ fontFamily: 'monospace' }}
              onClick={(e) => {
                e.stopPropagation();
                if (onOpenAlbum && albumId) {
                  onOpenAlbum(albumId);
                } else if (onFlipCard) {
                  onFlipCard('info');
                } else if (albumId) {
                  navigate(`/album/${albumId}`);
                }
              }}
              title={t({ es: 'Ver en álbum', en: 'View in album' }, lang)}
            >
              <Stamp className='w-3 h-3' />
              <span className='text-[9px] font-bold uppercase tracking-wider'>
                {t({ es: 'Sellada ✓', en: 'Sealed ✓' }, lang)}
              </span>
            </button>
          )}

          {/* 🔄 Intercambiar — claimed by someone else */}
          {hasOwner && !isClaimedByMe && handleTradeClick && (
            <button
              className='flex items-center gap-1 px-3 py-1.5 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold shadow-sm transition-all border border-stone-300'
              onClick={(e) => {
                e.stopPropagation();
                handleTradeClick();
              }}
              title={t({ es: 'Proponer Intercambio', en: 'Propose Trade' }, lang)}
            >
              <ArrowRightLeft className='w-3.5 h-3.5' />
              <span className="text-[10px] hidden sm:inline">{t({ es: 'Intercambiar', en: 'Trade' }, lang)}</span>
            </button>
          )}

          {/* 🎲 Jugar — ONLY on cards owned by the current user */}
          {isClaimedByMe && !isPlayedToday && (
            <button
              className='flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-stone-800 hover:bg-black text-white font-bold shadow-md transition-all text-xs border border-stone-600'
              onClick={(e) => {
                e.stopPropagation();
                if (onPlay) {
                  onPlay();
                } else {
                  navigate(`/game/${item.id}`);
                }
              }}
              title={t({ es: 'Jugar (1 vez al día)', en: 'Play (1/day)' }, lang)}
            >
              <Dice5 className='w-3.5 h-3.5 md:w-4 md:h-4' />
              {t({ es: 'Jugar', en: 'Play' }, lang)}
            </button>
          )}

          {/* ⏳ Jugada — Disable if played today */}
          {isClaimedByMe && isPlayedToday && (
            <button
              className='flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-stone-200 text-stone-400 font-bold shadow-none text-xs border border-stone-300 cursor-not-allowed opacity-90'
              onClick={(e) => e.stopPropagation()}
              disabled
              title={t({ es: 'Vuelve mañana', en: 'Come back tomorrow' }, lang)}
            >
              <Dice5 className='w-3.5 h-3.5 md:w-4 md:h-4 opacity-50' />
              {t({ es: 'Jugada', en: 'Played' }, lang)}
            </button>
          )}

          {/* ✨ Revelar — unclaimed cards only */}
          {!hasOwner && handleClaimClick && (
            <div className="relative isolate flex-shrink-0">
              <button
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-50 text-indigo-600 font-bold shadow-sm transition-all text-xs border border-indigo-200',
                  showClaimGuide ? 'animate-pulse hover:bg-indigo-100' : 'hover:bg-indigo-100'
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  if (onClaim) {
                    onClaim(stampCost);
                    analytics.track('buy_intention', { postcard_id: item.id });
                  } else if (onClick) {
                    onClick(); // fallback
                  }
                }}
                title={t({ es: `Revelar por ${stampCost} Sellos`, en: `Reveal for ${stampCost} Stamps` }, lang)}
              >
                <span>{t({ es: `Revelar por ${stampCost}`, en: `Reveal for ${stampCost}` }, lang)}</span>
                <div className="w-4 h-4 rounded-full border border-indigo-300 flex items-center justify-center bg-indigo-100 shrink-0 rotate-12">
                   <span className="font-mono text-[4px] text-indigo-700 uppercase tracking-tighter text-center leading-[1]">
                     Postal<br/>Peek
                   </span>
                </div>
              </button>
              {showClaimGuide && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ delay: 0.5, repeat: Infinity, repeatType: 'reverse', duration: 1.5 }}
                  className="absolute bottom-full mb-3 right-0 bg-indigo-400 text-indigo-950 px-3 py-1.5 rounded-lg text-xs font-bold shadow-[0_4px_20px_rgba(129,140,248,0.4)] whitespace-nowrap z-50 pointer-events-none"
                >
                  {t({ es: '✨ Revela para jugar', en: '✨ Reveal to play' }, lang)}
                  <div className="absolute top-full right-6 -mt-px border-[6px] border-transparent border-t-indigo-400" />
                </motion.div>
              )}
            </div>
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

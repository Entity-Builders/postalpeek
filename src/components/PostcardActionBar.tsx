import React from 'react';
import { Ticket, Trophy } from 'lucide-react';
import { cn } from '../utils/cn';
import { analytics } from '../lib/analytics';
import type { FeedItem } from './Postcard';
import { ShareButton } from './ui/ShareButton';
import { CityLabel } from './ui/CityLabel';
import { AlbumStopIndicator } from './ui/AlbumStopIndicator';
import { t } from '../utils/i18n';

interface PostcardActionBarProps {
  item: FeedItem;
  activeSlideItem: FeedItem;
  isLiked: boolean;
  onToggleFavorite?: (postcardId: string) => void;
  onAuthRequired?: (postcardId: string) => void;
  onFlipCard: (view?: 'info' | 'coupon') => void;
  hideActions: boolean;
  isClean: boolean;
  isBusiness: boolean;
  storytellingTitle?: string;
  albumStops?: Record<number, { stop_name: string; stop_description?: string }>;
  totalStops?: number;
  onPlay?: () => void;
  /** Whether the user already owns this postcard */
  isOwned?: boolean;
}

export function PostcardActionBar({
  item,
  activeSlideItem,
  onFlipCard,
  hideActions,
  isClean,
  isBusiness,
  storytellingTitle,
  albumStops,
  totalStops,
  onPlay,
  isOwned,
}: PostcardActionBarProps) {

  const stopMeta = activeSlideItem.album_sequence != null
    ? albumStops?.[activeSlideItem.album_sequence]
    : undefined;

  return (
    <div className={cn(
      'mt-3 md:mt-4 px-1 pb-1 flex justify-between items-end shrink-0 transition-all duration-300 overflow-hidden',
      isClean ? 'max-h-0 opacity-0 mt-0 pb-0' : 'max-h-40 opacity-100',
    )}>
      <div className='flex-1 min-w-0 mr-3'>
        {/* Album stop indicator */}
        {activeSlideItem.album_id && activeSlideItem.album_sequence != null && (
          <AlbumStopIndicator
            sequence={activeSlideItem.album_sequence}
            totalStops={totalStops || 0}
            stopName={stopMeta?.stop_name}
            stopDescription={stopMeta?.stop_description}
          />
        )}
        <h3
          className={cn(
            'font-serif font-semibold tracking-tight leading-none mb-1 truncate',
            storytellingTitle ? 'text-base md:text-lg' : 'text-lg md:text-xl',
          )}
          style={{ color: '#1a1a1a' }}
        >
          {t(activeSlideItem.category)
            .replace(/[\u{1F300}-\u{1F9FF}]/u, '')
            .trim()}
        </h3>
        <CityLabel
          city={activeSlideItem.city}
          country={activeSlideItem.country}
          variant='inline'
        />
      </div>

      <div className='flex items-center gap-2 shrink-0'>
        {/* Owned trophy — tapping flips card to show details */}
        {isOwned && (
          <button
            className='p-2 md:p-2.5 rounded-full bg-amber-100 hover:bg-amber-200 text-amber-600 hover:text-amber-700 transition-colors shadow-sm'
            onClick={(e) => {
              e.stopPropagation();
              onFlipCard('info');
            }}
            title={t({ es: 'Tu colección', en: 'Your collection' })}
          >
            <Trophy className='w-4 h-4 md:w-5 md:h-5' />
          </button>
        )}
        {/* Challenge CTA */}
        {onPlay && (
          <button
            className='flex items-center gap-1.5 px-3.5 py-2 md:px-4 md:py-2.5 rounded-full bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-500 hover:to-yellow-600 text-amber-950 font-bold shadow-md hover:shadow-lg transition-all text-sm ring-1 ring-amber-500/30'
            onClick={(e) => {
              e.stopPropagation();
              onPlay();
              analytics.track('challenge_started', { postcard_id: item.id, country: item.country });
            }}
            title={t({ es: 'Ganarla', en: 'Win it' })}
          >
            <Trophy className='w-4 h-4 md:w-5 md:h-5' />
            {t({ es: 'Ganarla', en: 'Win it' })}
          </button>
        )}

        {!hideActions && (
          <ShareButton
            postcardId={item.id}
            country={item.country}
          />
        )}

        {isBusiness && (
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
  );
}

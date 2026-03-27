import React from 'react';
import { Ticket, Joystick } from 'lucide-react';
import { cn } from '../utils/cn';
import { analytics } from '../lib/analytics';
import type { FeedItem } from './Postcard';
import { LikeButton } from './ui/LikeButton';
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
}

export function PostcardActionBar({
  item,
  activeSlideItem,
  isLiked,
  onToggleFavorite,
  onAuthRequired,
  onFlipCard,
  hideActions,
  isClean,
  isBusiness,
  storytellingTitle,
  albumStops,
  totalStops,
  onPlay,
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
        <LikeButton
          postcardId={item.id}
          country={item.country}
          city={item.city}
          isLiked={isLiked}
          onToggleFavorite={onToggleFavorite}
          onAuthRequired={onAuthRequired}
        />

        {/* Play game button */}
        {onPlay && (
          <button
            className='flex items-center gap-1.5 px-3 py-1.5 md:px-3.5 md:py-2 rounded-full bg-amber-400 hover:bg-amber-500 text-amber-950 font-semibold shadow-sm hover:shadow-md transition-all text-sm animate-pulse-slow'
            onClick={(e) => {
              e.stopPropagation();
              onPlay();
              analytics.track('game_play_tapped', { postcard_id: item.id, country: item.country });
            }}
            title={t({ es: 'Jugar', en: 'Play' })}
          >
            <Joystick className='w-4 h-4 md:w-5 md:h-5' />
            {t({ es: 'Jugar', en: 'Play' })}
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

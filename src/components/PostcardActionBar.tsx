import React, { useRef, useState } from 'react';
import { Info, Ticket } from 'lucide-react';
import { cn } from '../utils/cn';
import { analytics } from '../lib/analytics';
import type { FeedItem } from './Postcard';
import { LikeButton } from './ui/LikeButton';
import { ClaimButton } from './ui/ClaimButton';
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
  isClaimedByMe: boolean;
  isClaimed: boolean;
  onClaimPostcard?: (postcardId: string) => void;
  isClaimLoading: boolean;
  isInAlbum: boolean;
  showClaimGuide: boolean;
  hideActions: boolean;
  isClean: boolean;
  isBusiness: boolean;
  storytellingTitle?: string;
  albumStops?: Record<number, { stop_name: string; stop_description?: string }>;
  totalStops?: number;
}

export function PostcardActionBar({
  item,
  activeSlideItem,
  isLiked,
  onToggleFavorite,
  onAuthRequired,
  onFlipCard,
  isClaimedByMe,
  isClaimed,
  onClaimPostcard,
  isClaimLoading,
  isInAlbum,
  showClaimGuide,
  hideActions,
  isClean,
  isBusiness,
  storytellingTitle,
  albumStops,
  totalStops,
}: PostcardActionBarProps) {
  const [showIdCopied, setShowIdCopied] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLongPress = useRef(false);

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

        {!hideActions && (
          <ClaimButton
            postcardId={item.id}
            isClaimedByMe={isClaimedByMe}
            isClaimed={isClaimed}
            isClaimLoading={isClaimLoading}
            onClaimPostcard={onClaimPostcard}
            onAuthRequired={onAuthRequired}
            showClaimGuide={showClaimGuide}
            isInAlbum={isInAlbum}
          />
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

        <div className='relative'>
          <button
            className='p-2 md:p-2.5 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-400 hover:text-stone-600 transition-colors'
            onPointerDown={(e) => {
              e.stopPropagation();
              didLongPress.current = false;
              longPressTimer.current = setTimeout(async () => {
                didLongPress.current = true;
                try {
                  await navigator.clipboard.writeText(activeSlideItem.id);
                  setShowIdCopied(true);
                  setTimeout(() => setShowIdCopied(false), 1500);
                } catch {
                  /* clipboard not available */
                }
              }, 600);
            }}
            onPointerUp={() => {
              if (longPressTimer.current) {
                clearTimeout(longPressTimer.current);
                longPressTimer.current = null;
              }
            }}
            onPointerLeave={() => {
              if (longPressTimer.current) {
                clearTimeout(longPressTimer.current);
                longPressTimer.current = null;
              }
            }}
            onClick={(e) => {
              e.stopPropagation();
              if (didLongPress.current) return;
              onFlipCard('info');
            }}
          >
            <Info className='w-4 h-4 md:w-5 md:h-5' />
          </button>
          {showIdCopied && (
            <div className='absolute bottom-full right-0 mb-2 px-3 py-1.5 bg-stone-800 text-white text-[11px] rounded-lg shadow-lg whitespace-nowrap z-50 animate-fade-in'>
              ID Copied! 📋
              <div className='absolute top-full right-4 w-2 h-2 bg-stone-800 rotate-45 -translate-y-1' />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * PostcardActionBar — thin wrapper around PostcardChin for the carousel context.
 * All rendering logic lives in PostcardChin; this keeps the existing API intact.
 */

import React from 'react';
import type { FeedItem } from './Postcard';
import { PostcardChin } from './ui/PostcardChin';

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
  isTriviaLocked?: boolean;
  albumStops?: Record<number, { stop_name: string; stop_description?: string }>;
  totalStops?: number;
  onPlay?: () => void;
  onClaim?: (rarity: 'common' | 'rare' | 'epic' | 'legendary') => void;
  onTrade?: () => void;
  showClaimGuide?: boolean;
  isOwned?: boolean;
  hasOwner?: boolean;
  onOpenAlbum?: (albumId: string) => void;
  onTravelHere?: () => void;
  isTravelChecking?: boolean;
}

export function PostcardActionBar({
  item,
  activeSlideItem,
  onFlipCard,
  hideActions,
  isClean,
  isBusiness,
  isTriviaLocked = false,
  albumStops,
  totalStops,
  onPlay,
  onClaim,
  onTrade,
  showClaimGuide = false,
  isOwned = false,
  hasOwner = false,
  onOpenAlbum,
  onTravelHere,
  isTravelChecking = false,
}: PostcardActionBarProps) {
  return (
    <PostcardChin
      item={item}
      activeItem={activeSlideItem}
      isClaimedByMe={isOwned}
      hasOwner={hasOwner}
      isTriviaLocked={isTriviaLocked}
      isClean={isClean}
      hideActions={hideActions}
      albumStops={albumStops}
      totalStops={totalStops}
      onPlay={onPlay}
      onClaim={onClaim}
      onTrade={onTrade}
      onOpenAlbum={onOpenAlbum}
      onFlipCard={onFlipCard}
      showClaimGuide={showClaimGuide}
      isBusiness={isBusiness}
      onTravelHere={onTravelHere}
      isTravelChecking={isTravelChecking}
    />
  );
}

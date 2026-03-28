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
  isOwned?: boolean;
  onOpenAlbum?: (albumId: string) => void;
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
  isOwned = false,
  onOpenAlbum,
}: PostcardActionBarProps) {
  return (
    <PostcardChin
      item={item}
      activeItem={activeSlideItem}
      isClaimed={isOwned}
      isTriviaLocked={isTriviaLocked}
      isClean={isClean}
      hideActions={hideActions}
      albumStops={albumStops}
      totalStops={totalStops}
      onPlay={onPlay}
      onOpenAlbum={onOpenAlbum}
      onFlipCard={onFlipCard}
      isBusiness={isBusiness}
    />
  );
}

import React from 'react';
import { Heart } from 'lucide-react';
import { cn } from '../../utils/cn';
import { analytics } from '../../lib/analytics';

interface LikeButtonProps {
  postcardId: string;
  country: string;
  city: string;
  isLiked: boolean;
  onToggleFavorite?: (postcardId: string) => void;
  onAuthRequired?: (postcardId: string) => void;
}

export function LikeButton({
  postcardId,
  country,
  city,
  isLiked,
  onToggleFavorite,
  onAuthRequired,
}: LikeButtonProps) {
  return (
    <button
      className={cn(
        'p-2 md:p-2.5 rounded-full transition-colors',
        isLiked
          ? 'bg-rose-100 text-rose-500'
          : 'bg-stone-100/80 hover:bg-rose-50 text-stone-400 hover:text-rose-500',
      )}
      onClick={(e) => {
        e.stopPropagation();
        if (onAuthRequired && !onToggleFavorite) {
          onAuthRequired(postcardId);
          return;
        }
        if (onToggleFavorite) {
          onToggleFavorite(postcardId);
        }
        analytics.track(isLiked ? 'postcard_unfavorited' : 'postcard_favorited', {
          postcard_id: postcardId,
          country,
          city,
        });
      }}
    >
      <Heart
        className={cn(
          'w-4 h-4 md:w-5 md:h-5 transition-transform',
          isLiked && 'fill-current scale-110',
        )}
      />
    </button>
  );
}

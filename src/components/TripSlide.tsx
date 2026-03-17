import React from 'react';
import { Play } from 'lucide-react';
import { cn } from './SearchBar';
import { cdnUrl, WIDTHS } from '../utils/imageUtils';
import type { FeedItem } from './Postcard';
import { t } from '../utils/i18n';
import { useSignedImage, useSignedSrcSet, useRawSignedImage } from '../utils/useSignedImage';

interface TripSlideProps {
  slideItem: FeedItem;
  isPriority: boolean;
  handleImageError: (e: React.SyntheticEvent<HTMLImageElement, Event>) => void;
  fallbackEnabled?: boolean;
  isHovered: boolean;
  setIsHovered: (h: boolean) => void;
  preloadedMainUrl?: string;
  preloadedPlaceholder?: string;
  preloadedSrcSet?: string;
  onHeroLoad?: () => void;
}

export function TripSlide({
  slideItem,
  isPriority,
  handleImageError,
  fallbackEnabled,
  isHovered,
  setIsHovered,
  preloadedMainUrl,
  preloadedPlaceholder,
  preloadedSrcSet,
  onHeroLoad,
}: TripSlideProps) {
  const pUrl = useSignedImage(preloadedMainUrl ? null : slideItem.illustration_url, { width: WIDTHS.blur, quality: 20 });
  const bUrl = useSignedImage(preloadedMainUrl ? null : slideItem.illustration_url, { width: WIDTHS.desktop });
  const bsSet = useSignedSrcSet(preloadedMainUrl ? null : slideItem.illustration_url, [WIDTHS.mobile, WIDTHS.tablet]);
  const rUrl = useRawSignedImage(preloadedMainUrl ? null : slideItem.illustration_url);

  const mainImgUrl = preloadedMainUrl || (fallbackEnabled ? rUrl : bUrl);
  const srcSetString = preloadedMainUrl ? preloadedSrcSet : (fallbackEnabled ? undefined : bsSet);
  const finalPlaceholder = preloadedMainUrl ? preloadedPlaceholder : (fallbackEnabled ? undefined : pUrl);

  return (
    <div
      className="relative flex-[0_0_100%] h-full min-w-0"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-stone-200/40 via-stone-100/20 to-stone-200/30 animate-pulse pointer-events-none z-0" />

      {finalPlaceholder && (
        <img
          src={finalPlaceholder}
          alt=''
          loading='eager'
          decoding='async'
          className="absolute inset-0 w-full h-full object-cover blur-xl scale-110 saturate-150 transform-gpu z-0 opacity-80"
          style={{ transition: 'opacity 0.4s ease-out' }}
        />
      )}

      {mainImgUrl && (
        <img
          key={mainImgUrl}
          src={mainImgUrl}
          srcSet={srcSetString}
          sizes="(max-width: 480px) 480px, (max-width: 768px) 768px, 1024px"
          alt={t(slideItem.category)}
          loading={isPriority ? 'eager' : 'lazy'}
          decoding="async"
          fetchPriority={isPriority ? 'high' : 'auto'}
          draggable={false}
          onError={handleImageError}
          onLoad={onHeroLoad}
          className={cn(
            'absolute inset-0 w-full h-full object-cover transition-transform duration-700 z-10',
            !slideItem.video_url && 'hover:scale-105',
          )}
        />
      )}

      {slideItem.video_url && isHovered && (
        slideItem.video_url.toLowerCase().includes('.gif') ? (
          <img
            key={slideItem.video_url}
            src={cdnUrl(slideItem.video_url)}
            alt="Animated Scene"
            className="absolute inset-0 w-full h-full object-cover z-10 transition-opacity duration-300 pointer-events-none"
          />
        ) : (
          <video
            key={slideItem.video_url}
            src={cdnUrl(slideItem.video_url)}
            autoPlay
            muted
            loop
            playsInline
            disablePictureInPicture
            controls={false}
            onContextMenu={(e) => e.preventDefault()}
            onLoadedData={(e) => {
              e.currentTarget.play().catch(() => {});
            }}
            className="absolute inset-0 w-full h-full object-cover z-10 transition-opacity duration-300 pointer-events-none"
          />
        )
      )}

      {slideItem.video_url && !isHovered && (
        <div className="absolute bottom-3 left-3 bg-black/40 backdrop-blur-md rounded-full p-1.5 text-white/90 z-20 pointer-events-none transition-opacity duration-300">
          <Play className="w-3.5 h-3.5 fill-white/80" />
        </div>
      )}

      <div className="absolute top-4 right-4 w-12 h-16 md:w-16 md:h-20 border-[3px] border-white/40 border-dashed rounded opacity-70 flex flex-col items-center justify-center -rotate-6 pointer-events-none z-[3]">
        <span className="text-[10px] md:text-xs font-bold text-white uppercase tracking-widest bg-black/20 px-1 rounded backdrop-blur-sm -rotate-12">
          POST
        </span>
        <span className="text-[8px] md:text-[10px] text-white/90 font-mono mt-1 drop-shadow-md">
          {new Date(slideItem.created_at).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
          })}
        </span>
      </div>
    </div>
  );
}


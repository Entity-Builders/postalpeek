import React, { useState } from 'react';
import { Camera, ChevronRight } from 'lucide-react';
import { cn } from './SearchBar';
import { useSignedImage, useSignedSrcSet, useRawSignedImage } from '../utils/useSignedImage';
import { WIDTHS } from '../utils/imageUtils';
import type { SmartAlbum } from '../hooks/useSmartAlbums';

interface SmartAlbumCoverProps {
  album: SmartAlbum;
  isActive: boolean;
  onOpenAlbum: () => void;
}

export function SmartAlbumCover({ album, isActive, onOpenAlbum }: SmartAlbumCoverProps) {
  const [heroReady, setHeroReady] = useState(false);
  const [fallbackEnabled, setFallbackEnabled] = useState(false);

  // Use the first image in the array as the primary cover
  const primaryCoverUrl = album.cover_urls && album.cover_urls.length > 0 ? album.cover_urls[0] : null;

  // Signed image URLs for the hero image
  const placeholderUrl = useSignedImage(primaryCoverUrl || undefined, {
    width: WIDTHS.blur,
    quality: 20,
  });
  const baseMainUrl = useSignedImage(primaryCoverUrl || undefined, {
    width: WIDTHS.desktop,
  });
  const baseSrcSet = useSignedSrcSet(primaryCoverUrl || undefined, [
    WIDTHS.mobile,
    WIDTHS.tablet,
  ]);
  const rawMainUrl = useRawSignedImage(primaryCoverUrl || undefined);

  const mainImgUrl = fallbackEnabled ? rawMainUrl : baseMainUrl;
  const srcSetString = fallbackEnabled ? undefined : baseSrcSet;
  const finalPlaceholder = fallbackEnabled ? undefined : placeholderUrl;

  const handleImageError = () => {
    if (!fallbackEnabled) {
      setTimeout(() => setFallbackEnabled(true), 0);
    }
  };

  // Type badge styling based on album type
  const getTypeBadge = () => {
    switch (album.album_type) {
      case 'country':
        return { icon: '🌍', text: 'País', color: 'bg-emerald-600/90' };
      case 'category':
        return { icon: '🏛️', text: 'Categoría', color: 'bg-blue-600/90' };
      case 'tag':
        return { icon: '🏷️', text: 'Etiqueta', color: 'bg-amber-600/90' };
      default:
        return { icon: '📸', text: 'Smart', color: 'bg-purple-600/90' };
    }
  };

  const badge = getTypeBadge();

  return (
    <div
      className={cn(
        'w-full h-full max-w-[480px] cursor-pointer mx-auto ease-in-out',
        isActive && !heroReady && 'opacity-0',
        isActive && heroReady && 'opacity-100',
        !isActive && 'scale-[0.85] opacity-40 pointer-events-none',
      )}
      style={{ transition: 'opacity 300ms ease-out, transform 700ms ease-in-out' }}
      onClick={onOpenAlbum}
    >
      <div className='relative w-full h-full bg-white flex flex-col overflow-hidden'>
        {/* Hero image array / Stacked effect */}
        <div className='relative flex-1 min-h-0 overflow-hidden bg-stone-200 rounded-md md:rounded-lg shadow-inner'>
          
          {/* Background blurred placeholder */}
          {finalPlaceholder && (
            <img
              src={finalPlaceholder}
              alt=''
              loading='eager'
              decoding='async'
              className='absolute inset-0 w-full h-full object-cover blur-xl scale-110 saturate-150 transform-gpu z-0 opacity-80'
            />
          )}

          {/* Main Hero Image */}
          {mainImgUrl && (
            <img
              src={mainImgUrl}
              srcSet={srcSetString}
              sizes='(max-width: 480px) 480px, (max-width: 768px) 768px, 1024px'
              alt={album.title}
              loading='eager'
              decoding='async'
              fetchPriority='high'
              draggable={false}
              onError={handleImageError}
              onLoad={() => setHeroReady(true)}
              className='absolute inset-0 w-full h-full object-cover z-10 block'
            />
          )}

          {/* Gradient Overlay */}
          <div className='absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black/80 via-black/40 to-transparent z-20' />

          {/* Badges and Text */}
          <div className='absolute top-4 right-4 z-30'>
             <span className={cn('text-white/95 backdrop-blur-md px-3 py-1.5 rounded-full text-xs font-semibold border border-white/20 shadow-lg tracking-wide flex items-center gap-1.5', badge.color)}>
              <span className="text-sm">{badge.icon}</span> {badge.text}
            </span>
          </div>

          <div className='absolute bottom-0 left-0 right-0 z-30 px-4 pb-4'>
            <p className='text-[10px] text-white/80 font-bold tracking-widest uppercase mb-1 shadow-sm'>
              SMART ALBUM
            </p>
            <h2 className='font-serif text-2xl md:text-3xl font-bold leading-tight line-clamp-2 text-white drop-shadow-lg mb-1'>
              {album.title}
            </h2>
            <div className='flex items-center gap-1.5 mt-1'>
              <Camera className='w-4 h-4 text-white/80 shrink-0' />
              <p className='text-sm text-white/90 font-medium'>
                {album.postcard_count} Postales coleccionadas
              </p>
            </div>
          </div>
        </div>

        {/* Action Button Area */}
        <div className='shrink-0 px-2 md:px-3 pt-3 pb-2 flex flex-col gap-2'>
          <button
            className='w-full py-3 bg-stone-800 hover:bg-stone-900 text-white rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2 shadow-sm'
            onClick={(e) => {
              e.stopPropagation();
              onOpenAlbum();
            }}
          >
            Abrir Smart Album
            <ChevronRight className='w-4 h-4' />
          </button>
        </div>
      </div>
    </div>
  );
}

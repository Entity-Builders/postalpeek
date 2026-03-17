import React from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import { WheelGesturesPlugin } from 'embla-carousel-wheel-gestures';
import { SmartAlbumCover } from './SmartAlbumCover';
import type { SmartAlbum } from '../hooks/useSmartAlbums';

interface SmartAlbumCarouselProps {
  albums: SmartAlbum[];
  isLoading: boolean;
  onOpenAlbum: (album: SmartAlbum) => void;
}

export function SmartAlbumCarousel({
  albums,
  isLoading,
  onOpenAlbum,
}: SmartAlbumCarouselProps) {
  const [emblaRef] = useEmblaCarousel(
    {
      align: 'center',
      containScroll: 'keepSnaps',
      dragFree: false,
    },
    [WheelGesturesPlugin()],
  );

  // If loading, show empty skeleton state
  if (isLoading) {
    return (
      <div className='w-full overflow-hidden' ref={emblaRef}>
        <div className='flex py-4 px-4 sm:px-0'>
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className='flex-[0_0_80%] sm:flex-[0_0_400px] min-w-0 mr-4'
            >
              <div className='h-[420px] w-full bg-stone-200/50 rounded-xl animate-pulse flex flex-col'>
                <div className='w-full h-full bg-stone-200 rounded-t-xl opacity-50' />
                <div className='p-4 h-24 bg-white/50 rounded-b-xl' />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Empty state handling is usually done by parent, but safe guard here
  if (!albums || albums.length === 0) {
    return (
      <div className="w-full h-64 flex flex-col items-center justify-center text-stone-500 bg-stone-50 rounded-xl border border-stone-200">
        <span className="text-4xl mb-2">🏷️</span>
        <p className="font-medium">Aún no tienes Smart Albums</p>
        <p className="text-sm mt-1 max-w-xs text-center">
          Abre más Sobres Diarios para desbloquear colecciones automáticas por país o categoría.
        </p>
      </div>
    );
  }

  return (
    <div className='w-full overflow-hidden' ref={emblaRef}>
      <div className='flex py-4 px-4 sm:px-0'>
        {albums.map((album, index) => (
          <div
            key={`${album.album_type}-${album.filter_value}-${index}`}
            className='flex-[0_0_80%] sm:flex-[0_0_400px] min-w-0 mr-4'
            style={{
              transform: 'translate3d(0, 0, 0)',
            }}
          >
            <div className='h-[420px] relative'>
              <SmartAlbumCover
                album={album}
                isActive={true} // In this carousel, all covers are fully active/visible
                onOpenAlbum={() => onOpenAlbum(album)}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

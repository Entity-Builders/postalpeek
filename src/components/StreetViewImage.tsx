import React, { useState } from 'react';
import { Map, Loader2, Sparkles } from 'lucide-react';
import { cn } from '../utils/cn';

interface StreetViewImageProps {
  imageUrl: string | null;
  isLoading: boolean;
  address?: string;
  onIllustrate?: () => void;
  isGenerating?: boolean;
}

export function StreetViewImage({
  imageUrl,
  isLoading,
  address,
  onIllustrate,
  isGenerating,
}: StreetViewImageProps) {
  const [imgLoaded, setImgLoaded] = useState(false);

  return (
    <div className='w-full max-w-3xl mx-auto relative rounded-2xl overflow-hidden glass-panel aspect-square flex items-center justify-center transition-all duration-500 shadow-2xl bg-black/20'>
      {/* Empty State */}
      {!imageUrl && !isLoading && (
        <div className='flex flex-col items-center justify-center text-slate-500 gap-4 opacity-70'>
          <Map className='w-12 h-12 mb-2 text-indigo-400/50' />
          <p className='font-light tracking-wide'>
            Search for an address to see it here
          </p>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className='absolute inset-0 bg-white/5 backdrop-blur-sm z-10 flex flex-col items-center justify-center gap-5'>
          <Loader2 className='w-12 h-12 text-pink-400 animate-spin' />
          <p className='text-sm font-medium tracking-widest text-indigo-200 animate-pulse uppercase'>
            Traveling to location...
          </p>
        </div>
      )}

      {/* Image State */}
      {imageUrl && (
        <img
          src={imageUrl}
          alt={`Street view of ${address || 'location'}`}
          onLoad={() => setImgLoaded(true)}
          className={cn(
            'absolute inset-0 w-full h-full object-cover transition-opacity duration-1000',
            imgLoaded && !isLoading ? 'opacity-100' : 'opacity-0',
          )}
        />
      )}

      {/* Overlay gradient for aesthetics */}
      <div className='absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none' />

      {/* Bottom bar: Address + Illustrate button */}
      {imageUrl && imgLoaded && !isLoading && (
        <div className='absolute bottom-6 left-6 right-6 flex items-end justify-between gap-4'>
          {/* Address Label */}
          {address && (
            <div className='inline-block px-5 py-3 bg-black/50 backdrop-blur-xl rounded-xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)] animate-fade-in'>
              <p className='text-white text-sm md:text-base font-medium flex items-center gap-3'>
                <Map className='w-5 h-5 text-pink-400' />
                {address}
              </p>
            </div>
          )}

          {/* Illustrate Button */}
          {onIllustrate && (
            <button
              onClick={onIllustrate}
              disabled={isGenerating}
              className={cn(
                'flex items-center gap-2 px-5 py-3 rounded-xl font-medium text-sm transition-all duration-300 shadow-[0_8px_32px_rgba(0,0,0,0.5)] animate-fade-in',
                isGenerating
                  ? 'bg-indigo-500/30 text-indigo-200 cursor-wait border border-indigo-400/20'
                  : 'bg-gradient-to-r from-indigo-500 to-pink-500 text-white hover:from-indigo-400 hover:to-pink-400 hover:shadow-[0_8px_32px_rgba(99,102,241,0.4)] hover:scale-105 active:scale-95 border border-white/20',
              )}
            >
              {isGenerating ? (
                <>
                  <Loader2 className='w-4 h-4 animate-spin' />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className='w-4 h-4' />
                  Illustrate
                </>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

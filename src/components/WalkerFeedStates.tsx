import React from 'react';
import { Map, Heart } from 'lucide-react';

export function WalkerLoadingState() {
  return (
    <div className='absolute inset-0 z-20 w-full h-full flex flex-col items-center justify-center pointer-events-none'>
       {/* Background subtle pulse mimicking the environment light */}
      <div className='absolute inset-0 bg-stone-300/10 blur-3xl animate-pulse -z-10' />

      {/* Wrapper matching Postcard flex container */}
      <div className='w-[90vw] max-w-[480px] h-full max-h-[80dvh] md:max-h-[85dvh] mx-auto flex items-center justify-center opacity-80'>
        <div className='w-full h-full bg-white shadow-[0_20px_50px_-12px_rgba(0,0,0,0.1)] rounded-sm md:rounded-md flex flex-col p-3 md:p-4 border border-stone-100'>
          
          {/* Image Placeholder Skeleton */}
          <div className='flex-1 relative overflow-hidden rounded-lg bg-stone-200/50 shadow-inner animate-pulse'>
             {/* Fake stamp outline */}
             <div className='absolute top-4 right-4 w-12 h-16 md:w-16 md:h-20 border-[3px] border-stone-300/40 border-dashed rounded -rotate-6' />
          </div>

          {/* Bottom Margin Skeleton */}
          <div className='mt-3 md:mt-4 px-2 flex justify-between items-end'>
            <div className='flex-1 min-w-0 mr-3 flex flex-col gap-2.5 pb-1'>
              <div className='h-5 md:h-6 w-3/4 rounded-sm bg-stone-200 animate-pulse' />
              <div className='h-4 md:h-4 w-1/2 rounded-full bg-stone-200 animate-pulse' />
            </div>
            <div className='flex items-center gap-2 shrink-0'>
              <div className='w-8 h-8 md:w-10 md:h-10 rounded-full bg-stone-200 animate-pulse' />
              <div className='w-8 h-8 md:w-10 md:h-10 rounded-full bg-stone-200 animate-pulse' />
              <div className='w-8 h-8 md:w-10 md:h-10 rounded-full bg-stone-200 animate-pulse' />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function WalkerEmptyState() {
  return (
    <div className='w-full max-w-4xl mx-auto flex flex-col items-center justify-center min-h-[600px] h-full text-white/50 gap-4 glass-panel rounded-3xl bg-black/40 z-20'>
      <Map className='w-12 h-12 mb-2 text-white/30' />
      <p className='font-light tracking-wide text-center px-4'>
        The Postmaster hasn't dispatched any mail for this region yet.
        <br />
        Please try another country or clear the filter.
      </p>
    </div>
  );
}

export function WalkerFavoritesEmptyState() {
  return (
    <div className='w-full max-w-4xl mx-auto flex flex-col items-center justify-center min-h-[600px] h-full gap-3 z-20'>
      <Heart className='w-16 h-16 mb-1 text-rose-300/80 fill-rose-200/40' />
      <p className='text-lg font-medium tracking-wide text-center text-stone-600'>
        No favorites yet
      </p>
      <p className='text-sm font-light text-center text-stone-400'>
        Tap the <span className='text-rose-400'>♥</span> on postcards you love!
      </p>
    </div>
  );
}

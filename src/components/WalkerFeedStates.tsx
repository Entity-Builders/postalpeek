import React from 'react';
import { Loader2, Map, Heart } from 'lucide-react';

export function WalkerLoadingState() {
  return (
    <div className='w-full max-w-4xl mx-auto flex flex-col items-center justify-center min-h-[600px] h-full gap-4 z-20'>
      <Loader2 className='w-8 h-8 text-indigo-400 animate-spin' />
      <p className='text-indigo-200 font-light tracking-widest text-sm uppercase animate-pulse'>
        Synching with Serendipitous Post...
      </p>
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

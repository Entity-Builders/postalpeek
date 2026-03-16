import React from 'react';
import { Map, Route } from 'lucide-react';

export function WalkerLoadingState() {
  return (
    <div className='absolute inset-0 z-20 w-full h-full flex flex-col items-center justify-center pointer-events-none'>
      {/* Warm gradient background that matches the eventual blur backdrop */}
      <div className='absolute inset-0 -z-10 overflow-hidden'>
        <div className='absolute inset-0 bg-gradient-to-br from-stone-200/80 via-amber-100/30 to-stone-300/60 animate-pulse' />
        <div className='absolute inset-0 bg-gradient-to-t from-white/40 to-transparent' />
      </div>

      {/* Wrapper matching Postcard flex container */}
      <div className='w-[90vw] max-w-[480px] h-full max-h-[80dvh] md:max-h-[85dvh] mx-auto flex items-center justify-center'>
        <div className='w-full h-full bg-white/90 backdrop-blur-sm shadow-[0_20px_50px_-12px_rgba(0,0,0,0.15)] rounded-sm md:rounded-md flex flex-col p-3 md:p-4 border border-white/60'>
          
          {/* Image Placeholder Skeleton */}
          <div className='flex-1 relative overflow-hidden rounded-lg bg-gradient-to-br from-stone-200/60 via-stone-100/40 to-stone-200/50 shadow-inner animate-pulse'>
             {/* Fake stamp outline */}
             <div className='absolute top-4 right-4 w-12 h-16 md:w-16 md:h-20 border-[3px] border-stone-300/40 border-dashed rounded -rotate-6' />
          </div>

          {/* Bottom Margin Skeleton */}
          <div className='mt-3 md:mt-4 px-2 flex justify-between items-end'>
            <div className='flex-1 min-w-0 mr-3 flex flex-col gap-2.5 pb-1'>
              <div className='h-5 md:h-6 w-3/4 rounded-sm bg-stone-200/70 animate-pulse' />
              <div className='h-4 md:h-4 w-1/2 rounded-full bg-stone-200/70 animate-pulse' />
            </div>
            <div className='flex items-center gap-2 shrink-0'>
              <div className='w-8 h-8 md:w-10 md:h-10 rounded-full bg-stone-200/70 animate-pulse' />
              <div className='w-8 h-8 md:w-10 md:h-10 rounded-full bg-stone-200/70 animate-pulse' />
              <div className='w-8 h-8 md:w-10 md:h-10 rounded-full bg-stone-200/70 animate-pulse' />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function TripCoverLoadingState() {
  return (
    <div className='absolute inset-0 z-20 w-full h-full flex flex-col items-center justify-center pointer-events-none'>
      {/* Warm gradient background that matches the eventual blur backdrop */}
      <div className='absolute inset-0 -z-10 overflow-hidden'>
        <div className='absolute inset-0 bg-gradient-to-br from-stone-200/80 via-amber-100/30 to-stone-300/60 animate-pulse' />
        <div className='absolute inset-0 bg-gradient-to-t from-white/40 to-transparent' />
      </div>

      <div className='w-[90vw] max-w-[480px] h-full max-h-[88dvh] md:max-h-[85dvh] mx-auto flex items-center justify-center'>
        <div className='w-full h-full bg-white/90 backdrop-blur-sm shadow-[0_20px_50px_-12px_rgba(0,0,0,0.15)] rounded-sm md:rounded-md flex flex-col overflow-hidden border border-white/60'>

          {/* Hero Image Skeleton — warm gradient instead of flat gray */}
          <div className='relative flex-1 min-h-0 overflow-hidden bg-gradient-to-br from-stone-200/60 via-stone-100/40 to-stone-200/50 animate-pulse'>
            {/* Gradient overlay at bottom (matches real component) */}
            <div className='absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-stone-300/40 via-stone-200/20 to-transparent z-10' />

            {/* "VIAJE COMPLETO" badge placeholder */}
            <div className='absolute top-12 left-3 z-20'>
              <div className='h-6 w-32 rounded-full bg-stone-300/50 animate-pulse' />
            </div>

            {/* POST stamp placeholder */}
            <div className='absolute top-4 right-4 w-12 h-16 md:w-16 md:h-20 border-[3px] border-stone-300/30 border-dashed rounded -rotate-6 z-20' />

            {/* Title + location overlay at bottom */}
            <div className='absolute bottom-0 left-0 right-0 z-20 px-4 pb-3 flex flex-col gap-1.5'>
              <div className='h-3 w-36 rounded-full bg-stone-300/40 animate-pulse' />
              <div className='h-6 w-4/5 rounded-sm bg-stone-300/50 animate-pulse' />
              <div className='h-6 w-3/5 rounded-sm bg-stone-300/40 animate-pulse' />
              <div className='flex items-center gap-1.5 mt-0.5'>
                <div className='w-3 h-3 rounded-full bg-stone-300/40 animate-pulse' />
                <div className='h-3 w-28 rounded-full bg-stone-300/40 animate-pulse' />
              </div>
            </div>
          </div>

          {/* Bottom section skeleton */}
          <div className='shrink-0 px-4 md:px-5 py-3 md:py-4 flex flex-col gap-2'>
            <div className='flex flex-col gap-1.5'>
              <div className='h-3 w-full rounded-full bg-stone-200/70 animate-pulse' />
              <div className='h-3 w-5/6 rounded-full bg-stone-200/70 animate-pulse' />
            </div>

            <div className='flex items-start justify-around gap-1 py-1'>
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className='flex flex-col items-center flex-1 min-w-0'>
                  <div className='w-14 h-14 md:w-16 md:h-16 rounded-full bg-stone-200/70 animate-pulse mx-auto' />
                  <div className='h-2 w-10 rounded-full bg-stone-200/70 animate-pulse mt-1' />
                </div>
              ))}
            </div>

            <div className='w-full h-10 rounded-xl bg-stone-200/70 animate-pulse' />
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



export function WalkerTripsEmptyState() {
  return (
    <div className='w-full max-w-4xl mx-auto flex flex-col items-center justify-center min-h-[600px] h-full gap-3 z-20'>
      <Route className='w-16 h-16 mb-1 text-amber-400/80' />
      <p className='text-lg font-medium tracking-wide text-center text-stone-600'>
        No trips yet
      </p>
      <p className='text-sm font-light text-center text-stone-400'>
        The Walker hasn't started any journeys in this region yet.
      </p>
    </div>
  );
}

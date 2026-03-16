import React from 'react';
import { Map, Route, Compass } from 'lucide-react';

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

export function WalkerEmptyState({ onClearFilter }: { onClearFilter?: () => void }) {
  return (
    <div className='absolute inset-0 z-20 w-full h-full flex flex-col items-center justify-center pointer-events-auto px-6'>
      <div className='w-full max-w-[380px] bg-white/60 backdrop-blur-xl border border-white/80 shadow-2xl shadow-black/5 rounded-[32px] p-8 flex flex-col items-center text-center relative overflow-hidden'>
        
        {/* Subtle background glow */}
        <div className="absolute top-8 left-1/2 -translate-x-1/2 w-40 h-40 bg-amber-500/10 rounded-full blur-3xl -z-10" />

        <div className="relative w-24 h-24 mb-6 rounded-full bg-gradient-to-br from-amber-50/80 to-amber-100/30 border border-amber-200/50 flex items-center justify-center shadow-inner">
          <Compass className='w-12 h-12 text-amber-500/80 drop-shadow-sm z-10' strokeWidth={1.5} />
        </div>
        
        <h3 className='font-serif text-2xl md:text-3xl font-medium tracking-tight text-stone-800 mb-3 drop-shadow-sm'>
          Región sin explorar
        </h3>
        
        <p className='text-sm md:text-base font-light text-stone-600 leading-relaxed max-w-[280px] mb-8'>
          Todavía no hay postales disponibles en esta zona. Ayudanos a explorar nuevos lugares o volvé al mapa global.
        </p>

        {onClearFilter && (
          <button 
            onClick={onClearFilter}
            className="group relative px-6 py-3.5 bg-stone-800 hover:bg-stone-900 transition-all duration-300 rounded-full flex items-center gap-2 overflow-hidden shadow-md hover:shadow-lg active:scale-95 cursor-pointer"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-amber-500/0 via-amber-500/10 to-amber-500/0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out" />
            <Map className="w-4 h-4 text-amber-400 group-hover:-translate-y-0.5 transition-transform duration-300" strokeWidth={2.5} />
            <span className="text-sm font-semibold text-white tracking-wide">Everywhere</span>
          </button>
        )}
      </div>
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

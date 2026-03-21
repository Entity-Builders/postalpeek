import { MapPin } from 'lucide-react';

interface CityLabelProps {
  city: string;
  country?: string;
  /** 'scrim' = white text on dark gradient (grid), 'caption' = stone text (below card), 'inline' = compact row */
  variant?: 'scrim' | 'caption' | 'inline';
}

export function CityLabel({ city, country, variant = 'inline' }: CityLabelProps) {
  if (variant === 'scrim') {
    return (
      <div className='flex items-center gap-1'>
        <MapPin className='w-2.5 h-2.5 text-white/80 shrink-0' />
        <p className='text-white/90 text-[10px] font-medium truncate leading-tight drop-shadow-sm'>
          {city}
        </p>
      </div>
    );
  }

  if (variant === 'caption') {
    return (
      <div className='flex items-center gap-1 mt-0.5'>
        <MapPin className='w-2 h-2 text-stone-400 shrink-0' />
        <p className='text-stone-400 text-[9px] truncate'>
          {city}{country ? `, ${country}` : ''}
        </p>
      </div>
    );
  }

  // inline
  return (
    <div className='flex items-center gap-1.5 min-w-0'>
      <MapPin className='w-3.5 h-3.5 text-stone-400 shrink-0' />
      <p className='text-sm md:text-base text-neutral-600 tracking-wide truncate'>
        {city}{country ? `, ${country}` : ''}
      </p>
    </div>
  );
}

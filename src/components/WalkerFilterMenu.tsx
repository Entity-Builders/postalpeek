import React, { useRef, useState } from 'react';
import { Map, MapPin } from 'lucide-react';
import { cn } from './SearchBar';

interface WalkerFilterMenuProps {
  isIdle?: boolean;
  availableCountries: string[];
  selectedCountry: string | null;
  onSelectCountry: (country: string | null) => void;
}

export function WalkerFilterMenu({
  isIdle,
  availableCountries,
  selectedCountry,
  onSelectCountry,
}: WalkerFilterMenuProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const [isDraggingMenu, setIsDraggingMenu] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  // Drag-to-scroll handlers for the horizontal menu on desktop
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!scrollContainerRef.current) return;
    setIsDraggingMenu(true);
    setStartX(e.pageX - scrollContainerRef.current.offsetLeft);
    setScrollLeft(scrollContainerRef.current.scrollLeft);
  };

  const handleMouseLeave = () => {
    setIsDraggingMenu(false);
  };

  const handleMouseUp = () => {
    setIsDraggingMenu(false);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingMenu || !scrollContainerRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollContainerRef.current.offsetLeft;
    const walk = (x - startX) * 2; // Scroll-fast multiplier
    scrollContainerRef.current.scrollLeft = scrollLeft - walk;
  };

  return (
    <div
      className={cn(
        'absolute top-3 left-0 right-0 z-50 px-4 md:px-8 transition-opacity duration-1000',
        isIdle ? 'opacity-0' : 'opacity-100',
      )}
    >
      <div
        ref={scrollContainerRef}
        className='flex items-center gap-2 overflow-x-auto no-scrollbar pb-4 cursor-grab active:cursor-grabbing'
        style={{ WebkitOverflowScrolling: 'touch' }}
        onMouseDown={handleMouseDown}
        onMouseLeave={handleMouseLeave}
        onMouseUp={handleMouseUp}
        onMouseMove={handleMouseMove}
      >
        <button
          onClick={() => onSelectCountry(null)}
          className={cn(
            'flex items-center gap-1.5 whitespace-nowrap px-3 py-1.5 md:px-4 md:py-2 rounded-full text-xs md:text-sm font-medium transition-all backdrop-blur-md border',
            selectedCountry === null
              ? 'bg-white/90 text-indigo-950 border-white shadow-lg'
              : 'bg-black/30 text-white/70 border-white/10 hover:bg-black/40 hover:text-white',
          )}
        >
          <Map className='w-3.5 h-3.5 md:w-4 md:h-4' />
          Everywhere
        </button>

        <div className='w-px h-6 bg-white/20 mx-1 shrink-0' />

        {availableCountries.map((country) => (
          <button
            key={country}
            onClick={() => onSelectCountry(country)}
            className={cn(
              'flex items-center gap-1.5 whitespace-nowrap px-3 py-1.5 md:px-4 md:py-2 rounded-full text-xs md:text-sm font-medium transition-all backdrop-blur-md border',
              selectedCountry === country
                ? 'bg-white/90 text-indigo-950 border-white shadow-lg'
                : 'bg-black/30 text-white/70 border-white/10 hover:bg-black/40 hover:text-white',
            )}
          >
            <MapPin className='w-3 h-3 md:w-3.5 md:h-3.5 opacity-60' />
            {country}
          </button>
        ))}
      </div>
    </div>
  );
}

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@eb-packages/logic/src/supabase';
import { Map, Loader2, MapPin } from 'lucide-react';
import { cn } from './SearchBar';
import { Postcard, FeedItem } from './Postcard';
import useEmblaCarousel from 'embla-carousel-react';

const shuffleArray = <T,>(array: T[]): T[] => {
  const newArr = [...array];
  for (let i = newArr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
  }
  return newArr;
};

export function WalkerFeed({ isIdle }: { isIdle?: boolean }) {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [availableCountries, setAvailableCountries] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const oldestDateRef = useRef<string | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const [isDraggingMenu, setIsDraggingMenu] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  // Default block size
  const PAGE_SIZE = 10;

  // Initialize Embla Carousel with vertical axis, no internal wheel plugin
  const [emblaRef, emblaApi] = useEmblaCarousel({ 
    axis: 'y', 
    align: 'start', 
    skipSnaps: false,
    duration: 30 // Make the programmatic snap slightly faster
  });

  // Fetch unique locations and extract just the countries for the filter menu
  useEffect(() => {
    async function fetchCountries() {
      try {
        const { data, error } = await supabase.rpc('postalpeek_get_distinct_countries');
        if (!error && data) {
          // data is [{ country: 'Japan' }, { country: 'France' }, ...]
          setAvailableCountries(data.map((row: any) => row.country));
        }
      } catch (err) {
        console.error('Failed to load distinct countries', err);
      }
    }
    fetchCountries();
  }, []);

  const fetchInitialFeed = useCallback(async (country: string | null) => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('postalpeek_postcards')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE);

      if (country) {
        query = query.eq('country', country);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      if (data && data.length > 0) {
        oldestDateRef.current = data[data.length - 1].created_at;
        setItems(shuffleArray(data));
        setHasMore(data.length === PAGE_SIZE);
      } else {
        setItems([]);
        setHasMore(false);
      }
    } catch (error) {
      console.error('Error loading initial feed:', error);
    } finally {
      setIsLoading(false);
      // Reset Embla to the first slide when filter changes
      if (emblaApi) emblaApi.scrollTo(0, true);
    }
  }, [emblaApi]);

  const fetchMoreFeed = useCallback(async () => {
    if (isFetchingMore || !hasMore || !oldestDateRef.current) return;
    
    setIsFetchingMore(true);
    try {
      let query = supabase
        .from('postalpeek_postcards')
        .select('*')
        .order('created_at', { ascending: false })
        .lt('created_at', oldestDateRef.current)
        .limit(PAGE_SIZE);

      if (selectedCountry) {
        query = query.eq('country', selectedCountry);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      if (data && data.length > 0) {
        oldestDateRef.current = data[data.length - 1].created_at;
        // Shuffle the newly fetched block so the feed remains unpredictable
        setItems(prev => [...prev, ...shuffleArray(data)]);
        setHasMore(data.length === PAGE_SIZE);
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error('Error fetching more feed:', error);
    } finally {
      setIsFetchingMore(false);
    }
  }, [isFetchingMore, hasMore, selectedCountry]);

  // Initial load when filter changes
  useEffect(() => {
    fetchInitialFeed(selectedCountry);
  }, [fetchInitialFeed, selectedCountry]);

  // Realtime Subscription
  useEffect(() => {
    let mounted = true;

    const subscription = supabase
      .channel('public:postalpeek_postcards')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'postalpeek_postcards' },
        (payload) => {
          if (mounted) {
            const newItem = payload.new as FeedItem;
            // Only prepend if it matches the current country filter (or no filter is set)
            if (!selectedCountry || newItem.country === selectedCountry) {
              setItems(prev => [newItem, ...prev]);
            }
          }
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [selectedCountry]);

  // Re-initialize Embla slides when items change
  useEffect(() => {
    if (emblaApi) emblaApi.reInit();
  }, [emblaApi, items]);

  // Embla specific infinite scroll listener
  useEffect(() => {
    if (!emblaApi) return;
    
    const onSelect = () => {
      // If we are at the last or penultimate slide, fetch more
      if (emblaApi.canScrollNext() === false || emblaApi.selectedScrollSnap() >= emblaApi.scrollSnapList().length - 2) {
        if (hasMore && !isFetchingMore) {
          fetchMoreFeed();
        }
      }
    };

    emblaApi.on('select', onSelect);
    emblaApi.on('scroll', onSelect);

    return () => {
      emblaApi.off('select', onSelect);
      emblaApi.off('scroll', onSelect);
    };
  }, [emblaApi, hasMore, isFetchingMore, fetchMoreFeed]);

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

  // We use a strict time-based debounce to handle high-precision 
  // free-spinning mouse wheels (like the MX Master). This ensures that a single tick 
  // forces a full 1-item jump via Embla API, without Embla interpreting it as a drag.
  const wheelTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    // Only capture vertical scrolling over horizontal
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      if (!emblaApi) return;
      
      // Stop the native scroll 
      e.preventDefault();

      // If we are currently in a cooldown from a previous tick, ignore
      if (wheelTimeout.current) return;

      // Ignore very small movements (trackpad noise)
      if (Math.abs(e.deltaY) < 5) return;

      if (e.deltaY > 0) {
        // Intention to go down
        emblaApi.scrollNext();
      } else {
        // Intention to go up
        emblaApi.scrollPrev();
      }

      // Lock out further wheel events for 600ms to allow the slide animation to finish cleanly
      wheelTimeout.current = setTimeout(() => {
        wheelTimeout.current = null;
      }, 600);
    }
  }, [emblaApi]);

  return (
    <div className='w-full h-full flex flex-col items-center justify-center relative bg-[#e6e2da] overflow-hidden'>
      
      {/* FILTER MENU: Horizontal scrolling glassmorphic pills */}
      <div className={cn(
        "absolute top-6 left-0 right-0 z-50 px-4 md:px-8 transition-opacity duration-1000",
        isIdle ? 'opacity-0' : 'opacity-100'
      )}>
        <div 
          ref={scrollContainerRef}
          className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-4 cursor-grab active:cursor-grabbing" 
          style={{ WebkitOverflowScrolling: 'touch' }}
          onMouseDown={handleMouseDown}
          onMouseLeave={handleMouseLeave}
          onMouseUp={handleMouseUp}
          onMouseMove={handleMouseMove}
        >
          <button
            onClick={() => setSelectedCountry(null)}
            className={cn(
              "flex items-center gap-1.5 whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-all backdrop-blur-md border",
              selectedCountry === null 
                ? "bg-white/90 text-indigo-950 border-white shadow-lg" 
                : "bg-black/30 text-white/70 border-white/10 hover:bg-black/40 hover:text-white"
            )}
          >
            <Map className="w-4 h-4" />
            Everywhere
          </button>
          
          <div className="w-px h-6 bg-white/20 mx-1 shrink-0" />
          
          {availableCountries.map(country => (
            <button
              key={country}
              onClick={() => setSelectedCountry(country)}
              className={cn(
                "flex items-center gap-1.5 whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-all backdrop-blur-md border",
                selectedCountry === country 
                  ? "bg-white/90 text-indigo-950 border-white shadow-lg" 
                  : "bg-black/30 text-white/70 border-white/10 hover:bg-black/40 hover:text-white"
              )}
            >
              <MapPin className="w-3 h-3 opacity-60" />
              {country}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className='w-full max-w-4xl mx-auto flex flex-col items-center justify-center min-h-[600px] h-full gap-4 z-20'>
          <Loader2 className='w-8 h-8 text-indigo-400 animate-spin' />
          <p className='text-indigo-200 font-light tracking-widest text-sm uppercase animate-pulse'>Synching with Serendipitous Post...</p>
        </div>
      ) : items.length === 0 ? (
        <div className='w-full max-w-4xl mx-auto flex flex-col items-center justify-center min-h-[600px] h-full text-white/50 gap-4 glass-panel rounded-3xl bg-black/40 z-20'>
          <Map className='w-12 h-12 mb-2 text-white/30' />
          <p className='font-light tracking-wide text-center px-4'>
            The Postmaster hasn't dispatched any mail for this region yet.<br/>Please try another country or clear the filter.
          </p>
        </div>
      ) : (
        <div 
          className="embla absolute inset-0 w-full h-full overflow-hidden" 
          ref={emblaRef}
          onWheel={handleWheel}
        >
          <div className="embla__container h-full flex flex-col">
            {items.map((item, index) => {
              return (
                <div
                  key={`${item.id}-${index}`}     
                  className="embla__slide w-full h-[100dvh] shrink-0 flex items-center justify-center relative"
                >
                  {/* 1. THE ENVIRONMENT LIGHTING (Soft Background PER ITEM so it scrolls natively) */}
                  <img
                     src={item.illustration_url}
                     alt=""
                     className="absolute inset-0 w-full h-full object-cover blur-[100px] brightness-125 saturate-[0.8] pointer-events-none z-0 scale-125 transform-gpu"
                  />
                  {/* Soft light burst in center behind card */}
                  <div className="absolute inset-0 z-[1] pointer-events-none bg-radial-gradient from-white/40 via-transparent to-transparent opacity-80" />
                  
                  {/* 2. THE POSTCARD */}
                  <div className="z-10 w-full h-full flex items-center justify-center pt-8">
                    <Postcard item={item} isActive={true} />
                  </div>
                </div>
              );
            })}
            
            {/* Loading indicator at bottom */}
            {isFetchingMore && (
              <div className="embla__slide w-full h-[30vh] shrink-0 flex items-center justify-center relative">
                <Loader2 className="w-6 h-6 text-indigo-900/50 animate-spin" />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

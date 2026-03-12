import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@eb-packages/logic/src/supabase';
import { Map, Loader2, MapPin } from 'lucide-react';
import { cn } from './SearchBar';
import { Postcard, FeedItem } from './Postcard';

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
  // Separate ref for the vertical feed container
  const feedContainerRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const [isDraggingMenu, setIsDraggingMenu] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  // Default block size
  const PAGE_SIZE = 10;

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
      // Reset scroll to top when filter changes
      if (feedContainerRef.current) {
        feedContainerRef.current.scrollTop = 0;
      }
    }
  }, []);

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

  // Intersection Observer to trigger fetchMoreFeed
  const lastItemRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (isFetchingMore) return;
      if (observerRef.current) observerRef.current.disconnect();

      observerRef.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasMore) {
          fetchMoreFeed();
        }
      });

      if (node) observerRef.current.observe(node);
    },
    [isFetchingMore, hasMore, fetchMoreFeed]
  );

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
          ref={feedContainerRef}
          className="absolute inset-0 w-full h-full overflow-y-auto overflow-x-hidden snap-y snap-mandatory no-scrollbar"
        >
           {items.map((item, index) => {
             const isLastItem = index === items.length - 1;

             return (
               <div
                 key={`${item.id}-${index}`}     
                 ref={isLastItem ? lastItemRef : null}
                 className="w-full h-full shrink-0 flex items-center justify-center snap-always snap-center relative"
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
             <div className="w-full h-32 flex items-center justify-center shrink-0">
               <Loader2 className="w-6 h-6 text-white/50 animate-spin" />
             </div>
           )}
        </div>
      )}
    </div>
  );
}

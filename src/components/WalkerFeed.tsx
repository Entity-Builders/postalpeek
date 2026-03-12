import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@eb-packages/logic/src/supabase';
import { Map, Loader2, ChevronLeft, ChevronRight, Pause, Play, MapPin } from 'lucide-react';
import { cn } from './SearchBar';
import { motion, AnimatePresence } from 'framer-motion';
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
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const oldestDateRef = useRef<string | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isDraggingMenu, setIsDraggingMenu] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

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
        .limit(20);

      if (country) {
        query = query.eq('country', country);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      if (data && data.length > 0) {
        oldestDateRef.current = data[data.length - 1].created_at;
        setItems(shuffleArray(data));
        setHasMore(data.length === 20);
      } else {
        setItems([]);
        setHasMore(false);
      }
    } catch (error) {
      console.error('Error loading initial feed:', error);
    } finally {
      setIsLoading(false);
      setCurrentIndex(0);
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
        .limit(20);

      if (selectedCountry) {
        query = query.eq('country', selectedCountry);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      if (data && data.length > 0) {
        oldestDateRef.current = data[data.length - 1].created_at;
        // Shuffle the newly fetched block so the feed remains unpredictable
        setItems(prev => [...prev, ...shuffleArray(data)]);
        setHasMore(data.length === 20);
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
              setCurrentIndex(0); // Jump back to the brand new postcard
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

  // Carousel auto-advance
  useEffect(() => {
    if (items.length <= 1 || isPaused) return;

    const interval = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % items.length);
    }, 25000);

    return () => clearInterval(interval);
  }, [items.length, isPaused]);

  // Trigger paginated fetch when approaching end
  useEffect(() => {
    if (items.length > 0 && currentIndex >= items.length - 4 && hasMore && !isFetchingMore) {
      fetchMoreFeed();
    }
  }, [currentIndex, items.length, hasMore, isFetchingMore, fetchMoreFeed]);

  const goNext = () => {
    setIsPaused(true);
    setCurrentIndex(prev => (prev + 1) % items.length);
  };

  const goPrev = () => {
    setIsPaused(true);
    setCurrentIndex(prev => (prev - 1 + items.length) % items.length);
  };

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

  const currentItem = items[currentIndex];

  return (
    <div className='w-full h-full flex flex-col items-center justify-center relative overflow-hidden bg-[#e6e2da]'>
      
      {/* FILTER MENU: Horizontal scrolling glassmorphic pills */}
      <div className={cn(
        "absolute top-6 left-0 right-0 z-40 px-4 md:px-8 transition-opacity duration-1000",
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
        <div className='w-full max-w-4xl mx-auto flex flex-col items-center justify-center min-h-[600px] gap-4 z-20'>
          <Loader2 className='w-8 h-8 text-indigo-400 animate-spin' />
          <p className='text-indigo-200 font-light tracking-widest text-sm uppercase animate-pulse'>Synching with Serendipitous Post...</p>
        </div>
      ) : items.length === 0 ? (
        <div className='w-full max-w-4xl mx-auto flex flex-col items-center justify-center min-h-[600px] text-white/50 gap-4 glass-panel rounded-3xl bg-black/40 z-20'>
          <Map className='w-12 h-12 mb-2 text-white/30' />
          <p className='font-light tracking-wide text-center px-4'>
            The Postmaster hasn't dispatched any mail for this region yet.<br/>Please try another country or clear the filter.
          </p>
        </div>
      ) : (
        <>
          {/* 1. THE ENVIRONMENT LIGHTING (Soft Background) */}
          <AnimatePresence mode="popLayout" initial={false}>
            {currentItem && (
              <motion.img
                key={`bg-${currentItem.id}`}
                src={currentItem.illustration_url}
                alt=""
                initial={{ opacity: 0, scale: 1.1 }}
                animate={{ opacity: 0.15, scale: 1.25 }}
                exit={{ opacity: 0 }}
                transition={{ 
                  opacity: { duration: 1.5, ease: "easeInOut" },
                  scale: { duration: 40, ease: "linear" }
                }}
                className="fixed inset-0 w-full h-full object-cover blur-[100px] brightness-125 saturate-[0.8] pointer-events-none z-0 transform-gpu"
              />
            )}
          </AnimatePresence>

          {/* Soft light burst in center behind cards */}
          <div className="absolute inset-0 z-[1] pointer-events-none bg-radial-gradient from-white/40 via-transparent to-transparent opacity-80" />

          {/* 2. THE POSTCARDS CONTAINER (Horizontal Scroll simulation) */}
          <div className='absolute inset-0 flex items-center justify-center w-full h-full perspective-1000 z-10'>
             {items.map((item, index) => {
               const offset = index - currentIndex;
               // Limit rendering overhead
               if (Math.abs(offset) > 2) return null;

               const isActive = offset === 0;

               return (
                 <motion.div
                   key={item.id}
                   className="absolute flex items-center justify-center w-full h-full pt-12" // Add padding top to account for filter menu
                   initial={false}
                   animate={{
                     x: `${offset * 110}%`,
                     scale: isActive ? 1 : 0.85,
                     opacity: isActive ? 1 : 0.3,
                     zIndex: isActive ? 10 : 5 - Math.abs(offset),
                     rotateY: offset * -15 // Give a little cover-flow angle
                   }}
                   transition={{ type: "spring", stiffness: 100, damping: 20 }}
                 >
                    <Postcard item={item} isActive={isActive} />
                 </motion.div>
               );
             })}
          </div>

           {/* 3. NAVIGATION CONTROLS (Fades on idle) */}
          <div className={cn(
            'absolute inset-y-0 left-0 w-24 flex items-center justify-center pointer-events-none transition-opacity duration-1000 z-20',
            isIdle ? 'opacity-0' : 'opacity-100'
          )}>
             <button onClick={goPrev} disabled={items.length <= 1} className="pointer-events-auto p-4 rounded-full bg-white/5 text-white/50 hover:bg-white/10 hover:text-white hover:scale-110 transition-all backdrop-blur-md border border-white/10 shadow-2xl">
                <ChevronLeft className="w-8 h-8 md:w-10 md:h-10" />
             </button>
          </div>

          <div className={cn(
            'absolute inset-y-0 right-0 w-24 flex items-center justify-center pointer-events-none transition-opacity duration-1000 z-20',
            isIdle ? 'opacity-0' : 'opacity-100'
          )}>
             <button onClick={goNext} disabled={items.length <= 1} className="pointer-events-auto p-4 rounded-full bg-white/5 text-white/50 hover:bg-white/10 hover:text-white hover:scale-110 transition-all backdrop-blur-md border border-white/10 shadow-2xl">
                <ChevronRight className="w-8 h-8 md:w-10 md:h-10" />
             </button>
          </div>

          {/* Play/Pause control (bottom right corner) */}
          <div className={cn(
            'absolute bottom-10 right-10 pointer-events-none transition-opacity duration-1000 z-20',
            isIdle ? 'opacity-0' : 'opacity-100'
          )}>
            <button onClick={() => setIsPaused(!isPaused)} className="pointer-events-auto p-3 rounded-full bg-black/40 text-white/50 hover:bg-white/20 hover:text-white transition-all backdrop-blur-md border border-white/5 disabled:opacity-50">
              {isPaused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

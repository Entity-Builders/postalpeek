import React, { useState, useEffect } from 'react';
import { supabase } from '@eb-packages/logic/src/supabase';
import { Map, Loader2, Sparkles, ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import { cn } from './SearchBar';
import { motion, AnimatePresence } from 'framer-motion';

interface FeedItem {
  id: string;
  location_name: string;
  lat: number;
  lng: number;
  original_image_url: string;
  illustration_url: string;
  category: string;
  description: string;
  created_at: string;
  metadata?: Record<string, unknown>;
}

export function WalkerFeed({ isIdle }: { isIdle?: boolean }) {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [isHoveringHUD, setIsHoveringHUD] = useState(false);

  // We no longer hide the HUD automatically based on time
  const isHUDHidden = false;

  // Fetch initial feed and subscribe
  useEffect(() => {
    let mounted = true;

    async function loadFeed() {
      try {
        const { data, error } = await supabase
          .from('postalpeek_feed')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(10);

        if (error) throw error;
        
        if (mounted && data) {
          setItems(data);
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Error loading feed:', error);
        if (mounted) setIsLoading(false);
      }
    }

    loadFeed();

    const subscription = supabase
      .channel('public:postalpeek_feed')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'postalpeek_feed' },
        (payload) => {
          if (mounted) {
            const newItem = payload.new as FeedItem;
            setItems(prev => [newItem, ...prev]);
            setCurrentIndex(0); // Jump to newest
          }
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Carousel loop
  useEffect(() => {
    if (items.length <= 1 || isPaused) return;

    const interval = setInterval(() => {
      // Move to NEXT older item (currentIndex + 1)
      setCurrentIndex(prev => (prev + 1) % items.length);
    }, 25000);

    return () => clearInterval(interval);
  }, [items.length, isPaused]);

  if (isLoading) {
    return (
      <div className='w-full max-w-4xl mx-auto flex flex-col items-center justify-center min-h-[600px] gap-4'>
        <Loader2 className='w-8 h-8 text-indigo-400 animate-spin' />
        <p className='text-indigo-200 font-light tracking-widest text-sm uppercase animate-pulse'>Synching with Walker Engine...</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className='w-full max-w-4xl mx-auto flex flex-col items-center justify-center min-h-[600px] text-slate-500 gap-4 glass-panel rounded-3xl bg-black/40'>
        <Map className='w-12 h-12 mb-2 text-indigo-400/50' />
        <p className='font-light tracking-wide text-center px-4'>
          The Walker hasn't found any locations yet.<br/>Please wait until the background engine finishes its first cycle.
        </p>
      </div>
    );
  }

  const currentItem = items[currentIndex];

  const goNext = () => {
    setIsPaused(true);
    setCurrentIndex(prev => (prev + 1) % items.length);
  };

  const goPrev = () => {
    setIsPaused(true);
    setCurrentIndex(prev => (prev - 1 + items.length) % items.length);
  };

  return (
    <div className='w-full h-full flex flex-col items-center justify-center relative overflow-hidden'>
      
      {/* 1. THE DYNAMIC FRAME (Pasepartout) */}
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.img
          key={`bg-${currentItem.id}`}
          src={currentItem.illustration_url}
          alt=""
          initial={{ opacity: 0, scale: 1 }}
          animate={{ opacity: 0.8, scale: 1.1 }}
          exit={{ opacity: 0 }}
          transition={{ 
            opacity: { duration: 2.5, ease: "easeInOut" },
            scale: { duration: 30, ease: "linear" }
          }}
          className="fixed inset-0 w-full h-full object-cover blur-[80px] brightness-50 saturate-150 pointer-events-none z-[-1] will-change-transform"
        />
      </AnimatePresence>

      {/* 2. MAIN ARTWORK CONTAINER */}
      <div className='absolute inset-0 w-full h-full group'>
        
        {/* Cinematic Image Crossfade & Zoom (Ken Burns Effect) */}
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.img
            key={`img-${currentItem.id}`}
            src={currentItem.illustration_url}
            alt="Generated Art"
            initial={{ opacity: 0, scale: 1 }}
            animate={{ opacity: 1, scale: 1.08 }}
            exit={{ opacity: 0 }}
            transition={{ 
              opacity: { duration: 2, ease: "easeInOut" },
              scale: { duration: 30, ease: "linear" }
            }}
            className="absolute inset-0 w-full h-full object-cover drop-shadow-2xl will-change-transform [backface-visibility:hidden]"
          />
        </AnimatePresence>

        {/* Global Dark Gradient Overlay for text readability */}
        <div className={cn(
          'absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent pointer-events-none transition-opacity duration-1000 z-10',
          isIdle || isHUDHidden ? 'opacity-0' : 'opacity-100'
        )} />

        {/* 3. NAVIGATION CONTROLS (Fades on idle) */}
        <div className={cn(
          'absolute inset-y-0 left-0 flex items-center px-4 md:px-8 pointer-events-none transition-opacity duration-1000 z-20',
          isIdle ? 'opacity-0' : 'opacity-100'
        )}>
           <button onClick={goPrev} disabled={items.length <= 1} className="pointer-events-auto p-3 rounded-full bg-black/40 text-white/50 hover:bg-white/20 hover:text-white hover:scale-110 transition-all backdrop-blur-md">
             <ChevronLeft className="w-8 h-8" />
           </button>
        </div>
        <div className={cn(
          'absolute inset-y-0 right-0 flex items-center px-4 md:px-8 pointer-events-none transition-opacity duration-1000 z-20',
          isIdle ? 'opacity-0' : 'opacity-100'
        )}>
           <button onClick={goNext} disabled={items.length <= 1} className="pointer-events-auto p-3 rounded-full bg-black/40 text-white/50 hover:bg-white/20 hover:text-white hover:scale-110 transition-all backdrop-blur-md">
             <ChevronRight className="w-8 h-8" />
           </button>
        </div>

        {/* Play/Pause control (bottom right corner) */}
        <div className={cn(
          'absolute bottom-10 right-6 md:right-10 pointer-events-none transition-opacity duration-1000 z-20',
          isIdle ? 'opacity-0' : 'opacity-100'
        )}>
          <button onClick={() => setIsPaused(!isPaused)} className="pointer-events-auto p-3 rounded-full bg-black/40 text-white/50 hover:bg-white/20 hover:text-white transition-all backdrop-blur-md border border-white/5">
            {isPaused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
          </button>
        </div>

        {/* Information HUD (Fades on idle) */}
        <div 
          onMouseEnter={() => setIsHoveringHUD(true)}
          onMouseLeave={() => setIsHoveringHUD(false)}
          className={cn(
            'absolute bottom-0 left-0 right-0 p-8 pb-12 md:pb-16 md:p-12 flex flex-col items-start justify-end transition-all duration-1000 transform z-20',
            (isIdle || isHUDHidden) && !isHoveringHUD ? 'opacity-0 translate-y-8 pointer-events-none' : 'opacity-100 translate-y-0 pointer-events-auto'
          )}
        >
           {/* Header Status */}
          <div className='flex items-center gap-3 text-emerald-300 glass-panel px-4 py-1.5 rounded-full bg-black/40 border border-white/10 mb-5 shadow-xl backdrop-blur-md'>
            <Sparkles className='w-4 h-4' />
            <span className='font-medium tracking-widest text-xs uppercase drop-shadow-md'>{currentItem.category}</span>
            {isPaused && <span className="text-white/50 text-[10px] ml-1 tracking-wide font-normal">(PAUSED)</span>}
          </div>

          {/* Clickable Location Link */}
          <a 
            href={`https://www.google.com/maps/search/?api=1&query=${currentItem.lat},${currentItem.lng}`}
            target="_blank"
            rel="noopener noreferrer"
            className='pointer-events-auto block transition-all hover:scale-[1.01] hover:text-indigo-200'
          >
            {/* Poetic Description */}
            <div className='max-w-3xl mb-4'>
              <motion.p 
                key={`desc-${currentItem.id}`}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1, delay: 0.5 }}
                className='text-xl md:text-3xl font-story italic text-white/95 leading-relaxed drop-shadow-2xl text-left'
              >
                "{currentItem.description}"
              </motion.p>
            </div>

            {/* Location details */}
            <div className='flex items-center gap-2'>
              <Map className='w-4 h-4 text-indigo-400 drop-shadow-md' />
              <p className='text-white/80 text-xs md:text-sm uppercase tracking-widest font-semibold text-left drop-shadow-xl'>
                {currentItem.location_name}
              </p>
            </div>
          </a>
        </div>
      </div>
    </div>
  );
}

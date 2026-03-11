import React, { useState, useEffect } from 'react';
import { supabase } from '@eb-packages/logic/src/supabase';
import { Map, Loader2, ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import { cn } from './SearchBar';
import { motion, AnimatePresence } from 'framer-motion';
import { Postcard, FeedItem } from './Postcard';

export function WalkerFeed({ isIdle }: { isIdle?: boolean }) {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isPaused, setIsPaused] = useState(false);

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
        <p className='text-indigo-200 font-light tracking-widest text-sm uppercase animate-pulse'>Synching with Serendipitous Post...</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className='w-full max-w-4xl mx-auto flex flex-col items-center justify-center min-h-[600px] text-slate-500 gap-4 glass-panel rounded-3xl bg-black/40'>
        <Map className='w-12 h-12 mb-2 text-indigo-400/50' />
        <p className='font-light tracking-wide text-center px-4'>
          The Postmaster hasn't dispatched any mail yet.<br/>Please wait until the background engine finishes its first cycle.
        </p>
      </div>
    );
  }

  const goNext = () => {
    setIsPaused(true);
    setCurrentIndex(prev => (prev + 1) % items.length);
  };

  const goPrev = () => {
    setIsPaused(true);
    setCurrentIndex(prev => (prev - 1 + items.length) % items.length);
  };

  const currentItem = items[currentIndex];

  return (
    <div className='w-full h-full flex flex-col items-center justify-center relative overflow-hidden bg-[#e6e2da]'>
      
      {/* 1. THE ENVIRONMENT LIGHTING (Soft Background) */}
      <AnimatePresence mode="popLayout" initial={false}>
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
      </AnimatePresence>

      {/* Soft light burst in center behind cards */}
      <div className="absolute inset-0 z-[1] pointer-events-none bg-radial-gradient from-white/40 via-transparent to-transparent opacity-80" />

      {/* 2. THE POSTCARDS CONTAINER (Horizontal Scroll simulation) */}
      <div className='absolute inset-0 flex items-center justify-center w-full h-full perspective-1000 z-10'>
         {/* Render current, previous, and next to give a sense of depth (Optional nice-to-have, but for MVP we render all and offset) */}
         {items.map((item, index) => {
           const offset = index - currentIndex;
           // Only render items close to current to save DOM nodes
           if (Math.abs(offset) > 2) return null;

           const isActive = offset === 0;

           return (
             <motion.div
               key={item.id}
               className="absolute flex items-center justify-center w-full h-full"
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

    </div>
  );
}

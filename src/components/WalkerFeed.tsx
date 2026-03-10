import React, { useState, useEffect } from 'react';
import { supabase } from '@eb-packages/logic/src/supabase';
import { Map, Loader2, Sparkles, Navigation } from 'lucide-react';
import { cn } from './SearchBar';

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
}

export function WalkerFeed() {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [showIllustration, setShowIllustration] = useState(false);

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
          // Start the illustration reveal sequence for the first item
          setTimeout(() => {
            if (mounted) setShowIllustration(true);
          }, 2000);
        }
      } catch (error) {
        console.error('Error loading feed:', error);
        if (mounted) setIsLoading(false);
      }
    }

    loadFeed();

    // Subscribe to new items
    const subscription = supabase
      .channel('public:postalpeek_feed')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'postalpeek_feed' },
        (payload) => {
          if (mounted) {
            const newItem = payload.new as FeedItem;
            // Add new item to the top of the list, move user to it
            setItems(prev => [newItem, ...prev]);
            setCurrentIndex(0);
            setShowIllustration(false);
            setTimeout(() => {
              if (mounted) setShowIllustration(true);
            }, 2000);
          }
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Set up the carousel loop
  useEffect(() => {
    if (items.length <= 1) return;

    const interval = setInterval(() => {
      setShowIllustration(false); // hide illustration
      
      setTimeout(() => {
        // Move to next item after illustration hides
        setCurrentIndex(prev => (prev + 1) % items.length);
        
        // Show next illustration after a delay
        setTimeout(() => {
          setShowIllustration(true);
        }, 2000);
      }, 1000);

    }, 15000); // Spend 15 seconds per item

    return () => clearInterval(interval);
  }, [items.length]);

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

  return (
    <div className='w-full max-w-4xl mx-auto flex flex-col items-center justify-center min-h-[600px]'>
      
      {/* Header Status */}
      <div className='mb-6 h-8 flex items-center justify-center transition-all duration-300'>
        {!showIllustration ? (
          <div className='flex items-center gap-2 text-indigo-300 animate-pulse'>
            <Navigation className='w-4 h-4' />
            <span className='font-light tracking-widest text-sm uppercase'>Observing environment...</span>
          </div>
        ) : (
          <div className='flex items-center gap-2 text-emerald-300 animate-fade-in'>
            <Sparkles className='w-4 h-4' />
            <span className='font-medium tracking-widest text-sm uppercase'>{currentItem.category}</span>
          </div>
        )}
      </div>

      {/* Main Visual Container */}
      <div className='w-full relative rounded-3xl overflow-hidden glass-panel shadow-[0_32px_64px_rgba(0,0,0,0.5)] bg-black/40 aspect-[4/3] md:aspect-video transition-all duration-700 ease-in-out hover:scale-[1.01]'>
        
        {/* Generated Illustration (Always visible, no original photo swap) */}
        <img
          key={`illus-${currentItem.id}`}
          src={currentItem.illustration_url}
          alt="Generated Art"
          className={cn(
            'absolute inset-0 w-full h-full object-cover transition-opacity duration-1000',
            showIllustration ? 'opacity-100' : 'opacity-0'
          )}
        />

        {/* Global Dark Gradient Overlay for text readability */}
        <div className='absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent pointer-events-none' />

        {/* Information Overlay */}
        <div className='absolute bottom-0 left-0 right-0 p-6 flex flex-col items-start justify-end pointer-events-none'>
          
          {/* Poetic Description (Only shown when REVEALED) */}
          <div className={cn(
            'transition-all duration-1000 delay-500 transform max-w-lg mb-1',
            showIllustration ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
          )}>
            <p className='text-[11px] md:text-xs font-light text-white/70 leading-relaxed drop-shadow-md text-left'>
              "{currentItem.description}"
            </p>
          </div>

          {/* Location details */}
          <div className={cn(
            'transition-all duration-1000 transform translate-y-0 opacity-100'
          )}>
            <p className='text-white/40 text-[8px] md:text-[9px] uppercase tracking-widest font-medium flex items-center gap-1.5 text-left'>
              <Map className='w-2.5 h-2.5 text-indigo-400/50' />
              {currentItem.location_name}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

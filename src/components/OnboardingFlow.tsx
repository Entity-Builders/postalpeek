import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useOnboarding } from '../contexts/OnboardingContext';
import { useGameMode } from '../contexts/GameModeContext';
import { WalkerWelcomeAnimated } from './WalkerWelcomeAnimated';
import { FeedItem, Postcard } from './Postcard';
import { StampHuntOverlay, StampHuntBottomPanel, useStampHunt } from './StampHuntGame';
import useEmblaCarousel from 'embla-carousel-react';
import { AmbientBackground } from './ui/AmbientBackground';
import confetti from 'canvas-confetti';

// Mock high-quality starter postcards for the tutorial
const TUTORIAL_CARDS: FeedItem[] = [
  {
    id: 'tut-1',
    created_at: new Date().toISOString(),
    owner_id: null,
    album_id: undefined,
    country: 'Japan',
    city: 'Tokyo',
    lat: 35.6762,
    lng: 139.6503,
    original_image_url: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?auto=format&fit=crop&w=600&q=80',
    category: 'LANDMARK',
    illustration_url: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?auto=format&fit=crop&w=600&q=80',
    description: 'A vibrant street in Tokyo.',
    stamp_cost: 100,
  },
  {
    id: 'tut-2',
    created_at: new Date().toISOString(),
    owner_id: null,
    album_id: undefined,
    country: 'France',
    city: 'Paris',
    lat: 48.8566,
    lng: 2.3522,
    original_image_url: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=600&q=80',
    category: 'CITYSCAPE',
    illustration_url: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=600&q=80',
    description: 'The iconic Eiffel Tower at sunset.',
    stamp_cost: 100,
  },
  {
    id: 'tut-3',
    created_at: new Date().toISOString(),
    owner_id: null,
    album_id: undefined,
    country: 'USA',
    city: 'New York',
    lat: 40.7128,
    lng: -74.0060,
    original_image_url: 'https://images.unsplash.com/photo-1485871981521-5b1fd3805eee?auto=format&fit=crop&w=600&q=80',
    category: 'ARCHITECTURE',
    illustration_url: 'https://images.unsplash.com/photo-1485871981521-5b1fd3805eee?auto=format&fit=crop&w=600&q=80',
    description: 'New York skyline.',
    stamp_cost: 100,
  }
];

export function OnboardingFlow() {
  const { tutorialStep, setTutorialStep, tutorialStamps, setTutorialStamps, completeOnboarding } = useOnboarding();
  const [claimedId, setClaimedId] = useState<string | null>(null);
  
  // ── Step 1: Welcome ──
  if (tutorialStep === 'welcome') {
    return (
      <WalkerWelcomeAnimated 
        previewCards={TUTORIAL_CARDS} 
        onStartOnboarding={() => {
          setTutorialStamps(500);
          setTutorialStep('carousel');
          
          confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.3 },
            colors: ['#ef4444', '#f59e0b', '#10b981'] // Stamp colors
          });
        }} 
      />
    );
  }

  // ── Step 2 & 3: Carousel and Game ──
  return (
    <div className="absolute inset-0 w-full h-full bg-stone-900 overflow-hidden">
      <AmbientBackground imageUrl={TUTORIAL_CARDS[0].illustration_url} />
      
      {/* Onboarding Header overlay */}
      <div className="absolute top-12 left-0 right-0 z-50 px-6 pointer-events-none flex justify-between items-center">
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/90 backdrop-blur-md px-4 py-2 rounded-full shadow-lg border border-stone-200"
        >
          <span className="text-stone-800 font-bold text-sm tracking-tight flex items-center gap-2">
            📮 {tutorialStamps}
          </span>
        </motion.div>
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-blue-600 text-white px-4 py-2 rounded-2xl shadow-lg border border-white/20 max-w-[200px]"
        >
          <p className="text-xs font-medium leading-tight">
            {tutorialStep === 'carousel' 
              ? 'Walker: Elegí la postal que más te guste y comprala 👇' 
              : 'Walker: ¡Ojo con gastar todo! Jugá este minijuego para recuperar sellos 👇'
            }
          </p>
        </motion.div>
      </div>

      <TutorialCarousel 
        cards={TUTORIAL_CARDS} 
        claimedId={claimedId}
        onClaim={(id) => {
          setClaimedId(id);
          setTutorialStamps(prev => prev - 100);
          setTimeout(() => setTutorialStep('game'), 1500); // Transition to game after stamp animation
        }}
        showGame={tutorialStep === 'game'}
        onGameComplete={() => {
          setTutorialStamps(prev => prev + 50);
          setTimeout(() => {
            completeOnboarding();
          }, 2000);
        }}
      />
    </div>
  );
}

// ── Isolated Tutorial Carousel ──
function TutorialCarousel({ 
  cards, 
  claimedId,
  onClaim,
  showGame,
  onGameComplete
}: { 
  cards: FeedItem[], 
  claimedId: string | null,
  onClaim: (id: string) => void,
  showGame: boolean,
  onGameComplete: () => void
}) {
  const { setGameActive } = useGameMode();
  const [emblaRef, emblaApi] = useEmblaCarousel({ axis: 'y' });
  const [currentIndex, setCurrentIndex] = useState(0);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (emblaApi) {
      emblaApi.on('select', () => setCurrentIndex(emblaApi.selectedScrollSnap()));
    }
  }, [emblaApi]);

  // Lock scrolling when game starts
  useEffect(() => {
    if (showGame) {
      setGameActive(true);
      emblaApi?.reInit({ watchDrag: false });
    } else {
      setGameActive(false);
      emblaApi?.reInit({ watchDrag: true });
    }
  }, [showGame, emblaApi, setGameActive]);

  return (
    <div className='embla absolute inset-0 w-full h-full' ref={emblaRef}>
      <div className='embla__container h-full flex flex-col'>
        {cards.map((item, index) => (
          <div key={item.id} className='embla__slide w-full h-[100dvh] shrink-0 flex items-center justify-center relative'>
            <div 
               className='z-10 mx-auto flex items-center justify-center transition-all duration-500 ease-in-out'
               style={{ 
                 aspectRatio: '4/5',
                 width: 'min(95vw, 520px, 80dvh * 4/5)'
               }}
            >
              <Postcard
                item={item}
                isActive={index === currentIndex}
                isPriority={true}
                isAdmin={false}
                favoriteIds={new Set()}
                isClaimedByMe={claimedId === item.id}
                hasOwner={claimedId === item.id}
                onClaimPostcard={() => onClaim(item.id)}
                userId="tutorial-user"
                showClaimGuide={index === currentIndex && !claimedId}
                isTutorial={true}
              />
              
              {showGame && index === currentIndex && (
                <TutorialGameWrapper 
                  key={`game-${retryKey}`} 
                  item={item} 
                  onComplete={onGameComplete} 
                  onRetry={() => setRetryKey(k => k + 1)} 
                />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Isolated Game Wrapper (Renders as Fullscreen Portal) ──
function TutorialGameWrapper({ item, onComplete, onRetry }: { item: FeedItem, onComplete: () => void, onRetry: () => void }) {
  const hunt = useStampHunt(item);
  
  // Custom completion handler for tutorial
  const handleClose = (won: boolean) => {
    if (won) {
      confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
      onComplete();
    } else {
      onRetry();
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed inset-0 z-[100] bg-[#e6e2da] overflow-hidden flex flex-col"
    >
      <div className="flex-1 w-full max-w-[480px] mx-auto relative pt-[4.5rem] pb-8 px-4 md:px-6 flex flex-col">
        <div className="flex-1 w-full min-h-0 relative flex flex-col p-0">
          
          <div className="relative flex-1 min-h-0 w-full">
            <div className="relative w-full h-full overflow-hidden rounded-xl bg-stone-200 shadow-xl">
              <img src={item.illustration_url!} className="absolute inset-0 w-full h-full object-cover" alt="" />
              <StampHuntOverlay hunt={hunt} imageUrl={item.illustration_url!} />
            </div>
          </div>

          <div className="w-full pt-2 pb-6 shrink-0 z-50 pointer-events-auto">
            <StampHuntBottomPanel item={item} hunt={hunt} onClose={handleClose} />
          </div>

        </div>
      </div>
    </motion.div>
  );
}

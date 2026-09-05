import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { useOnboarding } from '../contexts/OnboardingContext';
import { useGameMode } from '../contexts/GameModeContext';
import { WalkerWelcomeAnimated } from './WalkerWelcomeAnimated';
import { FeedItem, Postcard } from './Postcard';
import { StampHuntOverlay, StampHuntBottomPanel } from './StampHuntGame';
import { useStampHunt } from '../hooks/useStampHunt';
import useEmblaCarousel from 'embla-carousel-react';
import { AmbientBackground } from './ui/AmbientBackground';
import confetti from 'canvas-confetti';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';

const TUTORIAL_CARDS: FeedItem[] = [
  {
    id: 'd68a9bb5-4ee4-4573-8f5a-0aba38a740b0',
    created_at: '2026-03-12T19:57:20.424951+00:00',
    owner_id: null,
    country: 'Argentina',
    city: 'Vicente López',
    location_name: 'Paraíso Natural',
    lat: -34.5242903,
    lng: -58.4724439,
    original_image_url: 'https://img.postalpeek.app/originals/d6ca3330-41f6-46bd-918b-f16c38389714.jpg',
    category: 'Comercio Urbano 🛍️',
    illustration_url: 'https://img.postalpeek.app/illustrations/23f50142-e07f-4446-a13b-752d2cc31759.webp',
    description: 'Reflejos urbanos danzan en la fachada de cristal de un establecimiento vibrante.',
    stamp_cost: 100,
    album_id: '63ce811c-2b7f-4cce-99e4-84713e75a950',
  },
  {
    id: '970a174f-91a6-4d5e-af4f-55e9b7896f60',
    created_at: '2026-03-12T22:07:19.542613+00:00',
    owner_id: null,
    country: 'Argentina',
    city: 'Buenos Aires',
    location_name: 'Leed - Venta de Cuadros',
    lat: -34.5755123,
    lng: -58.4444168,
    original_image_url: 'https://img.postalpeek.app/originals/a971ebc1-118c-487d-9f12-05d5c1f2ce7a.jpg',
    category: 'Contraste Urbano 🏙️',
    illustration_url: 'https://img.postalpeek.app/illustrations/a33886c8-53c4-49ab-9c98-89c0609575bc.webp',
    description: 'La robusta piedra antigua custodia el ascenso de las modernas moles, un diálogo silencioso en el corazón de la urbe.',
    stamp_cost: 100,
    album_id: '63ce811c-2b7f-4cce-99e4-84713e75a950',
  },
  {
    id: 'f0b9e45a-7f6c-4be6-ad1f-13a5e5518f4c',
    created_at: '2026-03-14T14:00:24.768672+00:00',
    owner_id: null,
    country: 'Argentina',
    city: 'Buenos Aires',
    location_name: 'AppCake Pastelería',
    lat: -34.5552096759065,
    lng: -58.48317781142072,
    original_image_url: 'https://img.postalpeek.app/originals/4a9c377c-bbd7-4261-9812-20b5fd855d29.jpg',
    category: '🏙️ Vida Urbana',
    illustration_url: 'https://img.postalpeek.app/illustrations/0fdd983b-5385-49fc-9c7c-6af9a4b7d3ed.webp',
    description: 'Bajo un sol resplandeciente, la promesa de nuevas estructuras se entrelaza con la efímera belleza de las flores rosadas en la bulliciosa calle.',
    stamp_cost: 100,
    album_id: '63ce811c-2b7f-4cce-99e4-84713e75a950',
  }
];

export function OnboardingFlow() {
  const navigate = useNavigate();
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
        }} 
      />
    );
  }

  // ── Step 2 & 3: Carousel and Game ──
  return (
    <div className="absolute inset-0 w-full h-full bg-stone-900 overflow-hidden">
      <AmbientBackground imageUrl={TUTORIAL_CARDS[0].illustration_url} />
      
      {/* Onboarding Header overlay */}
      {tutorialStep !== 'game' && (
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
      )}

      <TutorialCarousel 
        cards={TUTORIAL_CARDS} 
        claimedId={claimedId}
        onClaim={(id) => {
          setClaimedId(id);
          setTutorialStamps(prev => prev - 100);
          setTimeout(() => setTutorialStep('game'), 1500); // Transition to game after stamp animation
        }}
        showGame={tutorialStep === 'game'}
        onGameComplete={async () => {
          setTutorialStamps(prev => prev + 50);
          completeOnboarding();
          
          if (claimedId) {
            sessionStorage.setItem('postalpeek_guest_claim', claimedId);
          }
          
          try {
            const { markWelcomeSeen } = await import('../utils/welcomeStorage');
            markWelcomeSeen();
          } catch (e) {
            console.error('Failed to mark welcome seen', e);
          }

          // Look up the album this postcard belongs to (dynamic, works in all envs)
          try {
            const { supabase } = await import('@entity-builders/logic/src/supabase');
            const { data } = await supabase
              .from('album_slots')
              .select('album_id')
              .eq('postcard_id', claimedId)
              .limit(1)
              .single();
            if (data?.album_id) {
              navigate('/feed/album/' + data.album_id);
              return;
            }
          } catch { /* fallback below */ }
          navigate('/feed');
        }}
        onPlayGame={() => setTutorialStep('game')}
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
  onGameComplete,
  onPlayGame
}: { 
  cards: FeedItem[], 
  claimedId: string | null,
  onClaim: (id: string) => void,
  showGame: boolean,
  onGameComplete: () => void,
  onPlayGame: () => void
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
                onPlayGame={onPlayGame}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Swipe indicator */}
      {!showGame && !claimedId && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2, duration: 1 }}
          className="absolute bottom-8 left-0 right-0 z-40 pointer-events-none flex flex-col items-center"
        >
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
            className="flex flex-col items-center text-white/90 drop-shadow-lg"
          >
            <ChevronDown className="w-7 h-7 mb-1" strokeWidth={2.5} />
            <span className="text-sm font-medium tracking-wide drop-shadow-md">
              Desliza para ver otras
            </span>
          </motion.div>
        </motion.div>
      )}

      {/* Portal the game overlay to document.body so Embla transforms don't break position:fixed */}
      {showGame && claimedId && createPortal(
        <TutorialGameWrapper 
          key={`game-${retryKey}`} 
          item={cards.find(c => c.id === claimedId)!} 
          onComplete={onGameComplete} 
          onRetry={() => setRetryKey(k => k + 1)} 
        />,
        document.body
      )}
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
            <StampHuntBottomPanel 
              item={item} 
              hunt={hunt} 
              onClose={handleClose} 
              failLabel={{ es: 'Reintentar', en: 'Retry' }}
            />
          </div>

        </div>
      </div>
    </motion.div>
  );
}

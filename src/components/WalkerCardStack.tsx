import React, { useState, useEffect } from 'react';
import { Alert } from 'react-native';
import { motion, useMotionValue, useTransform, useAnimation, PanInfo } from 'framer-motion';
import { analytics } from '../lib/analytics';
import { useLang, t } from '../utils/i18n';
import { Postcard, FeedItem } from './Postcard';
import { AlbumCover } from './AlbumCover';
import { WalkerWelcome } from './WalkerWelcome';
import { markWelcomeSeen } from '../utils/welcomeStorage';
import type { User } from '@supabase/supabase-js';
import { useNavigate } from 'react-router-dom';

const FREE_CARD_LIMIT = 5;
const AUTH_GATE_KEY = 'postalpeek_auth_gate';
const AUTH_GATE_CARDS_KEY = 'postalpeek_auth_cards';

interface WalkerCardStackProps {
  items: FeedItem[];
  selectedCountry: string | null;
  user: User | null;
  isAdmin: boolean;
  showWelcome: boolean;
  isOnWelcome: boolean;
  setIsOnWelcome: (val: boolean) => void;
  favoriteIds: Set<string>;
  toggleFavorite: (id: string) => void;
  setShowAuthGate: (val: boolean) => void;
  setPendingFavoriteId: (id: string | null) => void;
  hasSharedCard: boolean;
  claimedIds: Set<string>;
  onClaimPostcard?: (postcardId: string) => void;
  isClaimLoading?: boolean;
  albumPostcardIds?: Set<string>;
  onSwipe: (item: FeedItem, direction: 'left' | 'right') => void;
}

export function WalkerCardStack({
  items,
  user,
  isAdmin,
  showWelcome,
  setIsOnWelcome,
  favoriteIds,
  toggleFavorite,
  setShowAuthGate,
  setPendingFavoriteId,
  hasSharedCard,
  claimedIds,
  onClaimPostcard,
  isClaimLoading = false,
  albumPostcardIds = new Set(),
  onSwipe,
}: WalkerCardStackProps) {
  const [openedAlbums, setOpenedAlbums] = useState<Set<string>>(new Set());
  const [heroReadyIds, setHeroReadyIds] = useState<Set<string>>(new Set());
  const [swipedCount, setSwipedCount] = useState(0);

  // If we are showing welcome, we insert a fake welcome item at the top.
  const activeItems = React.useMemo(() => {
    const list = [...items];
    if (showWelcome && swipedCount === 0) {
      if (hasSharedCard && list.length > 0) {
        // Welcome goes AFTER the shared card (index 1)
        return [list[0], { type: 'welcome', id: 'welcome-fake-id' } as unknown as FeedItem, ...list.slice(1)];
      } else {
        return [{ type: 'welcome', id: 'welcome-fake-id' } as unknown as FeedItem, ...list];
      }
    }
    return list;
  }, [items, showWelcome, hasSharedCard, swipedCount]);

  useEffect(() => {
    // If we just swiped the welcome screen, mark it seen
    if (showWelcome && swipedCount > (hasSharedCard ? 1 : 0)) {
      setIsOnWelcome(false);
      markWelcomeSeen();
    }
  }, [swipedCount, showWelcome, hasSharedCard, setIsOnWelcome]);

  // Auth gate check for guests after 5 swipes
  useEffect(() => {
    if (!user && swipedCount >= FREE_CARD_LIMIT) {
      setShowAuthGate(true);
      sessionStorage.setItem(AUTH_GATE_KEY, 'true');
      try {
        const heroCards = items.slice(0, 3).map((c) => ({
          id: c.id,
          illustration_url: c.illustration_url,
          city: c.city,
          country: c.country,
          category: t(c.category),
        }));
        sessionStorage.setItem(AUTH_GATE_CARDS_KEY, JSON.stringify(heroCards));
      } catch {
        // limit exceeded or similar
      }
      analytics.track('auth_gate_shown', { items_viewed: swipedCount });
    }
  }, [swipedCount, user, setShowAuthGate, items]);

  // Render the top 3 cards in the stack. 
  // We map them in reverse order so the first one (index 0) renders on top in the DOM (z-index wise or DOM order wise if absolute)
  // Actually, standard absolute positioning stacks later elements on top. So we should slice top 3, then reverse them, so index 0 is mapped last.
  const visibleCards = activeItems.slice(0, 3);
  
  return (
    <div className='relative w-full h-full overflow-hidden flex items-center justify-center pointer-events-none'>
        {visibleCards.map((item, localIndex) => {
          // Calculate true Z index and position (0 is front)
          const isFront = localIndex === 0;

          return (
            <SwipeableCard
              key={item.id}
              item={item}
              isFront={isFront}
              indexPosition={localIndex}
              onSwipe={(direction) => {
                setSwipedCount(prev => prev + 1);
                if (!('type' in item) || item.type !== 'welcome') {
                   onSwipe(item, direction);
                   if (direction === 'right' && user && onClaimPostcard) {
                      onClaimPostcard(item.id);
                   }
                }
              }}
              // Pass down specific props for the Postcard/AlbumCover
              user={user}
              isAdmin={isAdmin}
              favoriteIds={favoriteIds}
              toggleFavorite={toggleFavorite}
              claimedIds={claimedIds}
              onClaimPostcard={onClaimPostcard}
              isClaimLoading={isClaimLoading}
              albumPostcardIds={albumPostcardIds}
              openedAlbums={openedAlbums}
              setOpenedAlbums={setOpenedAlbums}
              heroReadyIds={heroReadyIds}
              setHeroReadyIds={setHeroReadyIds}
              showWelcome={showWelcome}
              swipedCount={swipedCount}
              setShowAuthGate={setShowAuthGate}
              setPendingFavoriteId={setPendingFavoriteId}
              items={items}
            />
          );
        }).reverse()}
    </div>
  );
}

interface SwipeableCardProps {
  item: FeedItem & { type?: string };
  isFront: boolean;
  indexPosition: number;
  onSwipe: (direction: 'left' | 'right') => void;
  // Postcard props
  user: User | null;
  isAdmin: boolean;
  favoriteIds: Set<string>;
  toggleFavorite: (id: string) => void;
  claimedIds: Set<string>;
  onClaimPostcard?: (id: string) => void;
  isClaimLoading: boolean;
  albumPostcardIds: Set<string>;
  openedAlbums: Set<string>;
  setOpenedAlbums: React.Dispatch<React.SetStateAction<Set<string>>>;
  heroReadyIds: Set<string>;
  setHeroReadyIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  showWelcome: boolean;
  swipedCount: number;
  setShowAuthGate: (val: boolean) => void;
  setPendingFavoriteId: (id: string) => void;
  items: FeedItem[];
}

function SwipeableCard({
  item,
  isFront,
  indexPosition,
  onSwipe,
  user,
  isAdmin,
  favoriteIds,
  toggleFavorite,
  claimedIds,
  onClaimPostcard,
  isClaimLoading,
  albumPostcardIds,
  openedAlbums,
  setOpenedAlbums,
  setHeroReadyIds,
  showWelcome,
  swipedCount,
  setShowAuthGate,
  setPendingFavoriteId,
  items,
}: SwipeableCardProps) {
  const lang = useLang();
  const navigate = useNavigate();
  const x = useMotionValue(0);
  const controls = useAnimation();
  
  // Visual transformations based on horizontal drag
  const rotate = useTransform(x, [-200, 200], [-8, 8]);
  const opacity = useTransform(x, [-200, -100, 0, 100, 200], [0.5, 1, 1, 1, 0.5]);
  
  // Background Hint Indicators (Save / Discard)
  const saveOpacity = useTransform(x, [0, 100], [0, 1]);
  const discardOpacity = useTransform(x, [0, -100], [0, 1]);

  // Stack positioning (scale and Y offset for cards behind)
  const scale = 1 - (indexPosition * 0.05);
  // Base offset is how much we push the card down. 
  const yOffset = indexPosition * 14; 
  // Add a slight rotation to the back cards to simulate a physical deck
  const baseRotation = indexPosition === 1 ? -2 : indexPosition === 2 ? 2 : 0;

  const handleDragEnd = (_e: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const threshold = 100;
    const velocity = info.velocity.x;

    if (info.offset.x > threshold || velocity > 500) {
      // Swipe Right (Like/Claim)
      if (user && !item.owner_id && item.type !== 'welcome') {
        Alert.alert(
          t({ es: 'Reclamar Postal', en: 'Claim Postcard' }, lang),
          t({ es: 'Cuesta 1 Estampilla reclamar esta postal del feed global. ¿Aceptar?', en: 'It costs 1 Stamp to claim this postcard from the global feed. Accept?' }, lang),
          [
            {
              text: t({ es: 'Cancelar', en: 'Cancel' }, lang),
              style: 'cancel',
              onPress: () => {
                controls.start({ x: 0, transition: { type: 'spring', stiffness: 300, damping: 20 } });
              }
            },
            {
              text: t({ es: 'Aceptar', en: 'Accept' }, lang),
              onPress: () => {
                controls.start({ x: 500, opacity: 0, transition: { duration: 0.3 } }).then(() => onSwipe('right'));
                analytics.track('card_swiped', { direction: 'right', postcard_id: item.id });
              }
            }
          ]
        );
      } else {
        controls.start({ x: 500, opacity: 0, transition: { duration: 0.3 } }).then(() => onSwipe('right'));
        analytics.track('card_swiped', { direction: 'right', postcard_id: item.id });
      }
    } else if (info.offset.x < -threshold || velocity < -500) {
      // Swipe Left (Discard)
      controls.start({ x: -500, opacity: 0, transition: { duration: 0.3 } }).then(() => onSwipe('left'));
      analytics.track('card_swiped', { direction: 'left', postcard_id: item.id });
    } else {
      // Spring back
      controls.start({ x: 0, transition: { type: 'spring', stiffness: 300, damping: 20 } });
    }
  };

  const isWelcome = item.type === 'welcome';

  return (
    <motion.div
      className='absolute w-[92vw] max-w-[420px] pointer-events-auto flex justify-center items-center'
      style={{
        x: isFront ? x : 0,
        rotate: isFront ? rotate : baseRotation,
        opacity: isFront ? opacity : undefined,
        zIndex: 10 - indexPosition,
        aspectRatio: '4/5',
      }}
      initial={{ scale: 0.8, y: 50 }}
      animate={{ 
        scale, 
        y: yOffset,
        transition: { type: 'spring', stiffness: 300, damping: 25 }
      }}
      drag={isFront ? 'x' : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.8}
      onDragEnd={isFront ? handleDragEnd : undefined}
    >
        {/* Swipe Indicators */}
        {isFront && !isWelcome && (
          <>
            <motion.div 
              style={{ opacity: saveOpacity }}
              className='absolute top-12 left-8 z-[100] pointer-events-none rotate-[-15deg] border-4 border-emerald-500 rounded-lg px-4 py-2'
            >
              <span className='text-3xl font-black text-emerald-500 uppercase tracking-widest drop-shadow-md'>{t({ es: 'RECLAMAR', en: 'CLAIM' }, lang)}</span>
            </motion.div>
            <motion.div 
              style={{ opacity: discardOpacity }}
              className='absolute top-12 right-8 z-[100] pointer-events-none rotate-[15deg] border-4 border-rose-500 rounded-lg px-4 py-2'
            >
              <span className='text-3xl font-black text-rose-500 uppercase tracking-widest drop-shadow-md'>{t({ es: 'DESCARTAR', en: 'DISCARD' }, lang)}</span>
            </motion.div>
          </>
        )}

        <div className='w-full h-full bg-white shadow-[0_8px_30px_rgb(0,0,0,0.12)] p-2 pb-8 md:p-3 md:pb-10 rounded-xl md:rounded-2xl relative border border-slate-200 flex flex-col'>
            {isWelcome ? (
              <div className='w-full h-full flex items-center justify-center bg-transparent rounded-lg overflow-hidden relative'>
                 <WalkerWelcome previewCards={items.slice(0, 3)} />
              </div>
            ) : item.album_id && !openedAlbums.has(item.album_id) ? (
              <div 
                className='w-full h-full bg-transparent flex-1'
                onPointerDown={() => {
                }}
              >
                <AlbumCover
                  item={item}
                  isActive={true}
                  isPriority={true}
                  onOpenTrip={() => {
                    setOpenedAlbums((prev: Set<string>) => {
                      const next = new Set(prev);
                      next.add(item.album_id!);
                      return next;
                    });
                  }}
                />
              </div>
            ) : (
              <div className='w-full h-full flex flex-col relative flex-1'>
                <Postcard
                    item={item}
                    isActive={true}
                    isPriority={true}
                    isAdmin={isAdmin}
                    favoriteIds={favoriteIds}
                    onToggleFavorite={user ? toggleFavorite : undefined}
                    isClaimedByMe={claimedIds.has(item.id)}
                    hasOwner={!!item.owner_id}
                    onClaimPostcard={user ? onClaimPostcard : undefined}
                    isClaimLoading={isClaimLoading}
                    isInAlbum={albumPostcardIds.has(item.id)}
                    showClaimGuide={showWelcome && claimedIds.size === 0 && swipedCount === 0}
                    onOpenAlbum={(albumId) => {
                      analytics.track('postcard_album_icon_clicked', { album_id: albumId, postcard_id: item.id });
                      navigate(`/album/${albumId}`);
                    }}
                    onHeroReady={() => {
                      setHeroReadyIds((prev: Set<string>) => {
                        if (prev.has(item.id)) return prev;
                        const next = new Set(prev);
                        next.add(item.id);
                        return next;
                      });
                    }}
                    onAuthRequired={
                      !user
                        ? (postcardId) => {
                            setPendingFavoriteId(postcardId);
                            setShowAuthGate(true);
                            sessionStorage.setItem(AUTH_GATE_KEY, 'true');
                            try {
                              const heroCards = items.slice(0, 3).map((c) => ({
                                id: c.id,
                                illustration_url: c.illustration_url,
                                city: c.city,
                                country: c.country,
                                category: t(c.category),
                              }));
                              sessionStorage.setItem(AUTH_GATE_CARDS_KEY, JSON.stringify(heroCards));
                            } catch {
                               //
                            }
                          }
                        : undefined
                    }
                  />
              </div>
            )}
        </div>
    </motion.div>
  );
}

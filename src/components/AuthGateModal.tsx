import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { cdnUrl, WIDTHS } from '../utils/imageUtils';
import { useSignedImage } from '../utils/useSignedImage';
import { sway, ease } from '../utils/useWelcomeAnimation';
import type { FeedItem } from './Postcard';
import { t } from '../utils/i18n';
import { usePostalPeekAccount } from '../hooks/usePostalPeekAccount';
import { PostalPeekAuthForm } from './PostalPeekAuthForm';

interface AuthGateModalProps {
  onSuccess: () => void;
  onClose?: () => void;
  /** Postcards the user has already seen — we use them in the hero showcase */
  viewedItems?: FeedItem[];
}

const FALLBACK_ITEMS: FeedItem[] = [
  { id: 'fb1', illustration_url: 'postalpeek/seed/france_1.webp', original_image_url: '', city: 'Paris', country: 'France', category: 'architecture', lat: 48.8566, lng: 2.3522, description: '', created_at: new Date().toISOString() },
  { id: 'fb2', illustration_url: 'postalpeek/seed/japan_1.png', original_image_url: '', city: 'Tokyo', country: 'Japan', category: 'culture', lat: 35.6762, lng: 139.6503, description: '', created_at: new Date().toISOString() },
  { id: 'fb3', illustration_url: 'postalpeek/seed/italy_1.webp', original_image_url: '', city: 'Rome', country: 'Italy', category: 'architecture', lat: 41.9028, lng: 12.4964, description: '', created_at: new Date().toISOString() },
];

/**
 * Immersive auth gate styled as a continuation of the warm welcome screen.
 * Same beige background, same stacked postcards with sway, but the text zone
 * is replaced with the auth form — creating a cohesive storytelling experience.
 */
export function AuthGateModal({
  onSuccess,
  onClose,
  viewedItems = [],
}: AuthGateModalProps) {
  const account = usePostalPeekAccount('auth_gate');
  const completedRef = useRef(false);

  const effectiveItems = viewedItems.length >= 3 ? viewedItems : FALLBACK_ITEMS;
  const heroCards = effectiveItems.slice(0, 3);
  const mainCard = heroCards[0];

  const [fallbackEnabled, setFallbackEnabled] = useState(false);

  useEffect(() => {
    if (!account.isPermanent || completedRef.current) return;

    completedRef.current = true;
    localStorage.removeItem('postalpeek_anon_gen_count');
    onSuccess();
  }, [account.isPermanent, onSuccess]);

  const baseImgUrl2 = useSignedImage(heroCards[2]?.illustration_url, { width: WIDTHS.thumb });
  const baseImgUrl1 = useSignedImage(heroCards[1]?.illustration_url, { width: WIDTHS.thumb });
  const baseImgUrl0 = useSignedImage(mainCard?.illustration_url, { width: WIDTHS.thumb });

  const imgUrl2 = fallbackEnabled ? cdnUrl(heroCards[2]?.illustration_url || '') : baseImgUrl2;
  const imgUrl1 = fallbackEnabled ? cdnUrl(heroCards[1]?.illustration_url || '') : baseImgUrl1;
  const imgUrl0 = fallbackEnabled ? cdnUrl(mainCard?.illustration_url || '') : baseImgUrl0;

  const handleImageFallback = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    if (e.currentTarget.src.includes('/cdn-cgi/image/')) {
      setFallbackEnabled(true);
    }
  };

  return (
    <motion.div
      className='fixed inset-0 z-[100] bg-[#e6e2da]'
      style={{ width: '100vw', height: '100dvh' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <div className='w-full h-full flex flex-col items-center select-none overflow-hidden'>
        {onClose && (
          <button
            onClick={onClose}
            className='absolute top-4 right-4 z-[110] p-2 rounded-full bg-stone-200/50 text-stone-600 hover:bg-stone-300/50 transition-colors'
          >
            <X size={24} />
          </button>
        )}

        {/* ─── ZONE 1: Postcards (same as welcome) ─── */}
        <motion.div
          className='flex-[4] w-full flex items-center justify-center relative min-h-0 overflow-hidden pt-4'
          initial={{ opacity: 0, y: -120, scale: 1.05 }}
          animate={{ opacity: 0.9, y: 0, scale: 1 }}
          transition={{ duration: 0.6, ease, delay: 0.1 }}
        >
          <div className='relative h-[85%] aspect-[3/4] max-w-[55%]'>
            {/* Card 3 (back) — continuous sway */}
            {heroCards[2] && (
              <motion.div
                className='absolute inset-0 bg-white p-1.5 rounded-sm shadow-md opacity-40'
                {...sway.back}
              >
                <div className='w-full h-full overflow-hidden rounded-[2px] bg-stone-100'>
                  {imgUrl2 && (
                    <img
                      key={imgUrl2}
                      src={imgUrl2}
                      alt=''
                      className='w-full h-full object-cover'
                      onError={handleImageFallback}
                    />
                  )}
                </div>
              </motion.div>
            )}
            {/* Card 2 (middle) — continuous sway */}
            {heroCards[1] && (
              <motion.div
                className='absolute inset-0 bg-white p-1.5 rounded-sm shadow-md opacity-60'
                {...sway.middle}
              >
                <div className='w-full h-full overflow-hidden rounded-[2px] bg-stone-100'>
                  {imgUrl1 && (
                    <img
                      key={imgUrl1}
                      src={imgUrl1}
                      alt=''
                      className='w-full h-full object-cover'
                      onError={handleImageFallback}
                    />
                  )}
                </div>
              </motion.div>
            )}
            {/* Card 1 (front — hero) */}
            {mainCard && (
              <div className='absolute inset-0 bg-white p-1.5 pb-6 rounded-sm shadow-xl -rotate-[1.5deg]'>
                <div className='w-full h-[calc(100%-24px)] overflow-hidden rounded-[2px] bg-stone-100'>
                  {imgUrl0 && (
                    <img
                      key={imgUrl0}
                      src={imgUrl0}
                      alt={t(mainCard.category)}
                      className='w-full h-full object-cover'
                      onError={handleImageFallback}
                    />
                  )}
                </div>
                <p className='text-center font-handwriting text-[10px] sm:text-xs text-stone-500 mt-1 truncate px-1'>
                  {mainCard.city}, {mainCard.country}
                </p>
              </div>
            )}

            {/* Postmark stamp */}
            <div className='absolute -top-2 -right-2 w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2 border-stone-500/30 flex items-center justify-center rotate-12 pointer-events-none z-20'>
              <div className='w-8 h-8 sm:w-10 sm:h-10 rounded-full border border-dashed border-stone-500/40 flex items-center justify-center bg-white/30 backdrop-blur-sm'>
                <span className='font-mono text-[5px] sm:text-[6px] text-stone-600 uppercase tracking-wider text-center leading-tight'>
                  Postal<br />Peek
                </span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ─── ZONE 2: Walker narrative + Auth form ─── */}
        <motion.div
          className='flex-[5] w-full flex flex-col items-center px-6 min-h-0'
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease, delay: 0.2 }}
        >
          {/* Walker copy */}
          <p className='text-stone-400 text-[10px] sm:text-[11px] font-mono tracking-[0.25em] uppercase mb-2 text-center'>
            {viewedItems.length} postcards delivered · ∞ remaining
          </p>
          <h2 className='font-serif text-2xl sm:text-3xl text-stone-800 tracking-tight mb-1 text-center'>
            Walker never stops walking.
          </h2>
          <p className='text-stone-500 text-sm mb-5 font-light text-center'>
            {account.codeSent
              ? 'Revisá tu casilla — te enviamos un código de 6 dígitos.'
              : 'Ya coleccionaste tu primera postal 🃏 Iniciá sesión para seguir coleccionando.'}
          </p>

          {/* Auth form — warm palette */}
          <div className='w-full max-w-sm min-h-[240px]'>
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease, delay: 0.3 }}
                className='w-full'
              >
                <PostalPeekAuthForm
                  account={account}
                  emailPlaceholder='Email'
                  requestLabel='Continue with Email'
                  helperText="No password needed — we'll send you a code."
                  codePlaceholder='6-digit code'
                  verifyLabel='Verify Code'
                  resendLabel="Didn't get the code? Resend"
                />
              </motion.div>
          </div>
        </motion.div>

        {/* ─── ZONE 3: Spacer for safe area ─── */}
        <div className='flex-[0.5] min-h-0' />
      </div>
    </motion.div>
  );
}

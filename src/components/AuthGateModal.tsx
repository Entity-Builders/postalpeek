import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, Mail, ArrowLeft } from 'lucide-react';
import { supabase } from '@eb-packages/logic/src/supabase';
import { cdnUrl, WIDTHS } from '../utils/imageUtils';
import { useSignedImage } from '../utils/useSignedImage';
import { sway, ease } from '../utils/useWelcomeAnimation';
import type { FeedItem } from './Postcard';

interface AuthGateModalProps {
  onSuccess: () => void;
  /** Postcards the user has already seen — we use them in the hero showcase */
  viewedItems?: FeedItem[];
}

/**
 * Immersive auth gate styled as a continuation of the warm welcome screen.
 * Same beige background, same stacked postcards with sway, but the text zone
 * is replaced with the auth form — creating a cohesive storytelling experience.
 */
export function AuthGateModal({
  onSuccess,
  viewedItems = [],
}: AuthGateModalProps) {
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const heroCards = viewedItems.slice(0, 3);
  const mainCard = heroCards[0];

  const [fallbackEnabled, setFallbackEnabled] = useState(false);

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

  /** Step 1: Send OTP to email */
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithOtp({ email });
      if (error) throw error;
      setStep('otp');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  /** Step 2: Verify OTP code */
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: otpCode,
        type: 'email',
      });
      if (error) throw error;
      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid code. Try again.');
    } finally {
      setLoading(false);
    }
  };

  /** Resend OTP */
  const handleResend = async () => {
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithOtp({ email });
      if (error) throw error;
      setOtpCode('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not resend code');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      className='fixed inset-0 z-[100] bg-[#e6e2da]'
      style={{ width: '100vw', height: '100dvh' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
    >
      <div className='w-full h-full flex flex-col items-center select-none overflow-hidden'>

        {/* ─── ZONE 1: Postcards (same as welcome) ─── */}
        <motion.div
          className='flex-[4] w-full flex items-center justify-center relative min-h-0 overflow-hidden pt-4'
          initial={{ opacity: 0, y: -120, scale: 1.05 }}
          animate={{ opacity: 0.9, y: 0, scale: 1 }}
          transition={{ duration: 1.0, ease, delay: 0.2 }}
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
                      src={imgUrl0}
                      alt={mainCard.category}
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
          transition={{ duration: 0.8, ease, delay: 0.5 }}
        >
          {/* Walker copy */}
          <p className='text-stone-400 text-[10px] sm:text-[11px] font-mono tracking-[0.25em] uppercase mb-2 text-center'>
            {viewedItems.length} postcards delivered · ∞ remaining
          </p>
          <h2 className='font-serif text-2xl sm:text-3xl text-stone-800 tracking-tight mb-1 text-center'>
            Walker never stops walking.
          </h2>
          <p className='text-stone-500 text-sm mb-5 font-light text-center'>
            {step === 'email'
              ? 'Enter your email to follow the journey.'
              : 'Check your inbox for a 6-digit code.'}
          </p>

          {/* Auth form — warm palette */}
          <div className='w-full max-w-sm'>
            {error && (
              <div className='bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-2.5 mb-4 text-center'>
                {error}
              </div>
            )}

            {step === 'email' ? (
              <form onSubmit={handleSendOtp} className='flex flex-col gap-3'>
                <div className='relative'>
                  <Mail className='absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400' />
                  <input
                    type='email'
                    placeholder='Email'
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus
                    className='w-full pl-11 pr-4 py-3.5 rounded-xl border border-stone-300 bg-white/80 text-stone-800 text-base placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-400/40 focus:border-stone-400 transition-all shadow-sm'
                  />
                </div>

                <button
                  type='submit'
                  disabled={loading || !email}
                  className='w-full py-3.5 rounded-xl bg-stone-800 hover:bg-stone-900 active:scale-[0.98] disabled:bg-stone-400 disabled:text-white/50 text-white text-sm font-semibold transition-all flex items-center justify-center gap-2 shadow-lg shadow-stone-800/20'
                >
                  {loading ? (
                    <Loader2 className='w-4 h-4 animate-spin' />
                  ) : (
                    'Continue with Email'
                  )}
                </button>

                <p className='text-center text-xs text-stone-400 mt-1'>
                  No password needed — we'll send you a code.
                </p>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className='flex flex-col gap-3'>
                <button
                  type='button'
                  onClick={() => {
                    setStep('email');
                    setOtpCode('');
                    setError(null);
                  }}
                  className='flex items-center gap-1 text-sm text-stone-400 hover:text-stone-600 transition-colors mb-1 self-start'
                >
                  <ArrowLeft className='w-3.5 h-3.5' />
                  {email}
                </button>

                <input
                  type='text'
                  inputMode='numeric'
                  pattern='[0-9]*'
                  maxLength={6}
                  placeholder='6-digit code'
                  value={otpCode}
                  onChange={(e) =>
                    setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))
                  }
                  required
                  autoFocus
                  className='w-full px-4 py-3.5 rounded-xl border border-stone-300 bg-white/80 text-stone-800 text-center text-xl tracking-[0.5em] font-mono placeholder:text-stone-400 placeholder:tracking-normal placeholder:text-base focus:outline-none focus:ring-2 focus:ring-stone-400/40 focus:border-stone-400 transition-all shadow-sm'
                />

                <button
                  type='submit'
                  disabled={loading || otpCode.length < 6}
                  className='w-full py-3.5 rounded-xl bg-stone-800 hover:bg-stone-900 active:scale-[0.98] disabled:bg-stone-400 disabled:text-white/50 text-white text-sm font-semibold transition-all flex items-center justify-center gap-2 shadow-lg shadow-stone-800/20'
                >
                  {loading ? (
                    <Loader2 className='w-4 h-4 animate-spin' />
                  ) : (
                    'Verify Code'
                  )}
                </button>

                <button
                  type='button'
                  onClick={handleResend}
                  disabled={loading}
                  className='text-sm text-stone-400 hover:text-stone-600 transition-colors mt-1 text-center'
                >
                  Didn't get the code? Resend
                </button>
              </form>
            )}
          </div>
        </motion.div>

        {/* ─── ZONE 3: Spacer for safe area ─── */}
        <div className='flex-[0.5] min-h-0' />
      </div>
    </motion.div>
  );
}

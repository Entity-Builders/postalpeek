import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, Mail, ArrowLeft, X } from 'lucide-react';
import { supabase } from '@eb-packages/logic/src/supabase';
import { cdnUrl, WIDTHS } from '../utils/imageUtils';
import { useSignedImage } from '../utils/useSignedImage';
import { sway, ease } from '../utils/useWelcomeAnimation';
import type { FeedItem } from './Postcard';
import { t } from '../utils/i18n';
import { analytics } from '../lib/analytics';

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
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  React.useEffect(() => {
    // Reveal form after user has time to read the Walker text
    const timer = setTimeout(() => {
      setShowForm(true);
    }, 2000); 
    return () => clearTimeout(timer);
  }, []);

  const effectiveItems = viewedItems.length >= 3 ? viewedItems : FALLBACK_ITEMS;
  const heroCards = effectiveItems.slice(0, 3);
  const mainCard = heroCards[0];

  // Feature flag to disable social logins for now
  const ENABLE_SOCIAL_LOGINS = false;

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
      analytics.track('signup_email_submitted', {
        email_domain: email.split('@')[1] || 'unknown',
      });
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
      let tokenToVerify = otpCode;

      // DEV BYPASS: always accept 123456 on localhost by fetching the real OTP from local Mailpit
      if (window.location.hostname === 'localhost' && otpCode === '123456') {
        try {
          // Supabase replaced Inbucket with Mailpit
          const searchRes = await fetch(`http://127.0.0.1:54324/api/v1/search?query=to:${encodeURIComponent(email)}&limit=1`);
          if (searchRes.ok) {
            const searchData = await searchRes.json();
            if (searchData.messages && searchData.messages.length > 0) {
              const latestId = searchData.messages[0].ID;
              const msgRes = await fetch(`http://127.0.0.1:54324/api/v1/message/${latestId}`);
              if (msgRes.ok) {
                const msgData = await msgRes.json();
                // Check Snippet, HTML, or Text for the 6-digit code
                const textToSearch = msgData.Snippet + ' ' + (msgData.Text || '') + ' ' + (msgData.HTML || '');
                const match = textToSearch.match(/\b\d{6}\b/);
                if (match) {
                  tokenToVerify = match[0];
                  console.log('Dev Bypass: Substituted 123456 with real OTP from Mailpit');
                }
              }
            }
          }
        } catch (err) {
          console.warn('Mailpit dev bypass failed:', err);
        }
      }

      const { error } = await supabase.auth.verifyOtp({
        email,
        token: tokenToVerify,
        type: 'email',
      });
      if (error) throw error;
      analytics.track('signup_otp_verified');
      onSuccess();
    } catch (err: unknown) {
      analytics.track('signup_otp_failed', {
        error: err instanceof Error ? err.message : 'unknown',
      });
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
      analytics.track('signup_otp_resent');
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
              ? 'Ya coleccionaste tu primera postal 🃏 Iniciá sesión para seguir coleccionando.'
              : 'Revisá tu casilla — te enviamos un código de 6 dígitos.'}
          </p>

          {/* Auth form — warm palette */}
          <div className='w-full max-w-sm min-h-[240px]'>
            {showForm && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, ease }}
                className='w-full'
              >
                {error && (
              <div className='bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-2.5 mb-4 text-center'>
                {error}
              </div>
            )}

            {step === 'email' ? (
              <div className='flex flex-col'>
                <form onSubmit={handleSendOtp} className='flex flex-col gap-3'>
                  <div className='relative'>
                    <Mail className='absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400' />
                    <input
                      type='email'
                      name='email'
                      placeholder='Email'
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoComplete='email'
                      autoCapitalize='none'
                      autoCorrect='off'
                      spellCheck={false}
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

                  <p className='text-center text-xs text-stone-400 mt-1 mb-2'>
                    No password needed — we'll send you a code.
                  </p>
                </form>

                {/* Feature flag: Social logins temporarily disabled */}
                {(() => {
                  if (!ENABLE_SOCIAL_LOGINS) return null;
                  return (
                    <>
                      <div className='flex items-center gap-3 my-4'>
                      <div className='flex-1 h-px bg-stone-300'></div>
                      <span className='text-stone-400 text-[10px] font-semibold uppercase tracking-wider'>or</span>
                      <div className='flex-1 h-px bg-stone-300'></div>
                    </div>

                    <div className='flex flex-col gap-3'>
                      <button
                        type='button'
                        onClick={() => supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })}
                        className='w-full py-3.5 rounded-xl bg-white border border-stone-200 hover:bg-stone-50 active:scale-[0.98] text-stone-700 text-sm font-semibold transition-all flex items-center justify-center gap-3 shadow-sm'
                      >
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                          <title>Sign in with Google</title>
                          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                        </svg>
                        Continue with Google
                      </button>

                      <button
                        type='button'
                        onClick={() => supabase.auth.signInWithOAuth({ provider: 'apple', options: { redirectTo: window.location.origin } })}
                        className='w-full py-3.5 rounded-xl bg-black hover:bg-zinc-800 border border-transparent active:scale-[0.98] text-white text-sm font-semibold transition-all flex items-center justify-center gap-3 shadow-sm'
                      >
                        <svg className="w-5 h-5 mb-0.5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M16.365 21.493c-1.312.932-2.779.883-4.043.08-1.127-.723-2.126-.64-3.411.08-1.124.644-2.483.743-3.702-.132C3.12 19.689 1.139 16.035 2.146 11.832c.504-2.115 1.942-3.791 4.093-3.868 1.488-.073 2.721.902 3.52 1.05 1.05.215 2.508-.949 3.998-.908 1.474.04 2.83.659 3.652 1.832-3.085 1.761-2.583 5.922.378 7.279-.769 1.908-1.745 3.51-2.909 4.376-1.077.781-2.17.653-3.042.062z"/>
                          <path d="M11.666 7.641c-.08 1.96-1.572 3.754-3.407 3.844-.199-2.08 1.344-3.924 3.407-3.844z"/>
                        </svg>
                        Continue with Apple
                      </button>
                    </div>
                  </>
                  );
                })()}
              </div>
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
              </motion.div>
            )}
          </div>
        </motion.div>

        {/* ─── ZONE 3: Spacer for safe area ─── */}
        <div className='flex-[0.5] min-h-0' />
      </div>
    </motion.div>
  );
}

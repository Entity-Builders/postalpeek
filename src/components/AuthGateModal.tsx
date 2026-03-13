import React, { useState, useEffect, useRef } from 'react';
import { Loader2, Mail, ArrowLeft } from 'lucide-react';
import { supabase } from '@eb-packages/logic/src/supabase';
import type { FeedItem } from './Postcard';

interface AuthGateModalProps {
  onSuccess: () => void;
  /** Postcards the user has already seen — we use them in the hero showcase */
  viewedItems?: FeedItem[];
}

/**
 * Preload illustration URLs during browser idle time so they're cached
 * when the auth gate modal appears. Uses requestIdleCallback with a
 * setTimeout fallback for browsers that don't support it.
 */
function useIdlePreload(urls: string[]) {
  const preloadedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const toLoad = urls.filter((u) => u && !preloadedRef.current.has(u));
    if (toLoad.length === 0) return;

    const load = () => {
      toLoad.forEach((url) => {
        const img = new Image();
        img.src = url;
        preloadedRef.current.add(url);
      });
    };

    // Schedule during idle time so it never blocks initial render
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    if (typeof w.requestIdleCallback === 'function') {
      const id = w.requestIdleCallback(load, { timeout: 3000 });
      return () => w.cancelIdleCallback?.(id);
    } else {
      const id = setTimeout(load, 1500);
      return () => clearTimeout(id);
    }
  }, [urls]);
}

/**
 * Immersive auth gate with stacked hero postcards + Walker narrative.
 * Appears after N free postcards to encourage registration.
 * Uses passwordless OTP flow: enter email → receive code → verify.
 */
export function AuthGateModal({ onSuccess, viewedItems = [] }: AuthGateModalProps) {
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pick up to 3 cards for the stacked hero showcase
  const heroCards = viewedItems.slice(0, 3);
  const mainCard = heroCards[0];

  // Preload hero images during idle time (doesn't block initial load)
  const heroUrls = heroCards.map((c) => c.illustration_url).filter(Boolean);
  useIdlePreload(heroUrls);

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
      setError(null);
      setOtpCode('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not resend code');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0a0a12]">
      {/* Ambient glow from the hero postcard */}
      {mainCard && (
        <div
          className="absolute inset-0 opacity-25 blur-[100px] scale-150"
          style={{
            backgroundImage: `url(${mainCard.illustration_url})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
      )}

      {/* Centered container — constrained on desktop, full on mobile */}
      <div className="relative z-10 w-full max-w-md mx-auto flex flex-col h-full sm:h-auto sm:max-h-[90vh]">

        {/* ─── TOP: Hero Postcard Showcase ─── */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 pt-10 pb-6 min-h-0">
          {/* Stacked postcards */}
          {mainCard && (
            <div className="relative w-[240px] h-[260px] sm:w-[260px] sm:h-[280px]">
              {/* Card 3 (back) */}
              {heroCards[2] && (
                <div className="absolute inset-0 bg-white p-1.5 rounded-sm shadow-lg rotate-6 translate-x-3 -translate-y-1 opacity-50">
                  <div className="w-full h-full overflow-hidden rounded-[2px]">
                    <img
                      src={heroCards[2].illustration_url}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
              )}
              {/* Card 2 (middle) */}
              {heroCards[1] && (
                <div className="absolute inset-0 bg-white p-1.5 rounded-sm shadow-lg -rotate-3 -translate-x-2 translate-y-1 opacity-70">
                  <div className="w-full h-full overflow-hidden rounded-[2px]">
                    <img
                      src={heroCards[1].illustration_url}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
              )}
              {/* Card 1 (front — main hero) */}
              <div className="absolute inset-0 bg-white p-1.5 pb-6 rounded-sm shadow-[0_20px_60px_-10px_rgba(0,0,0,0.5)] -rotate-1 animate-fade-in">
                <div className="w-full h-[calc(100%-20px)] overflow-hidden rounded-[2px]">
                  <img
                    src={mainCard.illustration_url}
                    alt={mainCard.category}
                    className="w-full h-full object-cover"
                  />
                </div>
                <p className="text-center font-handwriting text-[11px] text-stone-400 mt-1 truncate px-1">
                  {mainCard.city}, {mainCard.country}
                </p>
              </div>

              {/* Postmark stamp */}
              <div className="absolute -top-4 -right-4 w-16 h-16 rounded-full border-2 border-white/15 flex items-center justify-center rotate-12 pointer-events-none z-20">
                <div className="w-14 h-14 rounded-full border border-dashed border-white/25 flex items-center justify-center bg-black/20 backdrop-blur-sm">
                  <span className="font-mono text-[7px] text-white/60 uppercase tracking-wider text-center leading-tight">
                    Postal<br />Peek
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Walker Copy */}
          <div className="text-center mt-8">
            <p className="text-white/35 text-[11px] font-mono tracking-[0.25em] uppercase mb-3">
              {viewedItems.length} postcards delivered · ∞ remaining
            </p>
            <h2 className="font-serif text-2xl sm:text-3xl text-white leading-snug tracking-tight">
              Walker never stops walking.
            </h2>
            <p className="text-white/45 text-sm mt-2 font-light">
              {step === 'email'
                ? 'Enter your email to follow the journey.'
                : 'Check your inbox for a 6-digit code.'}
            </p>
          </div>
        </div>

        {/* ─── BOTTOM: Auth Form (Bottom Sheet) ─── */}
        <div className="bg-white rounded-t-3xl sm:rounded-3xl px-7 pt-7 pb-9 animate-slide-up shadow-[0_-20px_60px_rgba(0,0,0,0.4)]">
          {error && (
            <div className="bg-red-50 border border-red-100 text-red-500 text-sm rounded-xl px-4 py-2.5 mb-4 text-center">
              {error}
            </div>
          )}

          {step === 'email' ? (
            /* ── Step 1: Email ── */
            <form onSubmit={handleSendOtp} className="flex flex-col gap-3">
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-300" />
                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoFocus
                  required
                  className="w-full pl-11 pr-4 py-3.5 rounded-xl border border-stone-200 bg-stone-50/80 text-stone-800 text-sm placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 focus:bg-white transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={loading || !email}
                className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] disabled:bg-stone-200 disabled:text-stone-400 text-white text-sm font-semibold transition-all flex items-center justify-center gap-2 mt-1 shadow-lg shadow-indigo-600/20"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Continue with Email'
                )}
              </button>

              <p className="text-center text-xs text-stone-400 mt-2">
                No password needed — we'll send you a code.
              </p>
            </form>
          ) : (
            /* ── Step 2: OTP Code ── */
            <form onSubmit={handleVerifyOtp} className="flex flex-col gap-3">
              <button
                type="button"
                onClick={() => {
                  setStep('email');
                  setOtpCode('');
                  setError(null);
                }}
                className="flex items-center gap-1 text-sm text-stone-400 hover:text-stone-600 transition-colors mb-1 self-start"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                {email}
              </button>

              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                placeholder="6-digit code"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                autoFocus
                required
                className="w-full px-4 py-3.5 rounded-xl border border-stone-200 bg-stone-50/80 text-stone-800 text-center text-lg tracking-[0.5em] font-mono placeholder:text-stone-400 placeholder:tracking-normal placeholder:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 focus:bg-white transition-all"
              />

              <button
                type="submit"
                disabled={loading || otpCode.length < 6}
                className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] disabled:bg-stone-200 disabled:text-stone-400 text-white text-sm font-semibold transition-all flex items-center justify-center gap-2 mt-1 shadow-lg shadow-indigo-600/20"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Verify Code'
                )}
              </button>

              <button
                type="button"
                onClick={handleResend}
                disabled={loading}
                className="text-sm text-stone-400 hover:text-indigo-600 transition-colors mt-2 text-center"
              >
                Didn't get the code? Resend
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

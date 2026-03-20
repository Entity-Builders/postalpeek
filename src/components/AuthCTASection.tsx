import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, Mail, ArrowLeft } from 'lucide-react';
import { supabase } from '@eb-packages/logic/src/supabase';
import type { FeedItem } from './Postcard';
import { useSignedImage } from '../utils/useSignedImage';
import { WIDTHS, cdnUrl } from '../utils/imageUtils';
import { sway } from '../utils/useWelcomeAnimation';
import { t } from '../utils/i18n';
import { analytics } from '../lib/analytics';

interface AuthCTASectionProps {
  onSuccess: () => void;
  viewedItems?: FeedItem[];
}

export function AuthCTASection({ onSuccess, viewedItems = [] }: AuthCTASectionProps) {
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

  const handleImageFallback = (e: React.SyntheticEvent<HTMLImageElement>) => {
    if (e.currentTarget.src.includes('/cdn-cgi/image/')) {
      setFallbackEnabled(true);
    }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithOtp({ email });
      if (error) throw error;
      analytics.track('cta_email_submitted', { email_domain: email.split('@')[1] || 'unknown' });
      setStep('otp');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      let tokenToVerify = otpCode;

      // DEV BYPASS: accept 123456 on localhost by fetching real OTP from Mailpit
      if (window.location.hostname === 'localhost' && otpCode === '123456') {
        try {
          const searchRes = await fetch(`http://127.0.0.1:54324/api/v1/search?query=to:${encodeURIComponent(email)}&limit=1`);
          if (searchRes.ok) {
            const searchData = await searchRes.json();
            if (searchData.messages?.length > 0) {
              const msgRes = await fetch(`http://127.0.0.1:54324/api/v1/message/${searchData.messages[0].ID}`);
              if (msgRes.ok) {
                const msgData = await msgRes.json();
                const match = (msgData.Snippet + ' ' + (msgData.Text || '')).match(/\b\d{6}\b/);
                if (match) tokenToVerify = match[0];
              }
            }
          }
        } catch { /* ignore */ }
      }

      const { error } = await supabase.auth.verifyOtp({ email, token: tokenToVerify, type: 'email' });
      if (error) throw error;
      analytics.track('cta_otp_verified');
      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Código inválido. Intentá de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithOtp({ email });
      if (error) throw error;
      setOtpCode('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudo reenviar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      className="w-full bg-[#e6e2da] border-t border-stone-300/60 pt-10 pb-20"
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.7 }}
    >
      <div className="max-w-sm mx-auto px-6 flex flex-col items-center">

        {/* Stacked postcard mini-gallery */}
        {mainCard && (
          <div className="relative h-36 w-28 mb-8 mt-2">
            {heroCards[2] && (
              <motion.div
                className="absolute inset-0 bg-white p-1.5 rounded-sm shadow-md opacity-40"
                {...sway.back}
              >
                <div className="w-full h-full overflow-hidden rounded-[2px] bg-stone-100">
                  {imgUrl2 && <img key={imgUrl2} src={imgUrl2} alt="" className="w-full h-full object-cover" onError={handleImageFallback} />}
                </div>
              </motion.div>
            )}
            {heroCards[1] && (
              <motion.div
                className="absolute inset-0 bg-white p-1.5 rounded-sm shadow-md opacity-60"
                {...sway.middle}
              >
                <div className="w-full h-full overflow-hidden rounded-[2px] bg-stone-100">
                  {imgUrl1 && <img key={imgUrl1} src={imgUrl1} alt="" className="w-full h-full object-cover" onError={handleImageFallback} />}
                </div>
              </motion.div>
            )}
            <div className="absolute inset-0 bg-white p-1.5 pb-5 rounded-sm shadow-xl -rotate-[1.5deg]">
              <div className="w-full h-[calc(100%-16px)] overflow-hidden rounded-[2px] bg-stone-100">
                {imgUrl0 && <img key={imgUrl0} src={imgUrl0} alt={t(mainCard.category)} className="w-full h-full object-cover" onError={handleImageFallback} />}
              </div>
              <p className="text-center font-handwriting text-[8px] text-stone-500 mt-0.5 truncate px-1">
                {mainCard.city}, {mainCard.country}
              </p>
            </div>

            {/* Postmark */}
            <div className="absolute -top-2 -right-2 w-9 h-9 rounded-full border-2 border-stone-500/30 flex items-center justify-center rotate-12 pointer-events-none z-20">
              <div className="w-7 h-7 rounded-full border border-dashed border-stone-500/40 flex items-center justify-center bg-white/30 backdrop-blur-sm">
                <span className="font-mono text-[5px] text-stone-600 uppercase tracking-wider text-center leading-tight">
                  Postal<br />Peek
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Headline */}
        <p className="text-stone-400 text-[10px] font-mono tracking-[0.25em] uppercase mb-1.5 text-center">
          Walker sigue caminando.
        </p>
        <h2 className="font-serif text-2xl sm:text-3xl text-stone-800 tracking-tight mb-1 text-center">
          Miles de postales<br />te esperan.
        </h2>
        <p className="text-stone-500 text-sm text-center mb-6 font-light leading-relaxed">
          {step === 'email'
            ? 'Coleccioná, completá álbumes y jugá con Walker gratis.'
            : 'Revisá tu casilla — te enviamos un código de 6 dígitos.'}
        </p>

        {/* Auth form */}
        <div className="w-full">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-2.5 mb-4 text-center">
              {error}
            </div>
          )}

          {step === 'email' ? (
            <form onSubmit={handleSendOtp} className="flex flex-col gap-3">
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                <input
                  type="email"
                  placeholder="tu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  className="w-full pl-11 pr-4 py-3.5 rounded-xl border border-stone-300 bg-white/80 text-stone-800 text-base placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-400/40 focus:border-stone-400 transition-all shadow-sm"
                />
              </div>
              <button
                type="submit"
                disabled={loading || !email}
                className="w-full py-3.5 rounded-xl bg-stone-800 hover:bg-stone-900 active:scale-[0.98] disabled:bg-stone-400 text-white text-sm font-semibold transition-all flex items-center justify-center gap-2 shadow-lg shadow-stone-800/20"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : '✉️  Unirme gratis'}
              </button>
              <p className="text-center text-xs text-stone-400">
                Sin contraseña — te enviamos un código mágico.
              </p>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="flex flex-col gap-3">
              <button
                type="button"
                onClick={() => { setStep('email'); setOtpCode(''); setError(null); }}
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
                placeholder="Código de 6 dígitos"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                required
                autoFocus
                className="w-full px-4 py-3.5 rounded-xl border border-stone-300 bg-white/80 text-stone-800 text-center text-xl tracking-[0.5em] font-mono placeholder:text-stone-400 placeholder:tracking-normal placeholder:text-base focus:outline-none focus:ring-2 focus:ring-stone-400/40 focus:border-stone-400 transition-all shadow-sm"
              />
              <button
                type="submit"
                disabled={loading || otpCode.length < 6}
                className="w-full py-3.5 rounded-xl bg-stone-800 hover:bg-stone-900 active:scale-[0.98] disabled:bg-stone-400 text-white text-sm font-semibold transition-all flex items-center justify-center gap-2 shadow-lg shadow-stone-800/20"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Verificar código'}
              </button>
              <button
                type="button"
                onClick={handleResend}
                disabled={loading}
                className="text-sm text-stone-400 hover:text-stone-600 transition-colors text-center"
              >
                ¿No llegó? Reenviar
              </button>
            </form>
          )}
        </div>
      </div>
    </motion.div>
  );
}

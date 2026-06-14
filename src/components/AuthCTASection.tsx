import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import type { FeedItem } from './Postcard';
import { useSignedImage } from '../utils/useSignedImage';
import { WIDTHS, cdnUrl } from '../utils/imageUtils';
import { sway } from '../utils/useWelcomeAnimation';
import { useLang, t } from '../utils/i18n';
import { usePostalPeekAccount } from '../hooks/usePostalPeekAccount';
import { PostalPeekAuthForm } from './PostalPeekAuthForm';

interface AuthCTASectionProps {
  onSuccess: () => void;
  viewedItems?: FeedItem[];
}

export function AuthCTASection({ onSuccess, viewedItems = [] }: AuthCTASectionProps) {
  const lang = useLang();
  const account = usePostalPeekAccount('feed_cta');
  const completedRef = useRef(false);

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

  useEffect(() => {
    if (!account.isPermanent || completedRef.current) return;

    completedRef.current = true;
    onSuccess();
  }, [account.isPermanent, onSuccess]);

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
          {t({ es: 'Walker sigue caminando.', en: 'Walker keeps walking.' }, lang)}
        </p>
        <h2 className="font-serif text-2xl sm:text-3xl text-stone-800 tracking-tight mb-1 text-center leading-tight">
          {t({ es: 'Miles de postales', en: 'Thousands of postcards' }, lang)}<br />
          {t({ es: 'te esperan.', en: 'await you.' }, lang)}
        </h2>
        <p className="text-stone-500 text-sm text-center mb-6 font-light leading-relaxed">
          {account.codeSent
            ? t({ es: 'Revisá tu casilla — te enviamos un código de 6 dígitos.', en: 'Check your inbox — we sent you a 6-digit code.' }, lang)
            : t({ es: 'Coleccioná, completá álbumes y jugá con Walker gratis.', en: 'Collect, complete albums and play with Walker for free.' }, lang)}
        </p>

        {/* Auth form */}
        <PostalPeekAuthForm
          account={account}
          emailPlaceholder={t({ es: 'tu@email.com', en: 'you@email.com' }, lang)}
          requestLabel={`✉️  ${t({ es: 'Unirme gratis', en: 'Join for free' }, lang)}`}
          helperText={t({ es: 'Sin contraseña — te enviamos un código mágico.', en: 'No password — we send you a magic code.' }, lang)}
          codePlaceholder={t({ es: 'Código de 6 dígitos', en: '6-digit code' }, lang)}
          verifyLabel={t({ es: 'Verificar código', en: 'Verify code' }, lang)}
          resendLabel={t({ es: '¿No llegó? Reenviar', en: "Didn't arrive? Resend" }, lang)}
        />
      </div>
    </motion.div>
  );
}

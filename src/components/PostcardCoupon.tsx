import React from 'react';
import { Ticket, Scissors, MapPin, RotateCcw } from 'lucide-react';
import type { FeedItem } from './Postcard';
import { t } from '../utils/i18n';

interface PostcardCouponProps {
  item: FeedItem;
  onFlipBack?: () => void;
}

export function PostcardCoupon({ item, onFlipBack }: PostcardCouponProps) {
  // Create a Maps URL query based on location name and city
  const mapQuery = encodeURIComponent(
    `${item.location_name || ''} ${item.city || ''}`,
  );
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${mapQuery}`;

  // Default context message or custom message if it exists in metadata
  const defaultMessage =
    'Aprovechá este beneficio exclusivo en tu próxima visita.';
  const offerMessage =
    t(item.generation_metadata?.offer_message) || defaultMessage;

  return (
    <div
      className='absolute inset-0 w-full h-full bg-[#fdfbf7] rounded-sm md:rounded-md shadow-2xl p-4 md:p-8 border border-[rgba(0,0,0,0.05)] flex flex-col items-center justify-center text-center overflow-y-auto'
      style={{
        backfaceVisibility: 'hidden',
        WebkitBackfaceVisibility: 'hidden',
        transform: 'rotateY(180deg) translateZ(1px)',
        WebkitTransform: 'rotateY(180deg) translateZ(1px)',
        color: '#1c1917', // Force dark text globally to override any dark-mode inversion
      }}
    >
      {/* Subtle paper texture overlay */}
      <div
        className='absolute inset-0 opacity-[0.03] pointer-events-none mix-blend-multiply'
        style={{
          backgroundImage:
            'url("https://www.transparenttextures.com/patterns/cream-paper.png")',
          borderRadius: 'inherit',
        }}
      ></div>

      {/* Flip-back button — positioned to mirror the ℹ️ button on the front */}
      {onFlipBack && (
        <button
          className='absolute bottom-3 right-3 z-40 p-2 md:p-2.5 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-400 hover:text-stone-600 transition-colors shadow-sm'
          onClick={(e) => {
            e.stopPropagation();
            onFlipBack();
          }}
          title='Volver al frente'
        >
          <RotateCcw className='w-4 h-4 md:w-5 md:h-5' />
        </button>
      )}

      <div className='relative w-full max-w-[320px] mx-auto bg-white border-2 border-dashed border-stone-300 rounded-lg p-6 flex flex-col items-center shadow-sm'>
        {/* Cutout dashes indicator */}
        <div className='absolute -top-3 left-1/2 -translate-x-1/2 bg-[#fdfbf7] px-2 text-stone-300'>
          <Scissors className='w-5 h-5 -rotate-90' />
        </div>

        <Ticket className='w-12 h-12 text-rose-500 mb-4' />

        {/* Using inline styles to guarantee high contrast regardless of Tailwind inheritance */}
        <h2
          className='font-serif text-2xl font-bold mb-1 leading-tight'
          style={{ color: '#1e293b' }}
        >
          Special Offer
        </h2>
        <h3
          className='text-sm font-medium tracking-wide uppercase mb-3'
          style={{ color: '#78716c' }}
        >
          at {item.location_name || item.city}
        </h3>

        {/* Content message */}
        <p
          className='border-t border-b border-stone-100 py-2.5 text-xs italic mb-4 w-full'
          style={{ color: '#57534e' }}
        >
          {offerMessage}
        </p>

        <div className='w-full bg-rose-50 rounded-md py-4 px-2 border border-rose-100 mb-6'>
          <p className='font-mono text-2xl md:text-3xl text-rose-600 font-bold tracking-widest'>
            10% OFF
          </p>
          <p className='text-[10px] text-rose-800/60 mt-2 uppercase tracking-wider'>
            Show this card to the cashier
          </p>
        </div>

        <div className='w-full flex w-full flex-col gap-2 relative z-10'>
          <button
            className='w-full bg-slate-900 hover:bg-slate-800 text-white rounded-full py-3 px-4 font-semibold text-sm transition-colors flex items-center justify-center gap-2'
            style={{ color: '#ffffff' }}
            onClick={(e) => {
              e.stopPropagation();
              alert('En el futuro, esto podría guardar el cupón.');
            }}
          >
            Obtener Cupón <Ticket className='w-4 h-4' />
          </button>

          <a
            href={mapsUrl}
            target='_blank'
            rel='noopener noreferrer'
            className='w-full bg-white border border-stone-200 hover:bg-stone-50 rounded-full py-3 px-4 font-semibold text-sm transition-colors flex items-center justify-center gap-2'
            style={{ color: '#44403c' }}
            onClick={(e) => e.stopPropagation()}
          >
            Ver en Mapa <MapPin className='w-4 h-4' />
          </a>
        </div>

        {/* Small print */}
        <p
          className='text-[9px] mt-6 leading-tight max-w-[80%] mx-auto'
          style={{ color: '#a8a29e' }}
        >
          Valid only at {item.location_name || 'participating locations'}.
          Cannot be combined with other offers.
        </p>
      </div>

      <p
        className='absolute bottom-4 text-[10px] font-mono tracking-widest uppercase'
        style={{ color: '#a8a29e' }}
      >
        {t(item.category)} Partner
      </p>
    </div>
  );
}

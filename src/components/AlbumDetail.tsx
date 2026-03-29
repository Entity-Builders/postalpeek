import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Trophy, HelpCircle, Eye, Search, MapPin, Tag } from 'lucide-react';
import { PostalPeekStampSVG } from './ui/PostalPeekStampSVG';
import { useSignedImage } from '../utils/useSignedImage';
import { WIDTHS } from '../utils/imageUtils';
import type { AlbumSlot, AlbumDetailData, MatchRules } from '../hooks/useAlbumDetail';
import { useFeedContext } from '../pages/feed/FeedLayout';
import { AuthGateModal } from './AuthGateModal';

interface AlbumDetailProps {
  detail: AlbumDetailData;
  isLoading: boolean;
  onClose: () => void;
}

const DIFFICULTY_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  easy:   { label: 'Fácil',   color: 'bg-emerald-100 text-emerald-700', icon: '🌿' },
  medium: { label: 'Media',   color: 'bg-yellow-100 text-yellow-700',   icon: '⚡' },
  hard:   { label: 'Difícil', color: 'bg-orange-100 text-orange-700',   icon: '🔥' },
  epic:   { label: 'Épica',   color: 'bg-purple-100 text-purple-700',   icon: '💎' },
};

/** Build a human-readable description of what to look for */
function CriteriaBanner({ rules, difficulty }: { rules: MatchRules; difficulty?: string }) {
  const hasRules = rules && (rules.country || rules.city || rules.required_tags?.length || rules.any_tags?.length);
  if (!hasRules && !difficulty) return null;

  const parts: string[] = [];
  if (rules.required_tags?.length) parts.push(rules.required_tags.join(', '));
  if (rules.any_tags?.length) parts.push(rules.any_tags.join(' / '));

  const locationParts: string[] = [];
  if (rules.city) locationParts.push(rules.city);
  if (rules.country) locationParts.push(rules.country);

  const diff = difficulty ? DIFFICULTY_CONFIG[difficulty] : null;

  return (
    <div className='mt-3 bg-white/50 border border-stone-200/60 rounded-xl px-3.5 py-2.5 space-y-1.5'>
      {/* Difficulty badge */}
      {diff && (
        <div className='flex items-center gap-1.5'>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${diff.color}`}>
            {diff.icon} {diff.label}
          </span>
        </div>
      )}

      {/* What to look for */}
      {parts.length > 0 && (
        <div className='flex items-start gap-2'>
          <Search className='w-3.5 h-3.5 text-stone-400 mt-0.5 shrink-0' />
          <p className='text-[11px] text-stone-600'>
            <span className='text-stone-400'>Buscá:</span>{' '}
            <span className='font-semibold text-stone-700'>{parts.join(', ')}</span>
          </p>
        </div>
      )}

      {/* Location */}
      {locationParts.length > 0 && (
        <div className='flex items-start gap-2'>
          <MapPin className='w-3.5 h-3.5 text-stone-400 mt-0.5 shrink-0' />
          <p className='text-[11px] text-stone-600'>
            <span className='text-stone-400'>En:</span>{' '}
            <span className='font-semibold text-stone-700'>{locationParts.join(', ')}</span>
          </p>
        </div>
      )}

      {/* Tag pills */}
      {(rules.required_tags?.length || rules.any_tags?.length) ? (
        <div className='flex flex-wrap gap-1 pt-0.5'>
          {rules.required_tags?.map(t => (
            <span key={t} className='inline-flex items-center gap-0.5 bg-amber-100/80 text-amber-700 text-[9px] font-medium px-2 py-0.5 rounded-full'>
              <Tag className='w-2.5 h-2.5' />{t}
            </span>
          ))}
          {rules.any_tags?.map(t => (
            <span key={t} className='inline-flex items-center gap-0.5 bg-stone-100 text-stone-500 text-[9px] font-medium px-2 py-0.5 rounded-full'>
              <Tag className='w-2.5 h-2.5' />{t}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function SlotCard({
  slot,
  index,
  onClick,
}: {
  slot: AlbumSlot;
  index: number;
  onClick?: () => void;
}) {
  // Load image for owned, claimed (by others), and hint slots
  const hasImage = slot.is_owned || slot.is_claimed || slot.is_hint;
  const imgUrl = useSignedImage(
    hasImage ? slot.illustration_url : null,
    { width: WIDTHS.mobile },
  );

  return (
    <motion.div
      className={`relative ${onClick ? 'cursor-pointer active:scale-95 transition-transform' : ''}`}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.04 }}
      onClick={onClick}
    >
      <div
        className={`bg-white p-1.5 pb-3 rounded-sm shadow-md transition-all ${
          slot.is_owned ? '' : 'opacity-70'
        }`}
      >
        <div className='aspect-[3/4] overflow-hidden rounded-[2px] bg-stone-100 relative flex items-center justify-center'>
          {slot.is_owned && imgUrl ? (
            <div className='w-full h-full relative'>
              <img
                src={imgUrl}
                alt={slot.slot_label}
                loading='lazy'
                decoding='async'
                className='w-full h-full object-cover'
              />
              {/* PostalPeek seal */}
              <div className='absolute bottom-1 right-1 w-7 h-7 text-red-800/50 rotate-[-12deg] pointer-events-none'>
                <PostalPeekStampSVG className='w-full h-full' />
              </div>
            </div>
          ) : slot.is_claimed && imgUrl ? (
            /* Someone else has it — show the image with a subtle overlay */
            <div className='w-full h-full relative'>
              <img
                src={imgUrl}
                alt={slot.slot_label}
                loading='lazy'
                decoding='async'
                className='w-full h-full object-cover saturate-50 brightness-90'
              />
              <div className='absolute inset-0 bg-stone-900/20 flex flex-col items-center justify-center gap-1'>
                <span className='bg-black/40 backdrop-blur-sm text-white/90 text-[8px] font-semibold px-2 py-0.5 rounded-full'>
                  Adquirida
                </span>
              </div>
            </div>
          ) : slot.is_hint && imgUrl ? (
            /* Hint slot — greyed-out example postcard */
            <div className='w-full h-full relative'>
              <img
                src={imgUrl}
                alt='Pista'
                loading='lazy'
                decoding='async'
                className='w-full h-full object-cover grayscale opacity-30'
              />
              <div className='absolute inset-0 flex flex-col items-center justify-center gap-1'>
                <Eye className='w-5 h-5 text-stone-500/70' />
                <span className='text-[8px] text-stone-500/80 font-semibold'>Pista</span>
              </div>
            </div>
          ) : (
            /* Nobody has it yet — mystery blur */
            <div className='w-full h-full bg-gradient-to-br from-amber-50 to-stone-100 flex flex-col items-center justify-center gap-1'>
              <HelpCircle className='w-6 h-6 text-amber-400/60' />
              <span className='text-[8px] text-amber-500/60'>???</span>
            </div>
          )}

          {/* Slot number */}
          <span className='absolute top-1 left-1.5 text-[8px] font-mono text-stone-400/80 bg-white/70 px-1 rounded'>
            #{slot.slot_order}
          </span>
        </div>

        {/* Label */}
        <p className='text-center font-handwriting text-[9px] sm:text-[10px] text-stone-500 mt-1 truncate px-0.5'>
          {slot.slot_label}
        </p>
      </div>
    </motion.div>
  );
}

export function AlbumDetail({ detail, isLoading, onClose }: AlbumDetailProps) {
  const { album, slots, completed_at } = detail;
  const { user } = useFeedContext();
  const [showAuthGate, setShowAuthGate] = React.useState(false);

  let optimisticSlots = slots;
  try {
    const guestClaimedId = sessionStorage.getItem('postalpeek_guest_claim');
    if (guestClaimedId) {
      optimisticSlots = slots.map(s => 
        s.postcard_id === guestClaimedId ? { ...s, is_owned: true } : s
      );
    }
  } catch {
    // Ignore session storage errors
  }

  const ownedCount = optimisticSlots.filter((s) => s.is_owned).length;
  const totalSlots = optimisticSlots.length;
  const progress = totalSlots > 0 ? Math.round((ownedCount / totalSlots) * 100) : 0;
  const isComplete = completed_at !== null || (totalSlots > 0 && ownedCount === totalSlots);

  return (
    <motion.div
      className='fixed inset-0 z-[160] bg-[#e6e2da] overflow-hidden flex flex-col'
      initial={{ opacity: 0, x: '100%' }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: '100%' }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      {/* Header */}
      <div className='shrink-0 px-4 pt-4 pb-2'>
        <div className='flex items-center justify-between mb-3'>
          <button
            onClick={onClose}
            className='p-2 rounded-full bg-white/60 hover:bg-white/80 text-stone-500 hover:text-stone-700 transition-colors'
          >
            <ArrowLeft className='w-5 h-5' />
          </button>

          {isComplete && (
            <span className='flex items-center gap-1 bg-amber-100 text-amber-700 text-xs font-semibold px-3 py-1 rounded-full'>
              <Trophy className='w-3.5 h-3.5' />
              ¡Completo!
            </span>
          )}
        </div>

        <h2 className='font-serif text-lg text-stone-800 tracking-tight'>
          {album.title}
        </h2>
        {album.description && (
          <p className='text-xs text-stone-400 mt-0.5 line-clamp-2'>{album.description}</p>
        )}

        {/* Criteria banner: what to look for */}
        <CriteriaBanner rules={album.match_rules} difficulty={album.difficulty} />

        {/* Progress bar */}
        <div className='flex items-center gap-3 mt-3'>
          <div className='flex-1 bg-stone-300/30 rounded-full h-2 overflow-hidden'>
            <motion.div
              className={`h-full rounded-full ${isComplete ? 'bg-amber-500' : 'bg-stone-500'}`}
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            />
          </div>
          <span className='text-xs text-stone-500 font-mono shrink-0'>
            {ownedCount}/{totalSlots}
          </span>
        </div>
      </div>

      {/* Slot grid */}
      <div className='flex-1 overflow-y-auto px-4 pb-8 pt-3'>
        {isLoading ? (
          <div className='flex items-center justify-center h-40'>
            <div className='w-8 h-8 border-2 border-stone-300 border-t-stone-600 rounded-full animate-spin' />
          </div>
        ) : (
          <div className='grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3'>
            {optimisticSlots.map((slot, i) => (
              <SlotCard
                key={slot.slot_order}
                slot={slot}
                index={i}
                onClick={() => {
                  if (!slot.is_owned && !user) {
                    setShowAuthGate(true);
                  }
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Reward hint */}
      {!isComplete && (
        <div className='shrink-0 px-4 pb-4'>
          <div className='bg-amber-50/80 border border-amber-200/50 rounded-xl px-4 py-2.5 text-center'>
            <span className='text-xs text-amber-600'>
              🏆 Completá este álbum y ganá <strong>+{album.reward_claims} reclamos</strong> de bonus
            </span>
          </div>
        </div>
      )}

      {/* ── Auth Gate ── */}
      {showAuthGate && (
        <AuthGateModal
          onSuccess={() => setShowAuthGate(false)}
        />
      )}
    </motion.div>
  );
}

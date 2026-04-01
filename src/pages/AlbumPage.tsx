/**
 * AlbumPage.tsx — /album/:albumId
 *
 * Standalone page for viewing a single album with full slot grid,
 * progress, criteria, and reward info. Deep-linkable.
 */

import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Trophy,
  HelpCircle,
  Eye,
  MapPin,
  Share2,
} from 'lucide-react';
import { PostalPeekStampSVG } from '../components/ui/PostalPeekStampSVG';
import { useAlbumDetail } from '../hooks/useAlbumDetail';
import type { AlbumSlot } from '../hooks/useAlbumDetail';
import { useFeedContext } from './feed/FeedLayout';
import { AuthGateModal } from '../components/AuthGateModal';
import type { FeedItem } from '../components/Postcard';
import { useSignedImage } from '../utils/useSignedImage';
import { WIDTHS } from '../utils/imageUtils';
import { useLang, t } from '../utils/i18n';
import { analytics } from '../lib/analytics';

// ── Difficulty config ──────────────────────────────────────────────────

const DIFFICULTY_CONFIG: Record<
  string,
  { label: { es: string; en: string }; color: string; bg: string; icon: string }
> = {
  easy: {
    label: { es: 'Fácil', en: 'Easy' },
    color: 'text-emerald-700',
    bg: 'bg-emerald-100',
    icon: '🌿',
  },
  medium: {
    label: { es: 'Media', en: 'Medium' },
    color: 'text-yellow-700',
    bg: 'bg-yellow-100',
    icon: '⚡',
  },
  hard: {
    label: { es: 'Difícil', en: 'Hard' },
    color: 'text-orange-700',
    bg: 'bg-orange-100',
    icon: '🔥',
  },
  epic: {
    label: { es: 'Épica', en: 'Epic' },
    color: 'text-purple-700',
    bg: 'bg-purple-100',
    icon: '💎',
  },
};

// ── Slot Card ──────────────────────────────────────────────────────────

function SlotCard({ slot, index, onClick }: { slot: AlbumSlot; index: number; onClick?: () => void }) {
  const lang = useLang();
  // Always load the image URL — needed for mystery blur preview too
  const imgUrl = useSignedImage(
    slot.illustration_url ?? null,
    { width: WIDTHS.mobile },
  );

  return (
    <motion.div
      className={`relative ${onClick ? 'cursor-pointer active:scale-95 transition-transform' : ''}`}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: Math.min(index * 0.04, 0.4) }}
      onClick={onClick}
    >
      <div
        className={`bg-white p-1.5 pb-3 rounded-sm shadow-md transition-all ${
          slot.is_owned ? '' : 'opacity-70'
        }`}
      >
        <div className="aspect-[3/4] overflow-hidden rounded-[2px] bg-stone-100 relative flex items-center justify-center">
          {slot.is_owned ? (
            // Owned: show full image + stamp (shimmer while loading)
            <div className="w-full h-full relative">
              {imgUrl ? (
                <img
                  src={imgUrl}
                  alt={slot.slot_label}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover"
                />
              ) : (
                // Loading shimmer
                <div className="w-full h-full bg-gradient-to-br from-stone-200 to-stone-100 animate-pulse" />
              )}
              {/* PostalPeek seal — always visible once is_owned */}
              <div className="absolute bottom-1 right-1 w-7 h-7 text-red-800/50 rotate-[-12deg] pointer-events-none">
                <PostalPeekStampSVG className="w-full h-full" />
              </div>
            </div>
          ) : slot.is_claimed && imgUrl ? (
            /* Someone else has it — show image with subtle overlay */
            <div className="w-full h-full relative">
              <img
                src={imgUrl}
                alt={slot.slot_label}
                loading="lazy"
                decoding="async"
                className="w-full h-full object-cover saturate-50 brightness-90"
              />
              <div className="absolute inset-0 bg-stone-900/20 flex flex-col items-center justify-center gap-1">
                <span className="bg-black/40 backdrop-blur-sm text-white/90 text-[8px] font-semibold px-2 py-0.5 rounded-full">
                  {t({ es: 'Adquirida', en: 'Claimed' }, lang)}
                </span>
              </div>
            </div>
          ) : slot.is_hint && imgUrl ? (
            <div className="w-full h-full relative">
              <img
                src={imgUrl}
                alt={t({ es: 'Pista', en: 'Hint' }, lang)}
                loading="lazy"
                decoding="async"
                className="w-full h-full object-cover grayscale opacity-30"
              />
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
                <Eye className="w-5 h-5 text-stone-500/70" />
                <span className="text-[8px] text-stone-500/80 font-semibold">
                  {t({ es: 'Pista', en: 'Hint' }, lang)}
                </span>
              </div>
            </div>
          ) : imgUrl ? (
            /* Mystery slot — blurred teaser of the real card */
            <div className="w-full h-full relative overflow-hidden">
              <img
                src={imgUrl}
                alt="???"
                loading="lazy"
                decoding="async"
                className="w-full h-full object-cover blur-sm scale-105 brightness-75 saturate-75"
              />
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5">
                <div className="w-7 h-7 rounded-full bg-white/10 border border-white/20 flex items-center justify-center backdrop-blur-sm">
                  <HelpCircle className="w-4 h-4 text-white/70" />
                </div>
                <span className="text-[8px] text-white/50 font-semibold tracking-widest">???</span>
              </div>
            </div>
          ) : (
            /* No image at all — plain mystery placeholder */
            <div className="w-full h-full bg-gradient-to-br from-amber-50 to-stone-100 flex flex-col items-center justify-center gap-1">
              <HelpCircle className="w-6 h-6 text-amber-400/60" />
              <span className="text-[8px] text-amber-500/60">???</span>
            </div>
          )}

          {/* Slot number */}
          <span className="absolute top-1 left-1.5 text-[8px] font-mono text-stone-400/80 bg-white/70 px-1 rounded">
            #{slot.slot_order}
          </span>
        </div>

        {/* Label */}
        <p className="text-center font-handwriting text-[9px] sm:text-[10px] text-stone-500 mt-1 truncate px-0.5">
          {slot.slot_label}
        </p>
      </div>
    </motion.div>
  );
}

// ── Album Page (standalone) ────────────────────────────────────────────

export function AlbumPage() {
  const { albumId } = useParams<{ albumId: string }>();
  const navigate = useNavigate();
  const lang = useLang();
  const { user } = useFeedContext();
  const [showAuthGate, setShowAuthGate] = React.useState(false);

  const { detail, isLoading, fetchDetail } = useAlbumDetail();

  useEffect(() => {
    if (albumId) {
      fetchDetail(albumId);
      analytics.track('album_page_viewed', { album_id: albumId });
    }
  }, [albumId, fetchDetail]);

  let optimisticSlots = detail?.slots || [];
  try {
    const guestClaimedId = sessionStorage.getItem('postalpeek_guest_claim');
    if (guestClaimedId) {
      optimisticSlots = optimisticSlots.map(s => 
        s.postcard_id === guestClaimedId ? { ...s, is_owned: true } : s
      );
    }
  } catch {
    // Ignore session storage errors
  }

  // ── Loading state ──
  if (isLoading || !detail) {
    return (
      <div className="min-h-[100dvh] bg-[#e6e2da] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-stone-300 border-t-stone-600 rounded-full animate-spin" />
      </div>
    );
  }

  const { album, completed_at } = detail;

  const albumTitle = t({ es: album.title_es || album.title, en: album.title_en || album.title }, lang);
  const albumDescription = album.description_es || album.description_en
    ? t({ es: album.description_es || album.description || '', en: album.description_en || album.description || '' }, lang)
    : album.description;
  const ownedCount = optimisticSlots.filter((s) => s.is_owned).length;
  const totalSlots = optimisticSlots.length;
  const progress =
    totalSlots > 0 ? Math.round((ownedCount / totalSlots) * 100) : 0;
  const isComplete = completed_at !== null || (totalSlots > 0 && ownedCount === totalSlots);

  const coverUrl = album.cover_image_url;

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: albumTitle, url });
      } catch {
        /* user cancelled */
      }
    } else {
      navigator.clipboard.writeText(url);
    }
    analytics.track('album_shared', { album_id: album.id });
  };

  return (
    <div className="h-[100dvh] bg-[#e6e2da] flex flex-col overflow-y-auto">
      {/* ── Hero Cover ── */}
      <AlbumHero
        title={albumTitle}
        coverUrl={coverUrl}
        isComplete={isComplete}
        ownedCount={ownedCount}
        totalSlots={totalSlots}
        progress={progress}
        difficulty={album.difficulty}
        country={album.country}
        onBack={() => navigate('/feed')}
        onShare={handleShare}
      />

      {/* ── Content ── */}
      <div className="flex-1 px-4 pb-10 max-w-3xl mx-auto w-full">
        {/* Description */}
        {albumDescription && (
          <p className="text-sm text-stone-500 mt-4 mb-3 leading-relaxed italic">
            {albumDescription}
          </p>
        )}

        {/* Difficulty badge */}
        {album.difficulty && DIFFICULTY_CONFIG[album.difficulty] && (
          <div className="mb-5">
            {(() => {
              const diff = DIFFICULTY_CONFIG[album.difficulty];
              return (
                <div className="flex items-center gap-1.5">
                  <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${diff.bg} ${diff.color}`}>
                    {diff.icon} {t(diff.label, lang)}
                  </span>
                </div>
              );
            })()}
          </div>
        )}

        {/* Slot grid */}
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
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

        {/* Reward hint */}
        {!isComplete && (
          <div className="mt-6 bg-amber-50/80 border border-amber-200/50 rounded-xl px-4 py-3 text-center">
            <span className="text-xs text-amber-600">
              🏆{' '}
              {t(
                {
                  es: `Completá este álbum y ganá +${album.reward_claims} reclamos de bonus`,
                  en: `Complete this album and earn +${album.reward_claims} bonus claims`,
                },
                lang,
              )}
            </span>
          </div>
        )}

        {/* Completion celebration */}
        {isComplete && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mt-6 bg-gradient-to-br from-amber-100 to-amber-50 border border-amber-300/50 rounded-2xl px-5 py-5 text-center"
          >
            <span className="text-3xl">🏆</span>
            <h3 className="font-serif text-lg text-amber-800 font-bold mt-2">
              {t({ es: '¡Álbum Completo!', en: 'Album Complete!' }, lang)}
            </h3>
            <p className="text-xs text-amber-600 mt-1">
              {t(
                {
                  es: `Ganaste +${album.reward_claims} reclamos de bonus`,
                  en: `You earned +${album.reward_claims} bonus claims`,
                },
                lang,
              )}
            </p>
          </motion.div>
        )}
      </div>

      {/* ── Auth Gate ── */}
      <AnimatePresence>
        {showAuthGate && (
          <AuthGateModal
            onSuccess={() => setShowAuthGate(false)}
            onClose={() => setShowAuthGate(false)}
            viewedItems={optimisticSlots
              .filter((s) => s.illustration_url)
              .map((s) => ({
                id: s.postcard_id || s.slot_label,
                illustration_url: s.illustration_url!,
                city: s.city || '',
                country: s.country || '',
                category: s.category || '',
              })) as FeedItem[]}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Hero Section ───────────────────────────────────────────────────────

function AlbumHero({
  title,
  coverUrl,
  isComplete,
  ownedCount,
  totalSlots,
  progress,
  difficulty,
  country,
  onBack,
  onShare,
}: {
  title: string;
  coverUrl: string | null;
  isComplete: boolean;
  ownedCount: number;
  totalSlots: number;
  progress: number;
  difficulty: string;
  country: string | null;
  onBack: () => void;
  onShare: () => void;
}) {
  const lang = useLang();
  const signedCover = useSignedImage(coverUrl, { width: WIDTHS.desktop });
  const diff = difficulty ? DIFFICULTY_CONFIG[difficulty] : null;

  return (
    <div className="relative w-full h-56 sm:h-64 md:h-72 overflow-hidden shrink-0">
      {/* Background image */}
      {signedCover ? (
        <img
          src={signedCover}
          alt={title}
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-amber-600/30 via-stone-700 to-stone-900" />
      )}

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#e6e2da] via-black/40 to-black/20" />

      {/* Top nav */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 pt-[env(safe-area-inset-top,12px)]">
        <button
          onClick={onBack}
          className="p-2 rounded-full bg-black/30 backdrop-blur-md text-white hover:bg-black/50 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2">
          {isComplete && (
            <span className="flex items-center gap-1 bg-amber-500 text-white text-[10px] font-bold uppercase px-2.5 py-1 rounded-full shadow-sm">
              <Trophy className="w-3 h-3" />
              {t({ es: 'Completo', en: 'Complete' }, lang)}
            </span>
          )}
          <button
            onClick={onShare}
            className="p-2 rounded-full bg-black/30 backdrop-blur-md text-white hover:bg-black/50 transition-colors"
          >
            <Share2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Bottom content overlayed */}
      <div className="absolute bottom-0 left-0 right-0 z-20 px-4 pb-4">
        {/* Pills */}
        <div className="flex items-center gap-1.5 mb-2">
          {diff && diff.label && (
            <span className="bg-black/40 backdrop-blur-sm text-white text-[10px] font-semibold px-2 py-0.5 rounded-full">
              {diff.icon} {t(diff.label, lang)}
            </span>
          )}
          {country && (
            <span className="bg-black/40 backdrop-blur-sm text-white text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1">
              <MapPin className="w-2.5 h-2.5" />
              {country}
            </span>
          )}
        </div>

        {/* Title */}
        <h1 className="font-serif text-2xl md:text-3xl text-white font-bold leading-tight drop-shadow-lg mb-3">
          {title}
        </h1>

        {/* Progress bar */}
        <div className="flex items-center gap-3">
          <div className="flex-1 bg-white/20 backdrop-blur-sm rounded-full h-2 overflow-hidden">
            <motion.div
              className={`h-full rounded-full ${isComplete ? 'bg-amber-400' : 'bg-white/90'}`}
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
          </div>
          <span className="text-sm text-white font-mono font-medium drop-shadow-sm">
            {ownedCount}/{totalSlots}
          </span>
        </div>
      </div>
    </div>
  );
}

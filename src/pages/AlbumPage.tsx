/**
 * AlbumPage.tsx — /album/:albumId
 *
 * Standalone page for viewing a single album with full slot grid,
 * progress, criteria, and reward info. Deep-linkable.
 */

import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Trophy,
  HelpCircle,
  Eye,
  Search,
  MapPin,
  Tag,
  Share2,
} from 'lucide-react';
import { useAlbumDetail } from '../hooks/useAlbumDetail';
import type { AlbumSlot, MatchRules } from '../hooks/useAlbumDetail';
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

// ── Criteria Banner ────────────────────────────────────────────────────

function CriteriaBanner({
  rules,
  difficulty,
}: {
  rules: MatchRules;
  difficulty?: string;
}) {
  const lang = useLang();
  const hasRules =
    rules &&
    (rules.country ||
      rules.city ||
      rules.required_tags?.length ||
      rules.any_tags?.length);
  if (!hasRules && !difficulty) return null;

  const parts: string[] = [];
  if (rules.required_tags?.length) parts.push(rules.required_tags.join(', '));
  if (rules.any_tags?.length) parts.push(rules.any_tags.join(' / '));

  const locationParts: string[] = [];
  if (rules.city) locationParts.push(rules.city);
  if (rules.country) locationParts.push(rules.country);

  const diff = difficulty ? DIFFICULTY_CONFIG[difficulty] : null;

  return (
    <div className="bg-white/60 backdrop-blur-sm border border-stone-200/60 rounded-2xl px-4 py-3 space-y-2">
      {diff && (
        <div className="flex items-center gap-1.5">
          <span
            className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${diff.bg} ${diff.color}`}
          >
            {diff.icon} {t(diff.label, lang)}
          </span>
        </div>
      )}

      {parts.length > 0 && (
        <div className="flex items-start gap-2">
          <Search className="w-3.5 h-3.5 text-stone-400 mt-0.5 shrink-0" />
          <p className="text-[11px] text-stone-600">
            <span className="text-stone-400">
              {t({ es: 'Buscá:', en: 'Look for:' }, lang)}
            </span>{' '}
            <span className="font-semibold text-stone-700">
              {parts.join(', ')}
            </span>
          </p>
        </div>
      )}

      {locationParts.length > 0 && (
        <div className="flex items-start gap-2">
          <MapPin className="w-3.5 h-3.5 text-stone-400 mt-0.5 shrink-0" />
          <p className="text-[11px] text-stone-600">
            <span className="text-stone-400">
              {t({ es: 'En:', en: 'In:' }, lang)}
            </span>{' '}
            <span className="font-semibold text-stone-700">
              {locationParts.join(', ')}
            </span>
          </p>
        </div>
      )}

      {(rules.required_tags?.length || rules.any_tags?.length) && (
        <div className="flex flex-wrap gap-1 pt-0.5">
          {rules.required_tags?.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-0.5 bg-amber-100/80 text-amber-700 text-[9px] font-medium px-2 py-0.5 rounded-full"
            >
              <Tag className="w-2.5 h-2.5" />
              {tag}
            </span>
          ))}
          {rules.any_tags?.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-0.5 bg-stone-100 text-stone-500 text-[9px] font-medium px-2 py-0.5 rounded-full"
            >
              <Tag className="w-2.5 h-2.5" />
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Slot Card ──────────────────────────────────────────────────────────

function SlotCard({ slot, index }: { slot: AlbumSlot; index: number }) {
  const lang = useLang();
  const imgUrl = useSignedImage(
    slot.is_owned || slot.is_hint ? slot.illustration_url : null,
    { width: WIDTHS.mobile },
  );

  return (
    <motion.div
      className="relative"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: Math.min(index * 0.04, 0.4) }}
    >
      <div
        className={`bg-white p-1.5 pb-3 rounded-sm shadow-md transition-all ${
          slot.is_owned ? '' : 'opacity-70'
        }`}
      >
        <div className="aspect-[3/4] overflow-hidden rounded-[2px] bg-stone-100 relative flex items-center justify-center">
          {slot.is_owned && imgUrl ? (
            <img
              src={imgUrl}
              alt={slot.slot_label}
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover"
            />
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
          ) : slot.is_claimed ? (
            <div className="w-full h-full bg-gradient-to-br from-stone-200 to-stone-300 flex flex-col items-center justify-center gap-1">
              <HelpCircle className="w-6 h-6 text-stone-400" />
              <span className="text-[8px] text-stone-400">
                {t({ es: 'Adquirida', en: 'Claimed' }, lang)}
              </span>
            </div>
          ) : (
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

  const { detail, isLoading, fetchDetail } = useAlbumDetail();

  useEffect(() => {
    if (albumId) {
      fetchDetail(albumId);
      analytics.track('album_page_viewed', { album_id: albumId });
    }
  }, [albumId, fetchDetail]);

  // ── Loading state ──
  if (isLoading || !detail) {
    return (
      <div className="min-h-[100dvh] bg-[#e6e2da] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-stone-300 border-t-stone-600 rounded-full animate-spin" />
      </div>
    );
  }

  const { album, slots, completed_at } = detail;
  const ownedCount = slots.filter((s) => s.is_owned).length;
  const totalSlots = slots.length;
  const progress =
    totalSlots > 0 ? Math.round((ownedCount / totalSlots) * 100) : 0;
  const isComplete = completed_at !== null;

  const coverUrl = album.cover_image_url;

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: album.title, url });
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
        title={album.title}
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
        {album.description && (
          <p className="text-sm text-stone-500 mt-4 mb-3 leading-relaxed italic">
            {album.description}
          </p>
        )}

        {/* Criteria */}
        <div className="mb-5">
          <CriteriaBanner
            rules={album.match_rules}
            difficulty={album.difficulty}
          />
        </div>

        {/* Slot grid */}
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
          {slots.map((slot, i) => (
            <SlotCard key={slot.slot_order} slot={slot} index={i} />
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

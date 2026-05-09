/**
 * useViewfinder.ts
 *
 * Hook that manages the Viewfinder capture state.
 * Orchestrates: POV capture → Street View static → AI illustration → naming → save.
 *
 * Simplified flow (v2):
 *   idle → preview (show local snapshot) → illustrating → naming (enter name) → success
 *
 * ref #94
 */

import { useState, useCallback } from 'react';
import { t, useLang } from '../utils/i18n';
import { supabase } from '@eb-packages/logic/src/supabase';
import { getDeviceId } from '../utils/deviceId';
import {
  createUserPostcard,
  enrichPostcardMetadata,
  type UserPostcard,
  type CreateUserPostcardParams,
  type CreateUserPostcardResult,
} from '../services/userPostcardService';
import type { StreetViewPOV } from '../components/StreetViewPanorama';
import type { FeedItem } from '../components/Postcard';
import { analytics } from '../lib/analytics';
import { RateLimitError } from '../services/googleMaps';

export type ViewfinderStep =
  | 'viewfinder'    // Panorama is interactive, user is composing
  | 'preview'       // User took a snapshot — showing polaroid preview
  | 'illustrating'  // AI illustration in progress
  | 'naming'        // Postcard ready — user enters their display name
  | 'success'       // Postcard saved, showing result
  | 'error';        // Something went wrong

const CREATOR_NAME_KEY = 'postalpeek_creator_name';

export interface UseViewfinderReturn {
  step: ViewfinderStep;
  capturedPostcard: UserPostcard | null;
  /** Full FeedItem built from the capture — ready for <Postcard> / <PostcardBack> */
  capturedFeedItem: FeedItem | null;
  capturedPov: StreetViewPOV | null;
  capturedDataUrl: string | null;
  errorMessage: string | null;
  illustrationStyle: string;
  isSaving: boolean;
  /** The display name the user entered (persisted in localStorage) */
  creatorName: string;
  setCreatorName: (name: string) => void;
  setIllustrationStyle: (style: string) => void;
  /** Called by the panorama's capture — transitions to preview */
  handleSnapshot: (pov: StreetViewPOV, dataUrl: string | null) => void;
  /** User confirms the preview — kicks off AI generation */
  handleGenerate: () => Promise<void>;
  /** User submits their name — saves postcard and transitions to success */
  handleConfirmName: (name: string) => Promise<void>;
  /** Save postcard to user's album */
  handleSave: () => Promise<boolean>;
  /** Daily trip counter — remaining generations today */
  tripRemaining: number;
  /** Daily trip limit */
  tripLimit: number;
  reset: () => void;
}

/** Build a FeedItem from a UserPostcard so <Postcard>/<PostcardBack> can render it */
function buildFeedItem(
  postcard: UserPostcard,
  sourceItem: FeedItem,
  pov: StreetViewPOV | null,
  creatorName?: string,
): FeedItem {
  return {
    id: postcard.id,
    country: postcard.country || sourceItem.country,
    city: postcard.city || sourceItem.city,
    location_name: postcard.location_name || sourceItem.location_name,
    lat: postcard.lat,
    lng: postcard.lng,
    original_image_url: postcard.original_image_url,
    illustration_url: postcard.illustration_url || '',
    category: postcard.category || sourceItem.category || '🎨 Arte Generado',
    description: postcard.description || sourceItem.description || '',
    created_at: postcard.created_at,
    creator_name: creatorName || postcard.creator_name || null,
    streetview_pov: pov ? {
      heading: pov.heading,
      pitch: pov.pitch,
      fov: pov.zoom <= 0 ? 120 : Math.max(30, 120 - pov.zoom * 30),
      pano_id: pov.panoId,
    } : sourceItem.streetview_pov,
    generation_metadata: postcard.generation_metadata || {},
    is_user_generated: true,
  };
}

/**
 * Full illustration style catalog.
 * Each key is sent to the edge function as `style`.
 * Weighted distribution: common styles appear more often.
 */
const ILLUSTRATION_STYLES = [
  // ── Fine Art & Traditional ──────────────────────────────────────────
  'watercolor',
  'watercolor',          // 2x weight — fan favourite
  'gouache',
  'oil-painting',
  'acrylic-painting',
  'pastel-chalk',
  'ink-wash',            // Chinese/Japanese sumi-e feel
  'pencil-sketch',
  'charcoal-sketch',
  'etching',             // Classical engraving look
  // ── Retro & Vintage ─────────────────────────────────────────────────
  'vintage-postcard',
  'vintage-postcard',    // 2x weight
  'retro-travel-poster',
  'soviet-propaganda',   // Bold flat shapes, red/gold
  'art-nouveau',         // Alphonse Mucha style
  'art-deco',            // Geometric elegance
  'linocut',             // Woodblock print texture
  'risograph',           // Overlapping duotone grain
  // ── Illustration & Comics ───────────────────────────────────────────
  'studio-ghibli',       // Warm painted anime
  'comic-book',          // Halftone dots, bold outlines
  'ligne-claire',        // Hergé / Tintin clean lines
  'ukiyo-e',             // Japanese woodblock waves
  'flat-design',         // Bold shapes, minimal shadows
  'isometric',           // Geometric 3D flat illustration
  // ── Modern & Digital ────────────────────────────────────────────────
  'pop-art',
  'neon-cyberpunk',      // Dark bg, glowing accents
  'vaporwave',           // Pink/purple retro-digital
  'pixel-art',           // 8-bit / 16-bit game aesthetic
  'low-poly',            // Triangulated facets
  'glitch-art',          // Digital corruption artifacts
  // ── Atmospheric & Painterly ─────────────────────────────────────────
  'impressionist',       // Monet / Renoir brushwork
  'expressionist',       // Munch / Kirchner emotional distortion
  'pointillist',         // Seurat dot technique
  'luminism',            // Turner golden light effects
];

/** Pick a random style with no memory (pure random) */
function pickRandomStyle(): string {
  return ILLUSTRATION_STYLES[Math.floor(Math.random() * ILLUSTRATION_STYLES.length)];
}

export function useViewfinder(
  userId: string | undefined,
  sourceItem: FeedItem | null,
  userIsAnonymous: boolean = false,
): UseViewfinderReturn {
  const lang = useLang();
  const [step, setStep] = useState<ViewfinderStep>('viewfinder');
  const [capturedPostcard, setCapturedPostcard] = useState<UserPostcard | null>(
    null,
  );
  const [capturedFeedItem, setCapturedFeedItem] = useState<FeedItem | null>(null);
  const [capturedPov, setCapturedPov] = useState<StreetViewPOV | null>(null);
  const [capturedDataUrl, setCapturedDataUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [illustrationStyle, setIllustrationStyle] = useState('watercolor');
  const [isSaving, setIsSaving] = useState(false);
  const [tripRemaining, setTripRemaining] = useState(5);
  const [tripLimit, setTripLimit] = useState(5);

  // Load persisted creator name from localStorage
  const [creatorName, setCreatorNameState] = useState<string>(
    () => localStorage.getItem(CREATOR_NAME_KEY) || ''
  );

  const setCreatorName = useCallback((name: string) => {
    setCreatorNameState(name);
  }, []);

  // Step 2: User confirms preview → generate AI illustration (now triggered automatically)
  const handleGenerate = useCallback(async (overridePov?: StreetViewPOV) => {
    const povToUse = overridePov || capturedPov;

    if (!sourceItem || !povToUse) {
      setErrorMessage('Missing capture data — please retake the photo');
      setStep('error');
      return;
    }

    const randomStyle = pickRandomStyle();
    setIllustrationStyle(randomStyle);

    setStep('illustrating');
    setErrorMessage(null);

    analytics.track('viewfinder_capture_started', {
      source_postcard_id: sourceItem.id,
      lat: povToUse.lat,
      lng: povToUse.lng,
      heading: povToUse.heading,
      pitch: povToUse.pitch,
      style: randomStyle,
    });

    try {
      // source_postcard_id is optional traceability — it references postalpeek_postcards(id).
      // FeedItems can come from postalpeek_postcards (curated) OR postalpeek_user_postcards
      // (community-generated, prepended to the feed). Passing a user-postcard UUID here
      // would cause a FK violation. Since we have no reliable discriminator on FeedItem
      // without an extra query, we always pass null — safe and correct for MVP.
      const params: CreateUserPostcardParams = {
        userId: userId || undefined,
        deviceId: userId ? undefined : getDeviceId(),
        sourcePostcardId: null,
        pov: povToUse,
        city: sourceItem.city || '',
        country: sourceItem.country || '',
        locationName:
          sourceItem.location_name ||
          `${sourceItem.city}, ${sourceItem.country}`,
        style: randomStyle,
      };

      const result = await createUserPostcard(params);
      const postcard = result.postcard;

      // Update trip counter from edge function response
      setTripRemaining(result.remaining);
      setTripLimit(result.limit);

      setCapturedPostcard(postcard);
      
      // Build FeedItem for the <Postcard> / <PostcardBack> components
      const savedName = localStorage.getItem(CREATOR_NAME_KEY) || undefined;
      const feedItem = buildFeedItem(postcard, sourceItem, povToUse, savedName);
      setCapturedFeedItem(feedItem);
      
      // If user already has a name saved, skip naming step
      setStep(savedName ? 'success' : 'naming');

      analytics.track('viewfinder_postcard_created', {
        postcard_id: postcard.id,
        source_postcard_id: sourceItem.id,
        style: randomStyle,
        city: sourceItem.city,
        country: sourceItem.country,
      });

      // Fire metadata enrichment in the background (non-blocking)
      // This adds storytelling, stats, trivia to the postcard back
      enrichPostcardMetadata(postcard.id).then((enrichResult) => {
        if (enrichResult) {
          console.log('[Viewfinder] Metadata enrichment completed:', enrichResult);
          // Update the FeedItem with enriched metadata so PostcardBack re-renders
          setCapturedFeedItem(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              rarity: (enrichResult.rarity as FeedItem['rarity']) || prev.rarity,
              generation_metadata: {
                ...prev.generation_metadata,
                storytelling: enrichResult.storytelling,
                stats: enrichResult.stats,
                ...(enrichResult.trivia ? { trivia: enrichResult.trivia } : {}),
              },
            };
          });
        }
      });

    } catch (err) {
      console.error('Viewfinder capture failed:', err);

      if (err instanceof RateLimitError) {
        // Don't go to error screen — show a soft message and let the user retry later
        const msg = err.code === 'CIRCUIT_OPEN'
          ? '🌍 Hoy ya se generaron muchas postales. Volvé mañana para crear la tuya.'
          : '⏳ Demasiadas generaciones seguidas. Esperá unos minutos e intentá de nuevo.';
        setErrorMessage(msg);
        setStep('error');
        analytics.track('viewfinder_rate_limited', {
          code: err.code,
          source_postcard_id: sourceItem.id,
        });
        return;
      }

      let userMsg = err instanceof Error ? err.message : 'Failed to create postcard';
      if (userMsg.includes('Failed to send a request') || userMsg.includes('NetworkError')) {
        userMsg = '🔌 Error de red. Revisá tu conexión a internet e intentá de nuevo.';
      }

      setErrorMessage(userMsg);
      setStep('error');

      analytics.captureError(err, {
        context: 'viewfinder_capture',
        source_postcard_id: sourceItem.id,
      });
    }
  }, [userId, sourceItem, capturedPov, illustrationStyle]);

  // Step 1: Take a snapshot → jump directly to generating illustration
  const handleSnapshot = useCallback(
    (pov: StreetViewPOV, dataUrl: string | null) => {
      setCapturedPov(pov);
      setCapturedDataUrl(dataUrl);

      analytics.track('viewfinder_snapshot_taken', {
        source_postcard_id: sourceItem?.id,
        lat: pov.lat,
        lng: pov.lng,
        heading: pov.heading,
        pitch: pov.pitch,
      });
      
      // Immediately start generation flow
      handleGenerate(pov);
    },
    [sourceItem, handleGenerate],
  );

  // User submits their name in the naming step
  const handleConfirmName = useCallback(async (name: string): Promise<void> => {
    const trimmed = name.trim();
    // Persist name for future sessions
    if (trimmed) {
      localStorage.setItem(CREATOR_NAME_KEY, trimmed);
      setCreatorNameState(trimmed);
    }
    // Update the FeedItem immediately so the badge shows on the success card
    if (trimmed) {
      setCapturedFeedItem(prev => prev ? { ...prev, creator_name: trimmed } : prev);
    }
    // Update the postcard in the DB with the creator name
    if (capturedPostcard && trimmed) {
      supabase
        .from('postalpeek_user_postcards')
        .update({ creator_name: trimmed })
        .eq('id', capturedPostcard.id)
        .then(({ error }) => {
          if (error) console.warn('[Viewfinder] Failed to update creator_name:', error);
        });
    }
    analytics.track('viewfinder_name_submitted', {
      postcard_id: capturedPostcard?.id,
      has_name: !!trimmed,
    });
    setStep('success');
  }, [capturedPostcard]);

  // Step 3: Save to user's album (already in DB — this marks it as "saved" and signals completion)
  const handleSave = useCallback(async (): Promise<boolean> => {
    if (!capturedPostcard) return false;
    
    setIsSaving(true);
    try {
      // The postcard is already saved in the DB from createUserPostcard.
      // This action confirms the user wants to keep it.
      analytics.track('viewfinder_postcard_saved', {
        postcard_id: capturedPostcard.id,
        city: capturedPostcard.city,
        country: capturedPostcard.country,
      });
      
      return true;
    } finally {
      setIsSaving(false);
    }
  }, [capturedPostcard]);

  const reset = useCallback(() => {
    setStep('viewfinder');
    setCapturedPostcard(null);
    setCapturedFeedItem(null);
    setCapturedPov(null);
    setCapturedDataUrl(null);
    setErrorMessage(null);
  }, []);

  return {
    step,
    capturedPostcard,
    capturedFeedItem,
    capturedPov,
    capturedDataUrl,
    errorMessage,
    illustrationStyle,
    isSaving,
    creatorName,
    tripRemaining,
    tripLimit,
    setCreatorName,
    setIllustrationStyle,
    handleSnapshot,
    handleGenerate,
    handleConfirmName,
    handleSave,
    reset,
  };
}

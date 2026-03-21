/**
 * AdminPage.tsx — Full-screen admin dashboard at /admin
 *
 * Layout: left sidebar (nav + quick stats) + main content area
 * Accessible to admins via single click on footer.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  BarChart2,
  Zap,
  Image,
  Settings,
  RefreshCw,
  Clock,
  MapPin,
  CheckCircle,
  Loader,
  Scissors,
} from 'lucide-react';
import { supabase } from '@eb-packages/logic/src/supabase';
import { ILLUSTRATION_STYLES, ACTIVE_STYLE_KEY } from '../../../../eb-infra/supabase/functions/_shared/postcard-engine/illustration-styles.ts';
import type { User } from '@supabase/supabase-js';
import { useGenerationLog } from '../hooks/useGenerationLog';
import { useSignedImage } from '../utils/useSignedImage';
import { WIDTHS } from '../utils/imageUtils';
import type { GenerationLogEntry } from '../hooks/useGenerationLog';

// ── Types ──────────────────────────────────────────────────────────────

type NavSection = 'dashboard' | 'generation' | 'postcards' | 'settings';
type ActionStatus = 'idle' | 'loading' | 'success' | 'error';

interface AdminPageProps {
  user: User | null;
  onPostcardGenerated?: () => void;
}

interface UserStats {
  collectionCount: number;
  totalPostcards: number;
  unenrichedCount: number;
  noIllustrationTagsCount: number;
  albumsCount: number;
  albumsCompleted: number;
}

// ── Strategy badge colors ──────────────────────────────────────────────

function strategyColor(strategy: string | null): string {
  if (!strategy) return 'bg-stone-700/50 text-stone-400';
  if (strategy.startsWith('Themed Hunt')) return 'bg-amber-900/50 text-amber-300';
  if (strategy.startsWith('Dynamic Hunt')) return 'bg-orange-900/50 text-orange-300';
  if (strategy.includes('Wander')) return 'bg-indigo-900/50 text-indigo-300';
  if (strategy.includes('Trip') || strategy.includes('Album')) return 'bg-emerald-900/50 text-emerald-300';
  if (strategy.includes('Zigzag')) return 'bg-purple-900/50 text-purple-300';
  return 'bg-stone-700/50 text-stone-400';
}

function strategyShort(strategy: string | null): string {
  if (!strategy) return 'Unknown';
  if (strategy.startsWith('Themed Hunt: ')) return `🎯 ${strategy.replace('Themed Hunt: ', '')}`;
  if (strategy.startsWith('Dynamic Hunt: ')) return `🤖 ${strategy.replace('Dynamic Hunt: ', '')}`;
  if (strategy === 'Dynamic Global Wander') return '🌍 Wander';
  if (strategy === 'Zigzag Shared Place') return '📍 Zigzag';
  if (strategy.includes('Trip') || strategy.includes('Album')) return '✈️ Trip';
  return strategy;
}

function categoryLabel(cat: { es: string; en: string } | string | null): string {
  if (!cat) return '';
  if (typeof cat === 'string') return cat;
  return cat.en || cat.es || '';
}

function timeAgo(isoStr: string): string {
  const diff = Date.now() - new Date(isoStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ── Generation Log Card ────────────────────────────────────────────────

function LogCard({ entry }: { entry: GenerationLogEntry }) {
  const imgUrl = useSignedImage(entry.illustration_url, { width: WIDTHS.thumb });

  return (
    <motion.a
      href={`/p/${entry.id}`}
      target="_blank"
      rel="noopener noreferrer"
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex gap-3 p-3 rounded-xl hover:bg-white/5 transition-colors group cursor-pointer no-underline"
      style={{ textDecoration: 'none' }}
    >
      {/* Thumbnail */}
      <div className="w-14 h-20 rounded-lg overflow-hidden bg-white/5 shrink-0 group-hover:ring-1 group-hover:ring-white/20 transition-all">
        {imgUrl ? (
          <img src={imgUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white/20 text-xs">?</div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono font-medium ${strategyColor(entry.strategy)}`}>
            {strategyShort(entry.strategy)}
          </span>
          {entry.has_detailed_tags && (
            <CheckCircle className="w-3 h-3 text-emerald-400/60" />
          )}
        </div>

        <p className="text-white/90 text-sm font-medium truncate leading-tight">
          {entry.city}{entry.country ? `, ${entry.country}` : ''}
        </p>

        {entry.category && (
          <p className="text-white/40 text-xs truncate">{categoryLabel(entry.category)}</p>
        )}

        {entry.lat != null && entry.lng != null && (
          <div className="flex items-center gap-1 mt-1">
            <MapPin className="w-3 h-3 text-white/25 shrink-0" />
            <a
              href={`https://www.google.com/maps?q=${entry.lat},${entry.lng}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-indigo-400/70 hover:text-indigo-300 text-[10px] font-mono transition-colors"
              style={{ textDecoration: 'none' }}
            >
              {entry.lat.toFixed(4)}, {entry.lng.toFixed(4)}
            </a>
            {entry.streetview_pov?.heading != null && (
              <span className="text-white/20 text-[10px] font-mono">
                h:{Math.round(entry.streetview_pov.heading)}°
              </span>
            )}
          </div>
        )}

        <div className="flex items-center gap-1 mt-1">
          <Clock className="w-3 h-3 text-white/20" />
          <span className="text-white/30 text-[10px] font-mono">{timeAgo(entry.created_at)}</span>
          <span className="text-white/10 mx-0.5">·</span>
          <a
            href={`/p/${entry.id}`}
            onClick={(e) => e.stopPropagation()}
            className="text-white/20 hover:text-indigo-300 text-[10px] font-mono transition-colors"
            style={{ textDecoration: 'none' }}
          >
            🔍 {entry.id.slice(0, 8)}
          </a>
        </div>
      </div>
    </motion.a>

  );
}

// ── Reusable UI Primitives ─────────────────────────────────────────────

function ActionBtn({
  onClick,
  disabled,
  children,
  variant = 'default',
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'danger' | 'amber';
}) {
  const gradients = {
    default: 'linear-gradient(135deg, rgba(99,102,241,0.6), rgba(139,92,246,0.6))',
    success: 'linear-gradient(135deg, rgba(16,185,129,0.6), rgba(5,150,105,0.6))',
    danger:  'linear-gradient(135deg, rgba(239,68,68,0.5), rgba(220,38,38,0.5))',
    amber:   'linear-gradient(135deg, rgba(245,158,11,0.6), rgba(217,119,6,0.6))',
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full px-4 py-2.5 rounded-xl text-sm font-medium text-white transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 hover:brightness-110 border border-white/5"
      style={{ background: gradients[variant] }}
    >
      {children}
    </button>
  );
}

function StatusMsg({ status, message }: { status: ActionStatus; message: string }) {
  if (status === 'idle' || !message) return null;
  const colors = {
    loading: 'bg-indigo-950/60 text-indigo-300 border-indigo-700/30',
    success: 'bg-emerald-950/60 text-emerald-300 border-emerald-700/30',
    error:   'bg-red-950/60 text-red-300 border-red-700/30',
  } as const;
  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className={`mt-2 px-3 py-2 rounded-lg text-xs flex items-center gap-2 border ${colors[status]}`}
    >
      {status === 'loading' && <Loader className="w-3 h-3 animate-spin shrink-0" />}
      {status === 'success' && '✅'}
      {status === 'error' && '❌'}
      <span className="break-all">{message}</span>
    </motion.div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-white/50 text-[10px] uppercase tracking-widest font-semibold mb-3">
      {children}
    </h3>
  );
}

// ── Main Component ─────────────────────────────────────────────────────

const HUNT_THEME_OPTIONS = [
  { slug: 'monuments',   label: '🏛️ Monumentos Históricos' },
  { slug: 'skyscrapers', label: '🏙️ Rascacielos' },
  { slug: 'bridges',     label: '🌉 Puentes' },
  { slug: 'markets',     label: '🛒 Mercados y Bazares' },
  { slug: 'churches',    label: '⛪ Iglesias y Catedrales' },
  { slug: 'street_art',  label: '🎨 Arte Urbano' },
  { slug: 'staircases',  label: '🪜 Escaleras y Callejones' },
];

export function AdminPage({ user, onPostcardGenerated }: AdminPageProps) {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState<NavSection>('generation');

  // Stats
  const [stats, setStats] = useState<UserStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // Generation
  const [genStatus, setGenStatus] = useState<{ status: ActionStatus; message: string }>({ status: 'idle', message: '' });
  const [illustrationStyleKeys, setIllustrationStyleKeys] = useState<string[]>([ACTIVE_STYLE_KEY]);
  const [huntTheme, setHuntTheme] = useState('monuments');
  const [huntCountry, setHuntCountry] = useState('');
  const [huntLat, setHuntLat] = useState('');
  const [huntLng, setHuntLng] = useState('');
  const [huntStatus, setHuntStatus] = useState<{ status: ActionStatus; message: string }>({ status: 'idle', message: '' });
  // Dynamic hunt
  const [dynSubject, setDynSubject] = useState('');
  const [dynCountry, setDynCountry] = useState('');
  const [dynStatus, setDynStatus] = useState<{ status: ActionStatus; message: string }>({ status: 'idle', message: '' });

  // Postcard actions
  const [postcardId, setPostcardId] = useState('');
  const [postcardStatus, setPostcardStatus] = useState<{ status: ActionStatus; message: string }>({ status: 'idle', message: '' });

  // User actions
  const [userStatus, setUserStatus] = useState<{ status: ActionStatus; message: string }>({ status: 'idle', message: '' });

  // Pipeline state (3-step modular)
  interface PipelineTag { label: string; type: string; box_2d: number[]; }
  interface SegResult { label: string; mask_url: string; status: 'pending' | 'loading' | 'done' | 'error'; }
  interface DinoBox { label: string; box: number[]; bbox?: number[]; confidence: number; }

  const [pipelinePhotoUrl, setPipelinePhotoUrl] = useState<string | null>(null);
  const [detectedTags, setDetectedTags] = useState<PipelineTag[]>([]);
  const [detectStatus, setDetectStatus] = useState<{ status: ActionStatus; message: string }>({ status: 'idle', message: '' });
  const [dinoBoxes, setDinoBoxes] = useState<DinoBox[]>([]);
  const [dinoStatus, setDinoStatus] = useState<{ status: ActionStatus; message: string }>({ status: 'idle', message: '' });
  const [segments, setSegments] = useState<SegResult[]>([]);
  const [segmentStatus, setSegmentStatus] = useState<{ status: ActionStatus; message: string }>({ status: 'idle', message: '' });
  // Grounded SAM state
  const [gsamStatus, setGsamStatus] = useState<{ status: ActionStatus; message: string }>({ status: 'idle', message: '' });
  const [gsamResult, setGsamResult] = useState<{ annotated_url: string | null; mask_url: string | null; inverted_mask_url: string | null; outputs: string[] } | null>(null);

  const edgeBase = import.meta.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321';
  const edgeKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WO7o6oSc4wYjSnO28-VRLNxMEnOj9aQREp8o';

  const callEdgeFn = async (fn: string, body: Record<string, unknown>) => {
    const r = await fetch(`${edgeBase}/functions/v1/${fn}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${edgeKey}` },
      body: JSON.stringify(body),
    });
    const d = await r.json();
    if (!r.ok || d?.error) throw new Error(d?.error || `Failed (${r.status})`);
    return d;
  };

  const { entries: logEntries, isLoading: logLoading, lastFetched, refetch: refetchLog } = useGenerationLog(15_000);

  // ── Fetch stats ──
  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const userId = user?.id;
      const [colRes, totalRes, unenrichedRes, noTagsRes, albumsRes] = await Promise.all([
        userId
          ? supabase.from('postalpeek_postcards').select('id', { count: 'exact', head: true }).eq('owner_id', userId)
          : Promise.resolve({ count: 0 }),
        supabase.from('postalpeek_postcards').select('id', { count: 'exact', head: true }),
        supabase.from('postalpeek_postcards').select('id', { count: 'exact', head: true }).is('detailed_tags', null),
        supabase.from('postalpeek_postcards').select('id', { count: 'exact', head: true }).not('illustration_url', 'is', null).or('illustration_tags.is.null,illustration_tags.eq.[]'),
        supabase.from('postalpeek_albums').select('id, completed_at', { count: 'exact' }),
      ]);
      const albumsCompleted = (albumsRes.data as { id: string; completed_at: string | null }[] | null)?.filter(a => a.completed_at).length ?? 0;
      setStats({
        collectionCount: (colRes as { count: number | null }).count ?? 0,
        totalPostcards: (totalRes as { count: number | null }).count ?? 0,
        unenrichedCount: (unenrichedRes as { count: number | null }).count ?? 0,
        noIllustrationTagsCount: (noTagsRes as { count: number | null }).count ?? 0,
        albumsCount: (albumsRes as { count: number | null }).count ?? 0,
        albumsCompleted,
      });
    } catch (err) {
      console.error('Admin stats failed', err);
    } finally {
      setStatsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  // ── Helper: call edge function via fetch with force=true ──
  const callEdgeFunction = useCallback(async (fnName: string, params = '', body: Record<string, unknown> = {}) => {
    const base = import.meta.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321';
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WO7o6oSc4wYjSnO28-VRLNxMEnOj9aQREp8o';
    const res = await fetch(
      `${base}/functions/v1/${fnName}?force=true${params ? `&${params}` : ''}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` }, body: JSON.stringify(body) },
    );
    const data = await res.json();
    if (!res.ok || data?.error) throw new Error(data?.error || `${fnName} failed (${res.status})`);
    return data;
  }, []);

  // ── Generation ──

  const getRandomStyle = useCallback(() => {
    return illustrationStyleKeys[Math.floor(Math.random() * illustrationStyleKeys.length)];
  }, [illustrationStyleKeys]);

  const triggerWander = useCallback(async () => {
    setGenStatus({ status: 'loading', message: 'Generating wander postcard…' });
    try {
      const data = await callEdgeFunction('postalpeek-walker-wander', '', { illustration_style_key: getRandomStyle() });
      setGenStatus({ status: 'success', message: `✅ ${data?.data?.location || 'done'}` });
      onPostcardGenerated?.();
      setTimeout(refetchLog, 2000);
    } catch (err: unknown) {
      setGenStatus({ status: 'error', message: err instanceof Error ? err.message : String(err) });
    }
  }, [callEdgeFunction, getRandomStyle, onPostcardGenerated, refetchLog]);

  const triggerTrip = useCallback(async () => {
    setGenStatus({ status: 'loading', message: 'Generating trip postcard…' });
    try {
      const data = await callEdgeFunction('postalpeek-walker-trip', '', { illustration_style_key: getRandomStyle() });
      setGenStatus({ status: 'success', message: `✅ Trip: ${data?.postcards_created ?? 0} created` });
      onPostcardGenerated?.();
      setTimeout(refetchLog, 2000);
    } catch (err: unknown) {
      setGenStatus({ status: 'error', message: err instanceof Error ? err.message : String(err) });
    }
  }, [callEdgeFunction, getRandomStyle, onPostcardGenerated, refetchLog]);

  const triggerHunt = useCallback(async () => {
    setHuntStatus({ status: 'loading', message: `Hunting ${huntTheme}${huntCountry ? ` in ${huntCountry}` : ''}…` });
    try {
      // Build query params
      const params: string[] = [`theme=${huntTheme}`];
      const hasCoords = huntLat.trim() && huntLng.trim();
      if (hasCoords) {
        params.push(`lat=${huntLat.trim()}`, `lng=${huntLng.trim()}`);
      } else if (huntCountry.trim()) {
        params.push(`country=${encodeURIComponent(huntCountry.trim())}`);
      }
      const data = await callEdgeFunction('postalpeek-walker-hunt', params.join('&'), { illustration_style_key: getRandomStyle() });
      const attempts = data?.attempts ?? 1;
      const visible = data?.data?.theme_visible !== false;
      setHuntStatus({ status: 'success', message: `✅ ${data?.data?.location} · ${attempts} attempt${attempts > 1 ? 's' : ''}${visible ? '' : ' (theme not visible)'}` });
      onPostcardGenerated?.();
      setTimeout(refetchLog, 2000);
    } catch (err: unknown) {
      setHuntStatus({ status: 'error', message: err instanceof Error ? err.message : String(err) });
    }
  }, [huntTheme, huntCountry, huntLat, huntLng, getRandomStyle, callEdgeFunction, onPostcardGenerated, refetchLog]);

  const triggerDynamicHunt = useCallback(async () => {
    if (!dynSubject.trim()) return;
    setDynStatus({ status: 'loading', message: `🤖 Generating locations for "${dynSubject}"${dynCountry ? ` in ${dynCountry}` : ''}…` });
    try {
      const params: string[] = [`subject=${encodeURIComponent(dynSubject.trim())}`, 'theme=monuments'];
      if (dynCountry.trim()) params.push(`country=${encodeURIComponent(dynCountry.trim())}`);
      const data = await callEdgeFunction('postalpeek-walker-hunt', params.join('&'), { illustration_style_key: getRandomStyle() });
      const attempts = data?.attempts ?? 1;
      setDynStatus({ status: 'success', message: `✅ ${data?.data?.location} · ${attempts} attempt${attempts > 1 ? 's' : ''}` });
      onPostcardGenerated?.();
      setTimeout(refetchLog, 2000);
    } catch (err: unknown) {
      setDynStatus({ status: 'error', message: err instanceof Error ? err.message : String(err) });
    }
  }, [dynSubject, dynCountry, getRandomStyle, callEdgeFunction, onPostcardGenerated, refetchLog]);

  // ── Postcard Actions ──

  const regenerateIllustration = useCallback(async () => {
    if (!postcardId.trim()) return;
    setPostcardStatus({ status: 'loading', message: 'Regenerating illustration…' });
    try {
      const { data, error } = await supabase.functions.invoke('postalpeek-regenerate-illustration', { body: { postcard_id: postcardId.trim() } });
      if (error) throw error;
      setPostcardStatus({ status: 'success', message: data?.message || 'Illustration regenerated ✅' });
      onPostcardGenerated?.();
    } catch (err: unknown) {
      setPostcardStatus({ status: 'error', message: err instanceof Error ? err.message : String(err) });
    }
  }, [postcardId, onPostcardGenerated]);

  const deletePostcard = useCallback(async () => {
    if (!postcardId.trim()) return;
    if (!confirm(`Delete postcard ${postcardId}? This is permanent.`)) return;
    setPostcardStatus({ status: 'loading', message: 'Deleting…' });
    try {
      const { error } = await supabase.rpc('postalpeek_admin_delete_postcard', { p_postcard_id: postcardId.trim() });
      if (error) throw error;
      setPostcardStatus({ status: 'success', message: `Deleted ✅` });
      setPostcardId('');
      fetchStats();
      setTimeout(refetchLog, 500);
    } catch (err: unknown) {
      setPostcardStatus({ status: 'error', message: err instanceof Error ? err.message : String(err) });
    }
  }, [postcardId, fetchStats, refetchLog]);

  // ── Step 1: Detect objects ──
  const runDetection = useCallback(async () => {
    if (!postcardId.trim()) return;
    setDetectStatus({ status: 'loading', message: 'Fetching postcard…' });
    setDetectedTags([]);
    setSegments([]);
    try {
      const { data: pc, error } = await supabase
        .from('postalpeek_postcards')
        .select('original_image_url, illustration_url')
        .eq('id', postcardId.trim())
        .single();
      if (error || !pc?.illustration_url) throw new Error('Postcard not found or no illustration');
      setPipelinePhotoUrl(pc.illustration_url);

      setDetectStatus({ status: 'loading', message: 'Calling Gemini on illustration…' });
      const data = await callEdgeFn('postalpeek-detect-objects', { image_url: pc.illustration_url });
      const tags: PipelineTag[] = data.tags || [];
      setDetectedTags(tags);
      setSegments(tags.map((t: PipelineTag) => ({ label: t.label, mask_url: '', status: 'pending' as const })));
      setDetectStatus({ status: 'success', message: `✅ ${tags.length} objects found (${data.raw_count} raw)` });
    } catch (err: unknown) {
      setDetectStatus({ status: 'error', message: err instanceof Error ? err.message : String(err) });
    }
  }, [postcardId]);

  // ── Step 1.5: Refine with Grounding DINO ──
  const runDino = useCallback(async () => {
    if (!pipelinePhotoUrl || detectedTags.length === 0) return;
    setDinoStatus({ status: 'loading', message: 'Calling Grounding DINO…' });
    setDinoBoxes([]);
    try {
      const labels = detectedTags.map(t => t.label);
      const data = await callEdgeFn('postalpeek-detect-boxes', { image_url: pipelinePhotoUrl, labels });
      const boxes: DinoBox[] = data.detections || [];
      setDinoBoxes(boxes);
      // Update segments to match DINO detections
      setSegments(boxes.map((b: DinoBox) => ({ label: b.label, mask_url: '', status: 'pending' as const })));
      setDinoStatus({ status: 'success', message: `✅ ${boxes.length} precise boxes` });
    } catch (err: unknown) {
      setDinoStatus({ status: 'error', message: err instanceof Error ? err.message : String(err) });
    }
  }, [pipelinePhotoUrl, detectedTags]);

  // ── Step 2: Segment one object (uses DINO boxes if available, else Gemini) ──
  const runSegmentOne = useCallback(async (idx: number) => {
    // Use DINO boxes if available, otherwise fall back to Gemini tags
    const boxes = dinoBoxes.length > 0 ? dinoBoxes : null;
    const source = boxes ? boxes[idx] : detectedTags[idx];
    if (!pipelinePhotoUrl || !source) return;

    let clickX: number, clickY: number;
    if (boxes && idx < boxes.length) {
      // DINO box format: [x_min, y_min, x_max, y_max] normalized 0-1
      const b = boxes[idx];
      const coords = b.box || b.bbox || [0, 0, 0, 0];
      const [xMin, yMin, xMax, yMax] = coords;
      clickX = Math.round(((xMin + xMax) / 2) * 512);
      clickY = Math.round(((yMin + yMax) / 2) * 384);
    } else {
      // Gemini box_2d: [y_min, x_min, y_max, x_max] normalized 0-1000
      const [yMin, xMin, yMax, xMax] = (source as PipelineTag).box_2d;
      clickX = Math.round(((xMin + xMax) / 2 / 1000) * 512);
      clickY = Math.round(((yMin + yMax) / 2 / 1000) * 384);
    }

    setSegments(prev => prev.map((s, i) => i === idx ? { ...s, status: 'loading' } : s));

    let cfUrl = pipelinePhotoUrl;
    try {
      const u = new URL(pipelinePhotoUrl);
      cfUrl = `${u.origin}/cdn-cgi/image/format=jpeg,width=512,quality=80/${u.pathname.replace(/^\//, '')}`;
    } catch { /* use original */ }

    try {
      const data = await callEdgeFn('postalpeek-segment', {
        image_url: cfUrl, click_x: clickX, click_y: clickY, label: source.label,
      });
      setSegments(prev => prev.map((s, i) => i === idx ? { ...s, mask_url: data.mask_url, status: 'done' } : s));
    } catch {
      setSegments(prev => prev.map((s, i) => i === idx ? { ...s, status: 'error' } : s));
    }
  }, [pipelinePhotoUrl, detectedTags, dinoBoxes]);

  // ── Step 2: Segment ALL ──
  const runSegmentAll = useCallback(async () => {
    setSegmentStatus({ status: 'loading', message: 'Starting…' });
    for (let i = 0; i < detectedTags.length; i++) {
      setSegmentStatus({ status: 'loading', message: `Segmenting ${i + 1}/${detectedTags.length} (${detectedTags[i].label})…` });
      await runSegmentOne(i);
      if (i < detectedTags.length - 1) await new Promise(r => setTimeout(r, 2000));
    }
    setSegmentStatus({ status: 'success', message: `✅ Done` });
  }, [detectedTags, runSegmentOne]);

  // ── Grounded SAM (one-shot detect + segment) ──
  const runGroundedSam = useCallback(async () => {
    if (!pipelinePhotoUrl || detectedTags.length === 0) return;
    setGsamStatus({ status: 'loading', message: 'Calling Grounded SAM (~16s)…' });
    setGsamResult(null);
    try {
      // Use type-based generic labels for DINO (better detection than specific labels)
      const uniqueTypes = [...new Set(detectedTags.map(t => t.type))];
      // Map types to natural language for better DINO matching
      const typeLabels: Record<string, string> = {
        sign: 'sign', person: 'person', vehicle: 'car', architecture: 'building',
        landmark: 'landmark', animal: 'animal', plant: 'plant', street_furniture: 'bench',
        object: 'object',
      };
      const labels = uniqueTypes.map(t => typeLabels[t] || t).join(', ');
      const data = await callEdgeFn('postalpeek-grounded-sam', {
        image_url: pipelinePhotoUrl,
        labels,
      });
      setGsamResult(data);
      setGsamStatus({ status: 'success', message: `✅ Done — ${data.outputs?.length || 0} output images` });
    } catch (err: unknown) {
      setGsamStatus({ status: 'error', message: err instanceof Error ? err.message : String(err) });
    }
  }, [pipelinePhotoUrl, detectedTags]);

  // ── User Actions ──

  const resetDailyPack = useCallback(async () => {
    if (!user?.id) return;
    setUserStatus({ status: 'loading', message: 'Resetting daily pack…' });
    try {
      const { error } = await supabase.rpc('postalpeek_admin_reset_daily_pack', { p_user_id: user.id });
      if (error) throw error;
      setUserStatus({ status: 'success', message: 'Daily pack reset ✅' });
    } catch (err: unknown) {
      setUserStatus({ status: 'error', message: err instanceof Error ? err.message : String(err) });
    }
  }, [user?.id]);

  const resetClaimLimits = useCallback(async () => {
    if (!user?.id) return;
    setUserStatus({ status: 'loading', message: 'Resetting claim limits…' });
    try {
      const { error } = await supabase.rpc('postalpeek_admin_reset_claims', { p_user_id: user.id });
      if (error) throw error;
      setUserStatus({ status: 'success', message: 'Claim limits reset ✅' });
    } catch (err: unknown) {
      setUserStatus({ status: 'error', message: err instanceof Error ? err.message : String(err) });
    }
  }, [user?.id]);

  // ── Sidebar links ──

  const NAV = [
    { key: 'dashboard'  as NavSection, icon: <BarChart2  className="w-4 h-4" />, label: 'Dashboard'    },
    { key: 'generation' as NavSection, icon: <Zap         className="w-4 h-4" />, label: 'Generation'   },
    { key: 'postcards'  as NavSection, icon: <Image       className="w-4 h-4" />, label: 'Postcards'    },
    { key: 'settings'   as NavSection, icon: <Settings    className="w-4 h-4" />, label: 'User Actions' },
  ];

  return (
    <div className="min-h-screen w-full flex" style={{ background: '#0a0a12', color: 'white', fontFamily: 'Inter, sans-serif' }}>

      {/* ── LEFT SIDEBAR ──────────────────────────────────── */}
      <aside
        className="w-64 shrink-0 flex flex-col border-r"
        style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}
      >
        {/* Logo */}
        <div className="px-5 pt-6 pb-4">
          <div className="flex items-center gap-2.5 mb-1">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-semibold tracking-wide text-white">Admin Console</span>
          </div>
          <p className="text-white/30 text-[11px] font-mono truncate">{user?.email || '—'}</p>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 space-y-0.5">
          {NAV.map((item) => (
            <button
              key={item.key}
              onClick={() => setActiveSection(item.key)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left"
              style={{
                background: activeSection === item.key ? 'rgba(99,102,241,0.2)' : 'transparent',
                color: activeSection === item.key ? 'rgb(165,180,252)' : 'rgba(255,255,255,0.5)',
              }}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>

        {/* Back to feed */}
        <div className="p-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <button
            onClick={() => navigate('/feed?debug')}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-white/40 hover:text-white/70 hover:bg-white/5 transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to feed
          </button>
        </div>
      </aside>

      {/* ── MAIN CONTENT ──────────────────────────────────── */}
      <main className="flex-1 flex min-h-0 overflow-hidden">

        {/* Content section */}
        <div className="flex-1 overflow-y-auto p-8">

          {/* ── Dashboard ── */}
          {activeSection === 'dashboard' && (
            <div className="max-w-2xl">
              <h2 className="text-xl font-semibold mb-6">Overview</h2>

              {statsLoading ? (
                <div className="flex items-center gap-2 text-white/40 text-sm">
                  <Loader className="w-4 h-4 animate-spin" /> Loading…
                </div>
              ) : stats ? (
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Total Postcards',     value: stats.totalPostcards,          icon: '🃏' },
                    { label: 'Your Collection',     value: stats.collectionCount,          icon: '📦' },
                    { label: 'Albums',              value: `${stats.albumsCompleted}/${stats.albumsCount} completed`, icon: '📚' },
                    { label: 'Unenriched',          value: stats.unenrichedCount === 0 ? '✅ All enriched' : `${stats.unenrichedCount} pending`, icon: '🤖' },
                    { label: 'Missing Illus. Tags', value: stats.noIllustrationTagsCount,  icon: '🏷️' },
                  ].map((stat) => (
                    <div key={stat.label} className="rounded-xl p-4 border" style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.06)' }}>
                      <p className="text-white/40 text-xs mb-1">{stat.icon} {stat.label}</p>
                      <p className="text-white text-lg font-mono font-semibold">{stat.value}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-white/30 text-sm">No stats</p>
              )}

              <button onClick={() => { fetchStats(); refetchLog(); }}
                className="mt-4 flex items-center gap-2 text-white/30 text-xs hover:text-white/60 transition-colors">
                <RefreshCw className="w-3 h-3" /> Refresh
              </button>
            </div>
          )}

          {/* ── Generation ── */}
          {activeSection === 'generation' && (
            <div className="max-w-lg space-y-8">
              <h2 className="text-xl font-semibold">Generation</h2>

              {/* Illustration style selector — applies to ALL pipelines below */}
              <div className="rounded-xl p-4 border" style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(99,102,241,0.2)' }}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-white/60 text-[10px] uppercase tracking-widest font-semibold">🎨 Illustration Style</span>
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded font-mono"
                      style={{ background: 'rgba(99,102,241,0.2)', color: 'rgb(165,180,252)' }}
                    >
                      {illustrationStyleKeys.length > 1 ? 'multi-override' : (illustrationStyleKeys[0] === ACTIVE_STYLE_KEY ? 'default' : 'override')}
                    </span>
                  </div>
                </div>
                
                <div className="space-y-1.5 max-h-[140px] overflow-y-auto px-1 -mx-1 custom-scrollbar">
                  {Object.entries(ILLUSTRATION_STYLES).map(([key, style]) => {
                    const isSelected = illustrationStyleKeys.includes(key);
                    return (
                      <label 
                        key={key} 
                        className="flex items-start gap-2.5 p-2 rounded-lg cursor-pointer transition-all border"
                        style={{ 
                          background: isSelected ? 'rgba(99,102,241,0.1)' : 'rgba(255,255,255,0.02)',
                          borderColor: isSelected ? 'rgba(99,102,241,0.3)' : 'transparent',
                        }}
                      >
                        <input 
                          type="checkbox"
                          className="mt-1 flex-shrink-0 cursor-pointer"
                          style={{ accentColor: 'rgba(99,102,241,1)' }}
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setIllustrationStyleKeys(prev => [...prev, key]);
                            } else if (illustrationStyleKeys.length > 1) {
                              setIllustrationStyleKeys(prev => prev.filter(k => k !== key));
                            }
                          }}
                        />
                        <div className="flex flex-col">
                          <span style={{ color: isSelected ? 'white' : 'rgba(255,255,255,0.7)' }} className="text-sm font-medium">
                            {key === ACTIVE_STYLE_KEY ? `⭐ ` : ''}{style.label}
                          </span>
                          <span className="text-[10px] text-white/30 leading-tight mt-0.5">
                            {style.description}
                          </span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Standard pipelines */}
              <div>
                <SectionTitle>Standard Pipelines</SectionTitle>
                <div className="space-y-2">
                  <ActionBtn onClick={triggerWander} disabled={genStatus.status === 'loading'}>
                    <span>🌍</span><span>Wander — Random global postcard</span>
                  </ActionBtn>
                  <ActionBtn onClick={triggerTrip} disabled={genStatus.status === 'loading'} variant="success">
                    <span>✈️</span><span>Trip — Next album stop</span>
                  </ActionBtn>
                </div>
                <StatusMsg status={genStatus.status} message={genStatus.message} />
              </div>

              {/* Hunt mode */}
              <div>
                <SectionTitle>🎯 Hunt Mode — Themed</SectionTitle>
                <div className="space-y-2">
                  <select
                    value={huntTheme}
                    onChange={(e) => setHuntTheme(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl text-sm transition-all"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', outline: 'none' }}
                  >
                    {HUNT_THEME_OPTIONS.map((opt) => (
                      <option key={opt.slug} value={opt.slug} style={{ background: '#1a1a2e', color: 'white' }}>
                        {opt.label}
                      </option>
                    ))}
                  </select>

                  {/* Country filter */}
                  <div className="relative">
                    <input
                      type="text"
                      value={huntCountry}
                      onChange={(e) => setHuntCountry(e.target.value)}
                      placeholder="Country filter (e.g. Italy, France)   — optional"
                      className="w-full px-3 py-2.5 rounded-xl text-sm"
                      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'white', outline: 'none' }}
                    />
                  </div>

                  {/* OR exact coordinates */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={huntLat}
                      onChange={(e) => setHuntLat(e.target.value)}
                      placeholder="Lat (e.g. 48.8584)"
                      className="flex-1 px-3 py-2.5 rounded-xl text-sm font-mono"
                      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'white', outline: 'none' }}
                    />
                    <input
                      type="text"
                      value={huntLng}
                      onChange={(e) => setHuntLng(e.target.value)}
                      placeholder="Lng (e.g. 2.2945)"
                      className="flex-1 px-3 py-2.5 rounded-xl text-sm font-mono"
                      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'white', outline: 'none' }}
                    />
                  </div>
                  <p className="text-white/20 text-[10px] leading-relaxed">
                    Country filters the curated list · Lat/Lng overrides with exact coordinates
                  </p>

                  <ActionBtn onClick={triggerHunt} disabled={huntStatus.status === 'loading'} variant="amber">
                    <span>🎯</span>
                    <span>Hunt {HUNT_THEME_OPTIONS.find(o => o.slug === huntTheme)?.label.split(' ').slice(1).join(' ')}{huntCountry ? ` in ${huntCountry}` : ''}{huntLat && huntLng ? ` @ ${huntLat},${huntLng}` : ''}</span>
                  </ActionBtn>
                </div>
                <StatusMsg status={huntStatus.status} message={huntStatus.message} />
              </div>

              {/* Dynamic Hunt */}
              <div>
                <SectionTitle>🤖 Dynamic Hunt — Powered by Gemini</SectionTitle>
                <div className="space-y-2">
                  <input
                    type="text"
                    value={dynSubject}
                    onChange={(e) => setDynSubject(e.target.value)}
                    placeholder="Subject: estadios de fútbol, plazas, mercados de flores…"
                    className="w-full px-3 py-2.5 rounded-xl text-sm"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'white', outline: 'none' }}
                  />
                  <input
                    type="text"
                    value={dynCountry}
                    onChange={(e) => setDynCountry(e.target.value)}
                    placeholder="Country: Argentina, Japón, Brasil… (opcional)"
                    className="w-full px-3 py-2.5 rounded-xl text-sm"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'white', outline: 'none' }}
                  />
                  <p className="text-white/20 text-[10px] leading-relaxed">
                    Gemini genera la lista de coords · cualquier tema + país funciona
                  </p>
                  <ActionBtn
                    onClick={triggerDynamicHunt}
                    disabled={!dynSubject.trim() || dynStatus.status === 'loading'}
                    variant="amber"
                  >
                    <span>🤖</span>
                    <span>
                      {dynSubject.trim()
                        ? `Hunt: ${dynSubject}${dynCountry ? ` en ${dynCountry}` : ''}`
                        : 'Escribí un subject para empezar'}
                    </span>
                  </ActionBtn>
                </div>
                <StatusMsg status={dynStatus.status} message={dynStatus.message} />
              </div>

              {/* Enrichment */}
              <div>
                <SectionTitle>Enrichment</SectionTitle>
                <div className="rounded-xl p-4 border" style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.06)' }}>
                  <p className="text-white/50 text-xs mb-2">Run from the terminal:</p>
                  <code className="text-xs font-mono text-indigo-300 break-all">
                    yarn workspace postalpeek enrich:collection
                  </code>
                  {stats && stats.unenrichedCount > 0 && (
                    <p className="text-amber-400 text-xs mt-2">⚠️ {stats.unenrichedCount} postcards need enrichment</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Postcards ── */}
          {activeSection === 'postcards' && (
            <div className="max-w-lg space-y-6">
              <h2 className="text-xl font-semibold">Postcard Actions</h2>
              <div>
                <label className="text-white/50 text-xs block mb-1.5">Postcard ID (UUID)</label>
                <input
                  type="text"
                  value={postcardId}
                  onChange={(e) => setPostcardId(e.target.value)}
                  placeholder="3f2504e0-4f89-11d3-9a0c-0305e82c3301"
                  className="w-full px-3 py-2.5 rounded-xl text-sm font-mono"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', outline: 'none' }}
                />
              </div>
              <div className="space-y-2">
                <ActionBtn onClick={regenerateIllustration} disabled={!postcardId.trim() || postcardStatus.status === 'loading'}>
                  <span>🎨</span><span>Regenerate Illustration</span>
                </ActionBtn>
                <ActionBtn onClick={deletePostcard} disabled={!postcardId.trim() || postcardStatus.status === 'loading'} variant="danger">
                  <span>🗑️</span><span>Delete Postcard</span>
                </ActionBtn>
              </div>
              <StatusMsg status={postcardStatus.status} message={postcardStatus.message} />

              {/* ── Sticker Pipeline (3-Step Modular) ── */}
              <div className="pt-2">
                <SectionTitle>🧩 Sticker Pipeline (Step-by-Step)</SectionTitle>

                {/* ── STEP 1: Detect Objects ── */}
                <div className="rounded-xl p-4 mb-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-white/60 text-xs font-semibold uppercase tracking-wider">Step 1 — Detect Objects (Gemini)</p>
                    <ActionBtn
                      onClick={runDetection}
                      disabled={!postcardId.trim() || detectStatus.status === 'loading'}
                    >
                      {detectStatus.status === 'loading' ? <Loader className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                      <span>Run</span>
                    </ActionBtn>
                  </div>
                  <StatusMsg status={detectStatus.status} message={detectStatus.message} />

                  {/* Photo with bounding boxes */}
                  {pipelinePhotoUrl && detectedTags.length > 0 && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3">
                      <div className="relative rounded-lg overflow-hidden border" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
                        <img src={pipelinePhotoUrl} alt="Photo" className="w-full block" />
                        {detectedTags.map((tag, i) => {
                          const top = `${tag.box_2d[0] / 10}%`;
                          const left = `${tag.box_2d[1] / 10}%`;
                          const height = `${(tag.box_2d[2] - tag.box_2d[0]) / 10}%`;
                          const width = `${(tag.box_2d[3] - tag.box_2d[1]) / 10}%`;
                          return (
                            <div key={i} style={{ position: 'absolute', top, left, width, height, border: '2px solid #f43f5e', pointerEvents: 'none' }}>
                              <div style={{ position: 'absolute', top: '50%', left: '50%', width: 6, height: 6, background: '#f43f5e', borderRadius: '50%', transform: 'translate(-50%,-50%)' }} />
                              <span className="absolute -top-4 left-0 text-[8px] bg-rose-500/90 text-white px-1 rounded-sm whitespace-nowrap">
                                {tag.label} ({tag.type})
                              </span>
                            </div>
                          );
                        })}
                      </div>
                      <p className="text-white/30 text-[10px] mt-1">{detectedTags.length} objects detected</p>
                    </motion.div>
                  )}
                </div>

                {/* ── STEP 1.5: Refine with Grounding DINO ── */}
                {detectedTags.length > 0 && (
                  <div className="rounded-xl p-4 mb-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(34,197,94,0.15)' }}>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-white/60 text-xs font-semibold uppercase tracking-wider">Step 1.5 — Refine Boxes (Grounding DINO)</p>
                      <ActionBtn onClick={runDino} disabled={dinoStatus.status === 'loading'}>
                        {dinoStatus.status === 'loading' ? <Loader className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                        <span>Run DINO</span>
                      </ActionBtn>
                    </div>
                    <StatusMsg status={dinoStatus.status} message={dinoStatus.message} />

                    {/* Photo with DINO boxes (green) vs Gemini boxes (red, faded) */}
                    {pipelinePhotoUrl && dinoBoxes.length > 0 && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3">
                        <div className="relative rounded-lg overflow-hidden border" style={{ borderColor: 'rgba(34,197,94,0.2)' }}>
                          <img src={pipelinePhotoUrl} alt="Photo" className="w-full block" />
                          {/* Gemini boxes (faded red) */}
                          {detectedTags.map((tag, i) => {
                            const top = `${tag.box_2d[0] / 10}%`;
                            const left = `${tag.box_2d[1] / 10}%`;
                            const height = `${(tag.box_2d[2] - tag.box_2d[0]) / 10}%`;
                            const width = `${(tag.box_2d[3] - tag.box_2d[1]) / 10}%`;
                            return (
                              <div key={`g-${i}`} style={{ position: 'absolute', top, left, width, height, border: '1px dashed rgba(244,63,94,0.3)', pointerEvents: 'none' }} />
                            );
                          })}
                          {/* DINO boxes (solid green) */}
                          {dinoBoxes.map((det, i) => {
                            const b = det.box || det.bbox;
                            if (!b || b.length < 4) return null;
                            const left = `${b[0] * 100}%`;
                            const top = `${b[1] * 100}%`;
                            const width = `${(b[2] - b[0]) * 100}%`;
                            const height = `${(b[3] - b[1]) * 100}%`;
                            return (
                              <div key={`d-${i}`} style={{ position: 'absolute', top, left, width, height, border: '2px solid #22c55e', pointerEvents: 'none' }}>
                                <div style={{ position: 'absolute', top: '50%', left: '50%', width: 6, height: 6, background: '#22c55e', borderRadius: '50%', transform: 'translate(-50%,-50%)' }} />
                                <span className="absolute -top-4 left-0 text-[8px] bg-emerald-500/90 text-white px-1 rounded-sm whitespace-nowrap">
                                  {det.label} ({(det.confidence * 100).toFixed(0)}%)
                                </span>
                              </div>
                            );
                          })}
                        </div>
                        <div className="flex gap-3 mt-1">
                          <span className="text-[9px] text-rose-400/50">■ Gemini (approximate)</span>
                          <span className="text-[9px] text-emerald-400">■ DINO (precise)</span>
                        </div>
                      </motion.div>
                    )}
                  </div>
                )}

                {/* ── STEP 2: Segment Objects (SAM 2) ── */}
                {(dinoBoxes.length > 0 || detectedTags.length > 0) && (
                  <div className="rounded-xl p-4 mb-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-white/60 text-xs font-semibold uppercase tracking-wider">Step 2 — Segment Objects (SAM 2)</p>
                      <ActionBtn onClick={runSegmentAll} disabled={segmentStatus.status === 'loading'}>
                        {segmentStatus.status === 'loading' ? <Loader className="w-3 h-3 animate-spin" /> : <Scissors className="w-3 h-3" />}
                        <span>Run All</span>
                      </ActionBtn>
                    </div>
                    <StatusMsg status={segmentStatus.status} message={segmentStatus.message} />

                    {/* Per-object segment cards */}
                    <div className="grid grid-cols-2 gap-2 mt-3">
                      {segments.map((seg, i) => (
                        <div
                          key={seg.label}
                          className="rounded-lg p-2 border"
                          style={{
                            background: seg.status === 'done' ? 'rgba(16,185,129,0.05)' : seg.status === 'error' ? 'rgba(239,68,68,0.05)' : 'rgba(255,255,255,0.02)',
                            borderColor: seg.status === 'done' ? 'rgba(16,185,129,0.2)' : seg.status === 'error' ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.06)',
                          }}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-white/70 text-[10px] font-medium truncate">{seg.label}</span>
                            {seg.status === 'pending' && (
                              <button onClick={() => runSegmentOne(i)} className="text-[9px] text-indigo-400 hover:text-indigo-300">▶ Run</button>
                            )}
                            {seg.status === 'loading' && <Loader className="w-3 h-3 animate-spin text-amber-400" />}
                            {seg.status === 'done' && <CheckCircle className="w-3 h-3 text-emerald-400" />}
                            {seg.status === 'error' && (
                              <button onClick={() => runSegmentOne(i)} className="text-[9px] text-red-400 hover:text-red-300">↻ Retry</button>
                            )}
                          </div>
                          {seg.mask_url && (
                            <a href={seg.mask_url} target="_blank" rel="noopener noreferrer">
                              <img src={seg.mask_url} alt={`Mask ${seg.label}`} className="w-full rounded bg-black" />
                            </a>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Combined masks overlay */}
                    {segments.some(s => s.mask_url) && pipelinePhotoUrl && (
                      <div className="mt-4">
                        <p className="text-white/40 text-[10px] uppercase tracking-wider mb-2">🎭 Combined Masks (Debug)</p>
                        <div className="relative w-full rounded-lg overflow-hidden bg-black" style={{ aspectRatio: '4/3' }}>
                          <img src={pipelinePhotoUrl} className="absolute inset-0 w-full h-full object-cover opacity-30" />
                          {segments.map((s, i) => s.mask_url ? (
                            <img key={i} src={s.mask_url} alt={`Mask ${s.label}`} className="absolute inset-0 w-full h-full object-cover mix-blend-screen opacity-80" />
                          ) : null)}
                          {detectedTags.map((tag, i) => {
                            const top = `${tag.box_2d[0] / 10}%`;
                            const left = `${tag.box_2d[1] / 10}%`;
                            const height = `${(tag.box_2d[2] - tag.box_2d[0]) / 10}%`;
                            const width = `${(tag.box_2d[3] - tag.box_2d[1]) / 10}%`;
                            return (
                              <div key={`b-${i}`} style={{ position: 'absolute', top, left, width, height, border: '1px dashed red', pointerEvents: 'none' }}>
                                <div style={{ position: 'absolute', top: '50%', left: '50%', width: 6, height: 6, background: 'red', borderRadius: '50%', transform: 'translate(-50%,-50%)' }} />
                                <span className="absolute -top-4 left-0 text-[8px] bg-red-500/80 text-white px-1 whitespace-nowrap rounded-sm">{tag.label}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ── STEP 3: Grounded SAM (One-Shot) ── */}
                {detectedTags.length > 0 && (
                  <div className="rounded-xl p-4 mb-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(139,92,246,0.2)' }}>
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="text-white/60 text-xs font-semibold uppercase tracking-wider">Step 2 — Grounded SAM (DINO + SAM)</p>
                        <p className="text-white/30 text-[9px]">One-shot detect + segment on illustration • $0.015/run</p>
                      </div>
                      <ActionBtn onClick={runGroundedSam} disabled={gsamStatus.status === 'loading'}>
                        {gsamStatus.status === 'loading' ? <Loader className="w-3 h-3 animate-spin" /> : <Scissors className="w-3 h-3" />}
                        <span>Run</span>
                      </ActionBtn>
                    </div>
                    <StatusMsg status={gsamStatus.status} message={gsamStatus.message} />

                    {gsamResult && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3 space-y-3">
                        {/* Annotated image (illustration with mask overlay) */}
                        {gsamResult.annotated_url && (
                          <div>
                            <p className="text-white/40 text-[10px] uppercase tracking-wider mb-1">🎯 Detected + Segmented</p>
                            <a href={gsamResult.annotated_url} target="_blank" rel="noopener noreferrer">
                              <img src={gsamResult.annotated_url} alt="Annotated" className="w-full rounded-lg border" style={{ borderColor: 'rgba(139,92,246,0.2)' }} />
                            </a>
                          </div>
                        )}
                        {/* Mask + Inverted mask side by side */}
                        <div className="grid grid-cols-2 gap-2">
                          {gsamResult.mask_url && (
                            <div>
                              <p className="text-white/40 text-[10px] uppercase tracking-wider mb-1">🎭 Mask</p>
                              <a href={gsamResult.mask_url} target="_blank" rel="noopener noreferrer">
                                <img src={gsamResult.mask_url} alt="Mask" className="w-full rounded bg-black" />
                              </a>
                            </div>
                          )}
                          {gsamResult.inverted_mask_url && (
                            <div>
                              <p className="text-white/40 text-[10px] uppercase tracking-wider mb-1">⬛ Inverted</p>
                              <a href={gsamResult.inverted_mask_url} target="_blank" rel="noopener noreferrer">
                                <img src={gsamResult.inverted_mask_url} alt="Inverted Mask" className="w-full rounded bg-black" />
                              </a>
                            </div>
                          )}
                        </div>
                        {/* All outputs */}
                        {gsamResult.outputs.length > 2 && (
                          <details className="text-white/30 text-[9px]">
                            <summary className="cursor-pointer hover:text-white/50">All {gsamResult.outputs.length} output images</summary>
                            <div className="grid grid-cols-2 gap-1 mt-1">
                              {gsamResult.outputs.map((url: string, i: number) => (
                                <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                                  <img src={url} alt={`Output ${i}`} className="w-full rounded" />
                                </a>
                              ))}
                            </div>
                          </details>
                        )}
                      </motion.div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}


          {/* ── User Actions ── */}
          {activeSection === 'settings' && (
            <div className="max-w-lg space-y-6">
              <h2 className="text-xl font-semibold">User Actions</h2>
              {!user ? (
                <p className="text-white/40 text-sm">No user logged in.</p>
              ) : (
                <>
                  <p className="text-white/40 text-sm">Acting on <strong className="text-white/70">{user.email}</strong></p>
                  <div className="space-y-2">
                    <ActionBtn onClick={resetDailyPack} disabled={userStatus.status === 'loading'} variant="amber">
                      <span>📦</span><span>Reset Today's Daily Pack</span>
                    </ActionBtn>
                    <ActionBtn onClick={resetClaimLimits} disabled={userStatus.status === 'loading'} variant="danger">
                      <span>🔄</span><span>Reset Claim Limits</span>
                    </ActionBtn>
                  </div>
                  <StatusMsg status={userStatus.status} message={userStatus.message} />
                </>
              )}
            </div>
          )}
        </div>

        {/* ── GENERATION LOG PANEL ────────────────────────── */}
        <aside
          className="w-80 shrink-0 border-l flex flex-col overflow-hidden"
          style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.01)' }}
        >
          {/* Header */}
          <div className="px-4 py-4 border-b flex items-center justify-between" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
            <div>
              <p className="text-white/80 text-sm font-semibold">Generation Log</p>
              {lastFetched && (
                <p className="text-white/25 text-[10px] font-mono mt-0.5">
                  updated {timeAgo(lastFetched.toISOString())}
                </p>
              )}
            </div>
            <button
              onClick={refetchLog}
              className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
              title="Refresh log"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-white/40 ${logLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Log entries */}
          <div className="flex-1 overflow-y-auto px-2 py-2">
            {logLoading && logEntries.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-white/30 text-sm">
                <Loader className="w-4 h-4 animate-spin mr-2" /> Loading…
              </div>
            ) : logEntries.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-center">
                <MapPin className="w-8 h-8 text-white/10 mb-2" />
                <p className="text-white/30 text-xs">No postcards yet</p>
              </div>
            ) : (
              <AnimatePresence initial={false}>
                {logEntries.map((entry) => (
                  <LogCard key={entry.id} entry={entry} />
                ))}
              </AnimatePresence>
            )}
          </div>

          {/* Footer stats */}
          <div className="px-4 py-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
            <p className="text-white/25 text-[10px] font-mono">
              {logEntries.length} shown · auto-refresh 15s
            </p>
          </div>
        </aside>
      </main>
    </div>
  );
}

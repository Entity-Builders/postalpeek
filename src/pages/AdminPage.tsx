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

        <div className="flex items-center gap-1 mt-1.5">
          <Clock className="w-3 h-3 text-white/20" />
          <span className="text-white/30 text-[10px] font-mono">{timeAgo(entry.created_at)}</span>
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
  const [illustrationStyleKey, setIllustrationStyleKey] = useState<string>(ACTIVE_STYLE_KEY);
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

  const triggerWander = useCallback(async () => {
    setGenStatus({ status: 'loading', message: 'Generating wander postcard…' });
    try {
      const data = await callEdgeFunction('postalpeek-walker-wander', '', { illustration_style_key: illustrationStyleKey });
      setGenStatus({ status: 'success', message: `✅ ${data?.data?.location || 'done'}` });
      onPostcardGenerated?.();
      setTimeout(refetchLog, 2000);
    } catch (err: unknown) {
      setGenStatus({ status: 'error', message: err instanceof Error ? err.message : String(err) });
    }
  }, [callEdgeFunction, illustrationStyleKey, onPostcardGenerated, refetchLog]);

  const triggerTrip = useCallback(async () => {
    setGenStatus({ status: 'loading', message: 'Generating trip postcard…' });
    try {
      const data = await callEdgeFunction('postalpeek-walker-trip');
      setGenStatus({ status: 'success', message: `✅ Trip: ${data?.postcards_created ?? 0} created` });
      onPostcardGenerated?.();
      setTimeout(refetchLog, 2000);
    } catch (err: unknown) {
      setGenStatus({ status: 'error', message: err instanceof Error ? err.message : String(err) });
    }
  }, [callEdgeFunction, onPostcardGenerated, refetchLog]);

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
      const data = await callEdgeFunction('postalpeek-walker-hunt', params.join('&'), { illustration_style_key: illustrationStyleKey });
      const attempts = data?.attempts ?? 1;
      const visible = data?.data?.theme_visible !== false;
      setHuntStatus({ status: 'success', message: `✅ ${data?.data?.location} · ${attempts} attempt${attempts > 1 ? 's' : ''}${visible ? '' : ' (theme not visible)'}` });
      onPostcardGenerated?.();
      setTimeout(refetchLog, 2000);
    } catch (err: unknown) {
      setHuntStatus({ status: 'error', message: err instanceof Error ? err.message : String(err) });
    }
  }, [huntTheme, huntCountry, huntLat, huntLng, illustrationStyleKey, callEdgeFunction, onPostcardGenerated, refetchLog]);

  const triggerDynamicHunt = useCallback(async () => {
    if (!dynSubject.trim()) return;
    setDynStatus({ status: 'loading', message: `🤖 Generating locations for "${dynSubject}"${dynCountry ? ` in ${dynCountry}` : ''}…` });
    try {
      const params: string[] = [`subject=${encodeURIComponent(dynSubject.trim())}`, 'theme=monuments'];
      if (dynCountry.trim()) params.push(`country=${encodeURIComponent(dynCountry.trim())}`);
      const data = await callEdgeFunction('postalpeek-walker-hunt', params.join('&'), { illustration_style_key: illustrationStyleKey });
      const attempts = data?.attempts ?? 1;
      setDynStatus({ status: 'success', message: `✅ ${data?.data?.location} · ${attempts} attempt${attempts > 1 ? 's' : ''}` });
      onPostcardGenerated?.();
      setTimeout(refetchLog, 2000);
    } catch (err: unknown) {
      setDynStatus({ status: 'error', message: err instanceof Error ? err.message : String(err) });
    }
  }, [dynSubject, dynCountry, illustrationStyleKey, callEdgeFunction, onPostcardGenerated, refetchLog]);

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
            onClick={() => navigate('/')}
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
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-white/60 text-[10px] uppercase tracking-widest font-semibold">🎨 Illustration Style</span>
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded font-mono"
                    style={{ background: 'rgba(99,102,241,0.2)', color: 'rgb(165,180,252)' }}
                  >
                    {illustrationStyleKey === ACTIVE_STYLE_KEY ? 'default' : 'override'}
                  </span>
                </div>
                <select
                  value={illustrationStyleKey}
                  onChange={(e) => setIllustrationStyleKey(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl text-sm transition-all"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'white', outline: 'none' }}
                >
                  {Object.entries(ILLUSTRATION_STYLES).map(([key, style]) => (
                    <option key={key} value={key} style={{ background: '#1a1a2e', color: 'white' }}>
                      {key === ACTIVE_STYLE_KEY ? '⭐ ' : ''}{style.label}
                    </option>
                  ))}
                </select>
                <p className="text-white/30 text-[10px] mt-1.5">
                  {ILLUSTRATION_STYLES[illustrationStyleKey as keyof typeof ILLUSTRATION_STYLES]?.description}
                </p>
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

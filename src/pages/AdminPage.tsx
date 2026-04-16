/**
 * AdminPage.tsx — Layout shell for the admin console at /admin/*
 *
 * Renders: left sidebar (NavLink nav) + main content (Outlet) + right log panel.
 * All section logic lives in src/pages/admin/* sub-pages.
 */

import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
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
  LayoutGrid,
  Library,
  Stamp,
  Play,
  Upload,
  Instagram,
} from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { encodeUuidToHash } from '@eb-packages/logic/src/hash';
import { useGenerationLog } from '../hooks/useGenerationLog';
import { useSignedImage } from '../utils/useSignedImage';
import { WIDTHS } from '../utils/imageUtils';
import type { GenerationLogEntry } from '../hooks/useGenerationLog';
import type { AdminOutletContext } from './admin/types';

// ── Helpers ────────────────────────────────────────────────────────────

function timeAgo(isoStr: string): string {
  const diff = Date.now() - new Date(isoStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function strategyColor(strategy: string | null): string {
  if (!strategy) return 'bg-stone-700/50 text-stone-400';
  if (strategy.startsWith('Themed Hunt'))  return 'bg-amber-900/50 text-amber-300';
  if (strategy.startsWith('Dynamic Hunt')) return 'bg-orange-900/50 text-orange-300';
  if (strategy.includes('Wander'))         return 'bg-indigo-900/50 text-indigo-300';
  if (strategy.includes('Trip') || strategy.includes('Album')) return 'bg-emerald-900/50 text-emerald-300';
  if (strategy.includes('Zigzag'))         return 'bg-purple-900/50 text-purple-300';
  return 'bg-stone-700/50 text-stone-400';
}

function strategyShort(strategy: string | null): string {
  if (!strategy) return 'Unknown';
  if (strategy.startsWith('Themed Hunt: '))  return `🎯 ${strategy.replace('Themed Hunt: ', '')}`;
  if (strategy.startsWith('Dynamic Hunt: ')) return `🤖 ${strategy.replace('Dynamic Hunt: ', '')}`;
  if (strategy === 'Dynamic Global Wander')  return '🌍 Wander';
  if (strategy === 'Zigzag Shared Place')    return '📍 Zigzag';
  if (strategy.includes('Trip') || strategy.includes('Album')) return '✈️ Trip';
  return strategy;
}

function categoryLabel(cat: { es: string; en: string } | string | null): string {
  if (!cat) return '';
  if (typeof cat === 'string') return cat;
  return cat.en || cat.es || '';
}

// ── Generation Log Card ────────────────────────────────────────────────

function MetadataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-1.5 text-[10px] leading-snug">
      <span className="text-white/25 shrink-0">{label}</span>
      <span className="text-white/55 break-words">{value}</span>
    </div>
  );
}

function LogCard({ entry }: { entry: GenerationLogEntry }) {
  const imgUrl = useSignedImage(entry.illustration_url, { width: WIDTHS.thumb });
  const [expanded, setExpanded] = React.useState(false);

  const meta          = entry.generation_metadata;
  const storytelling  = meta?.storytelling as { title?: { es?: string; en?: string } | string; did_you_know?: { es?: string; en?: string } | string } | null;
  const styleKey      = meta?.illustration_style_key as string | null;
  const vibeInjected  = meta?.vibe_injected as string | null;
  const explorerScout = meta?.explorer_scout as {
    total_frames: number;
    best_frame: { pano_id: string; heading: number; fov: number; pitch: number; status: string; prominence_pct: number; narration?: string };
    all_frames: { rank: number; pano_id: string; heading: number; fov: number; pitch: number; lens_type?: string; status?: string; prominence_pct: number; narration?: string }[];
  } | null;

  const storyTitle    = storytelling?.title
    ? (typeof storytelling.title === 'string' ? storytelling.title : storytelling.title.es || storytelling.title.en || '')
    : null;
  const didYouKnow    = storytelling?.did_you_know
    ? (typeof storytelling.did_you_know === 'string' ? storytelling.did_you_know : storytelling.did_you_know.es || storytelling.did_you_know.en || '')
    : null;
  const hasMetadata   = !!(storyTitle || didYouKnow || styleKey || vibeInjected || explorerScout);

  // Build a Street View Static thumbnail URL from panoId (no API key needed for metadata-only,
  // but we need key for image fetch — use the env var if available)
  const MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? '';
  const svThumb = (panoId: string, heading: number, fov: number, pitch: number) =>
    `https://maps.googleapis.com/maps/api/streetview?size=160x110&pano=${panoId}&heading=${heading}&pitch=${pitch}&fov=${fov}&key=${MAPS_KEY}`;

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className="rounded-xl hover:bg-white/5 transition-colors group"
    >
      <a
        href={`/preview/${encodeUuidToHash(entry.id)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex gap-3 p-3 cursor-pointer no-underline"
        style={{ textDecoration: 'none' }}
      >
        <div className="w-14 h-20 rounded-lg overflow-hidden bg-white/5 shrink-0 group-hover:ring-1 group-hover:ring-white/20 transition-all">
          {imgUrl
            ? <img src={imgUrl} alt="" className="w-full h-full object-cover" />
            : <div className="w-full h-full flex items-center justify-center text-white/20 text-xs">?</div>
          }
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono font-medium ${strategyColor(entry.strategy)}`}>
              {strategyShort(entry.strategy)}
            </span>
            {explorerScout && (
              <span className="text-[9px] px-1 py-0.5 rounded font-mono bg-indigo-500/20 text-indigo-300">
                🛸 v2
              </span>
            )}
            {entry.has_detailed_tags && <CheckCircle className="w-3 h-3 text-emerald-400/60" />}
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
                target="_blank" rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-indigo-400/70 hover:text-indigo-300 text-[10px] font-mono transition-colors"
                style={{ textDecoration: 'none' }}
              >
                {entry.lat.toFixed(4)}, {entry.lng.toFixed(4)}
              </a>
            </div>
          )}
          <div className="flex items-center gap-1 mt-1">
            <Clock className="w-3 h-3 text-white/20" />
            <span className="text-white/30 text-[10px] font-mono">{timeAgo(entry.created_at)}</span>
            <span className="text-white/10 mx-0.5">·</span>
            <a
              href={`/preview/${encodeUuidToHash(entry.id)}`}
              onClick={(e) => e.stopPropagation()}
              className="text-white/20 hover:text-indigo-300 text-[10px] font-mono transition-colors"
              style={{ textDecoration: 'none' }}
            >
              🔍 {entry.id.slice(0, 8)}
            </a>
          </div>
        </div>
      </a>

      {hasMetadata && (
        <div className="px-3 pb-2">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-[9px] uppercase tracking-widest font-semibold text-white/20 hover:text-white/40 transition-colors w-full"
          >
            <span>{expanded ? '▾' : '▸'}</span>
            <span>metadata</span>
            {explorerScout && (
              <span className="ml-1 text-[9px] font-mono text-indigo-400/50 normal-case tracking-normal">
                {explorerScout.total_frames} frames scouted
              </span>
            )}
            {styleKey && <span className="ml-auto text-[9px] font-mono text-purple-400/50 normal-case tracking-normal">{styleKey}</span>}
          </button>
          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                {/* ── Explorer Scout Filmstrip ─────────────────────────── */}
                {explorerScout && MAPS_KEY && (
                  <div className="mt-2 mb-2">
                    <p className="text-[9px] text-indigo-300/50 uppercase tracking-widest mb-1.5 font-semibold">
                      🛸 Explorer v2 — {explorerScout.total_frames} frames considered
                    </p>
                    <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'thin' }}>
                      {explorerScout.all_frames.map((frame) => {
                        const isWinner = frame.rank === 1;
                        const prominenceColor = frame.prominence_pct >= 35
                          ? 'rgba(16,185,129,0.9)'
                          : frame.prominence_pct >= 15
                            ? 'rgba(245,158,11,0.9)'
                            : 'rgba(239,68,68,0.7)';
                        return (
                          <div
                            key={frame.rank}
                            className="relative shrink-0 rounded-md overflow-hidden"
                            style={{
                              width: 80, height: 56,
                              border: isWinner ? '1.5px solid rgba(16,185,129,0.6)' : '1px solid rgba(255,255,255,0.07)',
                              boxShadow: isWinner ? '0 0 8px rgba(16,185,129,0.3)' : 'none',
                            }}
                            title={frame.narration || `Frame ${frame.rank}`}
                          >
                            <img
                              src={svThumb(frame.pano_id, frame.heading, frame.fov, frame.pitch)}
                              alt={`Frame ${frame.rank}`}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                            {/* Winner crown */}
                            {isWinner && (
                              <div className="absolute top-0.5 right-0.5 text-[10px] leading-none">👑</div>
                            )}
                            {/* Prominence dot */}
                            {frame.prominence_pct > 0 && (
                              <div
                                className="absolute bottom-0.5 left-0.5 text-[7px] font-mono px-1 rounded"
                                style={{ background: 'rgba(0,0,0,0.7)', color: prominenceColor }}
                              >
                                {frame.prominence_pct}%
                              </div>
                            )}
                            {/* Frame number */}
                            <div className="absolute top-0.5 left-0.5 text-[7px] font-mono px-0.5 rounded"
                              style={{ background: 'rgba(0,0,0,0.6)', color: 'rgba(255,255,255,0.5)' }}>
                              #{frame.rank}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {/* Best frame narration */}
                    {explorerScout.best_frame.narration && (
                      <p className="text-[10px] text-white/40 italic mt-1.5 leading-relaxed line-clamp-2">
                        "{explorerScout.best_frame.narration}"
                      </p>
                    )}
                  </div>
                )}
                {/* ── Classic metadata ──────────────────────────────────── */}
                <div className="mt-1.5 pl-2 border-l space-y-1" style={{ borderColor: 'rgba(139,92,246,0.2)' }}>
                  {storyTitle   && <MetadataRow label="📖" value={storyTitle} />}
                  {didYouKnow   && <MetadataRow label="💡" value={didYouKnow} />}
                  {vibeInjected && <MetadataRow label="✨" value={vibeInjected} />}
                  {styleKey     && <MetadataRow label="🎨" value={styleKey} />}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
}

// ── Nav definition ─────────────────────────────────────────────────────

const NAV = [
  { path: '',           icon: <BarChart2  className="w-4 h-4" />, label: 'Dashboard'    },
  { path: 'generation', icon: <Zap        className="w-4 h-4" />, label: 'Generation'   },
  { path: 'queue',      icon: <Play       className="w-4 h-4" />, label: 'Queue & Cron' },
  { path: 'browser',    icon: <LayoutGrid className="w-4 h-4" />, label: 'Browse All'   },
  { path: 'postcards',  icon: <Image      className="w-4 h-4" />, label: 'Postcards'    },
  { path: 'albums',     icon: <Library    className="w-4 h-4" />, label: 'Albums'       },
  { path: 'sync',       icon: <Upload     className="w-4 h-4" />, label: 'Sync to Prod' },
  { path: 'settings',   icon: <Settings   className="w-4 h-4" />, label: 'User Actions' },
  { path: 'stamps',     icon: <Stamp      className="w-4 h-4" />, label: 'Grant Stamps' },
  { path: 'instagram',  icon: <Instagram  className="w-4 h-4" />, label: 'Instagram Bot' },
];

// ── Types ──────────────────────────────────────────────────────────────

interface AdminPageProps {
  user: User | null;
  onPostcardGenerated?: () => void;
}

// ── Main Shell ─────────────────────────────────────────────────────────

export function AdminPage({ user, onPostcardGenerated }: AdminPageProps) {
  const navigate = useNavigate();
  const { entries: logEntries, isLoading: logLoading, lastFetched, refetch: refetchLog } = useGenerationLog(15_000);

  const outletContext: AdminOutletContext = {
    user,
    onPostcardGenerated: onPostcardGenerated ?? (() => {}),
    refetchLog,
  };

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
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === ''}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left"
              style={({ isActive }) => ({
                background: isActive ? 'rgba(99,102,241,0.2)' : 'transparent',
                color:      isActive ? 'rgb(165,180,252)'     : 'rgba(255,255,255,0.5)',
              })}
            >
              {item.icon}
              {item.label}
            </NavLink>
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

        {/* Page content — rendered by sub-routes */}
        <div className="flex-1 overflow-y-auto p-8">
          <Outlet context={outletContext} />
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

          {/* Footer */}
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

/**
 * AdminBrowser.tsx — /admin/browser
 * Postcard grid browser with detail slideout panel.
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Image,
  Search,
  ChevronDown,
  Loader,
  Heart,
  MessageCircle,
  Send,
  Bookmark
} from 'lucide-react';
import { supabase } from '@entity-builders/logic/src/supabase';
import { encodeUuidToHash } from '@entity-builders/logic/src/hash';
import { useSignedImage } from '../../utils/useSignedImage';
import { WIDTHS, preSignUrls } from '../../utils/imageUtils';

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

// ── Types ──────────────────────────────────────────────────────────────

interface BrowserPostcard {
  id: string;
  created_at: string;
  city: string;
  country: string;
  illustration_url: string | null;
  category: { es: string; en: string } | string | null;
  has_detailed: boolean;
  has_illus_tags: boolean;
  has_storytelling: boolean;
  strategy: string | null;
  ig_media_id: string | null;
}

interface PostcardDetail {
  id: string;
  city: string;
  country: string;
  location_name: string;
  category: { es: string; en: string } | string | null;
  description: { es: string; en: string } | string | null;
  visual_tags: string[] | null;
  detailed_tags: Array<{ label: string; confidence?: number }> | null;
  illustration_tags: string[] | null;
  aesthetic_vibes: string[] | null;
  architecture_style: string | null;
  color_palette: string | null;
  scene_type: string | null;
  time_of_day: string | null;
  weather: string | null;
  human_activity: string | null;
  original_image_url: string | null;
  illustration_url: string | null;
  generation_metadata: Record<string, unknown> | null;
  game_stats: { hp: number; attack: number; defense: number; magic: number; element: string; rarity: string; } | null;
  created_at: string;
  ig_media_id: string | null;
  ig_published_at: string | null;
}

// ── Detail Panel helpers ────────────────────────────────────────────────

const TAG_COLORS: Record<string, { bg: string; fg: string }> = {
  indigo:  { bg: 'rgba(99,102,241,0.15)',  fg: 'rgb(165,180,252)' },
  emerald: { bg: 'rgba(16,185,129,0.15)',  fg: 'rgb(110,231,183)' },
  amber:   { bg: 'rgba(245,158,11,0.15)',  fg: 'rgb(252,211,77)' },
  rose:    { bg: 'rgba(244,63,94,0.15)',   fg: 'rgb(251,113,133)' },
  sky:     { bg: 'rgba(14,165,233,0.15)',  fg: 'rgb(125,211,252)' },
  violet:  { bg: 'rgba(139,92,246,0.15)',  fg: 'rgb(196,181,253)' },
};

function TagPill({ children, color = 'indigo' }: { children: React.ReactNode; color?: string }) {
  const c = TAG_COLORS[color] || TAG_COLORS.indigo;
  return (
    <span
      className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium mr-1 mb-1"
      style={{ background: c.bg, color: c.fg }}
    >
      {children}
    </span>
  );
}

function DetailSection({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <h4 className="text-[11px] font-semibold text-white/40 uppercase tracking-widest">{icon} {title}</h4>
      <div>{children}</div>
    </div>
  );
}

// ── Postcard Detail Panel ──────────────────────────────────────────────

function PostcardDetailPanel({ postcardId, onClose }: { postcardId: string; onClose: () => void }) {
  const [detail, setDetail] = useState<PostcardDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [width, setWidth] = useState(420);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('postcards')
        .select('id, city, country, location_name, category, description, visual_tags, detailed_tags, illustration_tags, aesthetic_vibes, architecture_style, color_palette, scene_type, time_of_day, weather, human_activity, original_image_url, illustration_url, generation_metadata, game_stats, created_at, ig_media_id, ig_published_at')
        .eq('id', postcardId)
        .single();
      if (error) console.error('[DetailPanel]', error);
      setDetail(data as PostcardDetail | null);
      setLoading(false);
    };
    fetch();
  }, [postcardId]);

  const origImg  = useSignedImage(detail?.original_image_url  ?? null, { width: 400 });
  const illusImg = useSignedImage(detail?.illustration_url    ?? null, { width: 400 });

  const meta         = detail?.generation_metadata;
  const storytelling = meta?.storytelling as { did_you_know?: { es?: string; en?: string }; historical?: { es?: string; en?: string }; local_culture?: { es?: string; en?: string } } | undefined;
  const trivia       = meta?.trivia as { es?: string; en?: string } | undefined;
  const vibeInjected = meta?.vibe_injected as string | undefined;
  const strategy     = meta?.strategy as string | undefined;

  const bilingualText = (val: { es: string; en: string } | string | null | undefined): string => {
    if (!val) return '—';
    if (typeof val === 'string') return val;
    return val.en || val.es || '—';
  };

  const [pushing, setPushing] = useState(false);
  const [isCarouselMode, setIsCarouselMode] = useState(false);
  const [igPreviewData, setIgPreviewData] = useState<{caption: string; image_url: string; original_image_url?: string; carousel_mode?: boolean} | null>(null);

  const handlePushToIg = async (preview = false) => {
    setPushing(true);
    try {
      const edgeBase = import.meta.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321';
      const edgeKey  = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
      const res = await fetch(`${edgeBase}/functions/v1/postalpeek-ig-publisher`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${edgeKey}` },
        body: JSON.stringify({ postcard_id: postcardId, preview, carousel: isCarouselMode }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Failed to run edge function');
      if (preview) {
        setIgPreviewData({
           caption: data.caption,
           image_url: data.image_url,
           carousel_mode: data.carousel_mode,
           original_image_url: detail?.original_image_url || undefined
        });
      }
      else {
        alert('Publicado con éxito!');
        setDetail(prev => prev ? { ...prev, ig_media_id: data.ig_media_id || 'published' } : null);
      }
    } catch (e: any) {
      alert(`Error: ${e.message}`);
    } finally {
      setPushing(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="fixed top-0 right-0 h-full z-50 flex shadow-2xl"
      style={{ width, background: 'rgba(15,15,25,0.97)', borderLeft: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(20px)' }}
    >
      {igPreviewData && (
        <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm transition-all" onClick={() => setIgPreviewData(null)}>
          <div className="bg-white text-black w-full max-w-[360px] rounded-xl overflow-hidden shadow-2xl scale-100 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-500 p-[2px]">
                  <div className="w-full h-full bg-white rounded-full flex items-center justify-center overflow-hidden">
                    <img src="https://ui-avatars.com/api/?name=Walker&background=000&color=fff" alt="Walker" className="w-full h-full object-cover" />
                  </div>
                </div>
                <div>
                  <p className="text-[13px] font-semibold leading-none">walker</p>
                  <p className="text-[11px] text-gray-500 mt-0.5 leading-none">{detail?.city}, {detail?.country}</p>
                </div>
              </div>
              <span className="text-gray-900 font-bold tracking-widest leading-none mb-2">...</span>
            </div>

            <div className="aspect-[4/5] bg-gray-100 relative group overflow-hidden">
              <img src={igPreviewData.carousel_mode && igPreviewData.original_image_url ? igPreviewData.original_image_url : igPreviewData.image_url} className="w-full h-full object-cover" />
              {igPreviewData.carousel_mode && (
                <div className="absolute top-3 right-3 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded-full backdrop-blur-md">
                   1/2
                </div>
              )}
            </div>

            <div className="p-3">
              <div className="flex justify-between items-center mb-3">
                <div className="flex gap-4">
                  <Heart className="w-6 h-6 stroke-[1.5]" />
                  <MessageCircle className="w-6 h-6 stroke-[1.5]" />
                  <Send className="w-6 h-6 stroke-[1.5]" />
                </div>
                <Bookmark className="w-6 h-6 stroke-[1.5]" />
              </div>
              <p className="text-[13px] font-semibold mb-1">9,234 likes</p>
              
              <div className="text-[13px] leading-tight">
                <span className="font-semibold mr-1">walker</span>
                {igPreviewData.caption.split('\n\n').map((block, i) => (
                  <React.Fragment key={i}>
                    {i > 0 && <br />}
                    {i > 0 && <br />}
                     <span className={block.includes('#') ? 'text-blue-800' : ''}>{block}</span>
                  </React.Fragment>
                ))}
              </div>
              <p className="text-[10px] text-gray-400 mt-2 uppercase font-medium tracking-wide">Just now</p>
            </div>
          </div>
        </div>
      )}
      <div 
        className="absolute top-0 bottom-0 left-0 w-2 hover:w-3 cursor-col-resize hover:bg-indigo-500/30 transition-all z-[60] -ml-1"
        onMouseDown={(e) => {
          e.preventDefault();
          const startX = e.clientX;
          const startWidth = width;
          const onMouseMove = (moveEvent: MouseEvent) => {
            const newWidth = startWidth + (startX - moveEvent.clientX);
            setWidth(Math.min(Math.max(380, newWidth), 1800));
          };
          const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
          };
          document.addEventListener('mousemove', onMouseMove);
          document.addEventListener('mouseup', onMouseUp);
        }}
      />
      <div className="flex-1 overflow-y-auto relative h-full">
        <div className="sticky top-0 z-10 flex items-center justify-between p-4" style={{ background: 'rgba(15,15,25,0.95)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div>
          <p className="text-white/80 text-sm font-semibold">{detail?.city}, {detail?.country}</p>
          <p className="text-white/25 text-[10px] font-mono">{postcardId.slice(0, 12)}… · {detail?.created_at ? timeAgo(detail.created_at) : ''}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => window.open(`/preview/${encodeUuidToHash(postcardId)}`, '_blank')}
            className="px-2 py-1 rounded-lg text-[10px] font-medium"
            style={{ background: 'rgba(99,102,241,0.15)', color: 'rgb(165,180,252)', border: '1px solid rgba(99,102,241,0.3)' }}
          >
            Open ↗
          </button>
          {detail?.illustration_url && (
            <div className="flex items-center gap-2">
              {detail.original_image_url && !detail.ig_media_id && (
                <label className="flex items-center gap-1.5 text-[9px] text-white/50 cursor-pointer hover:text-white/80 transition-colors bg-white/5 px-2 py-1 rounded-lg border border-white/10">
                  <input 
                    type="checkbox" 
                    checked={isCarouselMode} 
                    onChange={(e) => setIsCarouselMode(e.target.checked)} 
                    className="rounded border-white/20 bg-white/5 w-3 h-3 text-pink-500 focus:ring-0 focus:ring-offset-0" 
                  />
                  Carrusel
                </label>
              )}
              <button
                onClick={() => handlePushToIg(true)}
                disabled={pushing}
                className="px-2 py-1 rounded-lg text-[10px] font-medium transition-all text-white/50 bg-white/5 hover:text-white/80 border border-white/10"
              >
                👀 Preview
              </button>
              <button
                onClick={() => handlePushToIg(false)}
                disabled={pushing || !!detail.ig_media_id}
                className="px-2 py-1 rounded-lg text-[10px] font-medium transition-all"
                style={{ background: detail.ig_media_id ? 'rgba(16,185,129,0.15)' : 'rgba(219,39,119,0.15)', color: detail.ig_media_id ? 'rgb(110,231,183)' : 'rgb(244,114,182)', border: `1px solid ${detail.ig_media_id ? 'rgba(16,185,129,0.3)' : 'rgba(219,39,119,0.3)'}` }}
              >
                {pushing ? '⏳ Pushing...' : detail.ig_media_id ? '📱 ✓ Publicado' : '📱 Push IG'}
              </button>
            </div>
          )}
          <button onClick={onClose} className="text-white/30 hover:text-white/60 text-lg transition-colors">✕</button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-white/30">
          <Loader className="w-5 h-5 animate-spin" />
        </div>
      ) : !detail ? (
        <div className="p-6 text-white/30 text-sm">Postcard not found</div>
      ) : (
        <div className="p-4 space-y-5">
          <div className="grid grid-cols-2 gap-2 rounded-xl overflow-hidden">
            <div className="aspect-[3/4] bg-white/5">
              {origImg  ? <img src={origImg}  alt="Original"     className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-white/10 text-[10px]">No photo</div>}
              <p className="text-[9px] text-white/25 text-center mt-1">📸 Original</p>
            </div>
            <div className="aspect-[3/4] bg-white/5">
              {illusImg ? <img src={illusImg} alt="Illustration" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-white/10 text-[10px]">No illustration</div>}
              <p className="text-[9px] text-white/25 text-center mt-1">🎨 Illustration</p>
            </div>
          </div>

          <DetailSection title="Categoría & Descripción" icon="📋">
            <div className="rounded-lg p-3 space-y-2" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-center gap-2">
                <TagPill color="amber">{bilingualText(detail.category)}</TagPill>
                {vibeInjected && <TagPill color="violet">✨ {vibeInjected}</TagPill>}
                {strategy     && <TagPill color="sky">🧭 {strategy}</TagPill>}
              </div>
              <p className="text-white/60 text-xs leading-relaxed">{bilingualText(detail.description)}</p>
            </div>
          </DetailSection>

          <DetailSection title="Escena" icon="🎬">
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { label: 'Scene Type',     value: detail.scene_type,        icon: '🏙️' },
                { label: 'Time of Day',    value: detail.time_of_day,       icon: '🕐' },
                { label: 'Weather',        value: detail.weather,           icon: '☀️' },
                { label: 'Human Activity', value: detail.human_activity,    icon: '👥' },
                { label: 'Architecture',   value: detail.architecture_style,icon: '🏛️' },
                { label: 'Color Palette',  value: detail.color_palette,     icon: '🎨' },
              ].map((item) => (
                <div key={item.label} className="rounded-lg p-2" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <p className="text-white/25 text-[9px] uppercase tracking-wider">{item.icon} {item.label}</p>
                  <p className="text-white/70 text-xs font-medium mt-0.5">{item.value || '—'}</p>
                </div>
              ))}
            </div>
          </DetailSection>

          {detail.aesthetic_vibes && detail.aesthetic_vibes.length > 0 && (
            <DetailSection title="Aesthetic Vibes" icon="✨">
              <div className="flex flex-wrap">{detail.aesthetic_vibes.map((v, i) => <TagPill key={i} color="violet">{v}</TagPill>)}</div>
            </DetailSection>
          )}
          {detail.visual_tags && detail.visual_tags.length > 0 && (
            <DetailSection title="Visual Tags" icon="👁️">
              <div className="flex flex-wrap">{detail.visual_tags.map((t: any, i) => <TagPill key={i} color="indigo">{typeof t === 'string' ? t : bilingualText(t.label)}</TagPill>)}</div>
            </DetailSection>
          )}
          {detail.detailed_tags && detail.detailed_tags.length > 0 && (
            <DetailSection title={`Detailed Tags (${detail.detailed_tags.length})`} icon="🔍">
              <div className="flex flex-wrap">{detail.detailed_tags.map((t: any, i) => <TagPill key={i} color="emerald">{typeof t === 'string' ? t : bilingualText(t.label)}{typeof t === 'object' && t.confidence ? ` (${Math.round(t.confidence * 100)}%)` : ''}</TagPill>)}</div>
            </DetailSection>
          )}
          {detail.illustration_tags && detail.illustration_tags.length > 0 && (
            <DetailSection title={`Illustration Tags (${detail.illustration_tags.length})`} icon="🏷️">
              <div className="flex flex-wrap">{detail.illustration_tags.map((t: any, i) => <TagPill key={i} color="rose">{typeof t === 'string' ? t : bilingualText(t.label)}</TagPill>)}</div>
            </DetailSection>
          )}

          {((detail.game_stats && detail.game_stats.hp !== undefined) || (detail.generation_metadata?.stats as any)?.nature !== undefined) && (
            <DetailSection title={(detail.game_stats && detail.game_stats.hp !== undefined) ? `RPG Stats — ${(detail.game_stats.rarity || 'common').toUpperCase()} ${(detail.game_stats.element || 'neutral').toUpperCase()}` : `Radar de Vibes`} icon={(detail.game_stats && detail.game_stats.hp !== undefined) ? "🎴" : "✨"}>
              <div className="grid grid-cols-4 gap-1.5">
                {(detail.game_stats && detail.game_stats.hp !== undefined ? [
                  { label: 'HP', value: detail.game_stats.hp, icon: '❤️' },
                  { label: 'Attack', value: detail.game_stats.attack, icon: '⚔️' },
                  { label: 'Defense', value: detail.game_stats.defense, icon: '🛡️' },
                  { label: 'Magic', value: detail.game_stats.magic, icon: '✨' },
                ] : [
                  { label: 'Nature', value: (detail.generation_metadata!.stats as any).nature, icon: '🌿' },
                  { label: 'History', value: (detail.generation_metadata!.stats as any).history, icon: '🏛️' },
                  { label: 'Urban', value: (detail.generation_metadata!.stats as any).urban, icon: '🏗️' },
                  { label: 'Vibe', value: (detail.generation_metadata!.stats as any).vibe, icon: '✨' },
                ]).map(stat => (
                  <div key={stat.label} className="rounded-lg p-2 flex flex-col items-center justify-center text-center" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <span className="text-sm mb-1">{stat.icon}</span>
                    <span className="text-white/80 font-mono font-bold text-xs">{stat.value}</span>
                    <span className="text-white/30 text-[8px] uppercase tracking-wider">{stat.label}</span>
                  </div>
                ))}
              </div>
            </DetailSection>
          )}

          {storytelling && (
            <DetailSection title="Storytelling" icon="📖">
              <div className="space-y-2">
                {storytelling.did_you_know && (
                  <div className="rounded-lg p-3" style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}>
                    <p className="text-amber-300/60 text-[9px] uppercase tracking-wider mb-1">💡 ¿Sabías que…?</p>
                    <p className="text-amber-100/80 text-xs leading-relaxed">{storytelling.did_you_know.en || storytelling.did_you_know.es}</p>
                  </div>
                )}
                {storytelling.historical && (
                  <div className="rounded-lg p-3" style={{ background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.15)' }}>
                    <p className="text-violet-300/60 text-[9px] uppercase tracking-wider mb-1">🏛️ Historia</p>
                    <p className="text-violet-100/80 text-xs leading-relaxed">{storytelling.historical.en || storytelling.historical.es}</p>
                  </div>
                )}
                {storytelling.local_culture && (
                  <div className="rounded-lg p-3" style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)' }}>
                    <p className="text-emerald-300/60 text-[9px] uppercase tracking-wider mb-1">🎭 Cultura local</p>
                    <p className="text-emerald-100/80 text-xs leading-relaxed">{storytelling.local_culture.en || storytelling.local_culture.es}</p>
                  </div>
                )}
              </div>
            </DetailSection>
          )}
          {trivia && (
            <DetailSection title="Trivia" icon="🎲">
              <div className="rounded-lg p-3" style={{ background: 'rgba(14,165,233,0.06)', border: '1px solid rgba(14,165,233,0.15)' }}>
                <p className="text-sky-100/80 text-xs leading-relaxed">{trivia.en || trivia.es || JSON.stringify(trivia)}</p>
              </div>
            </DetailSection>
          )}
          <div className="h-8" />
        </div>
      )}
      </div>
    </motion.div>
  );
}

// ── Browser Card ───────────────────────────────────────────────────────

function BrowserCard({ pc, onClick, onForceUpdate }: { pc: BrowserPostcard; onClick: (id: string) => void, onForceUpdate: (id: string, ig_media_id: string|null) => void }) {
  const imgUrl = useSignedImage(pc.illustration_url, { width: WIDTHS.thumb });
  const [pushing, setPushing] = useState(false);

  const handlePush = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (pc.ig_media_id) return alert('Ya está publicado!');
    setPushing(true);
    try {
      const edgeBase = import.meta.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321';
      const edgeKey  = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
      const res = await fetch(`${edgeBase}/functions/v1/postalpeek-ig-publisher`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${edgeKey}` },
        body: JSON.stringify({ postcard_id: pc.id, preview: false }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Failed to publish');
      alert('Publicado con éxito!');
      onForceUpdate(pc.id, data.ig_media_id || 'published');
    } catch (e: any) {
      alert(`Error: ${e.message}`);
    } finally {
      setPushing(false);
    }
  };

  return (
    <div
      onClick={() => onClick(pc.id)}
      className="rounded-xl overflow-hidden cursor-pointer group transition-all hover:ring-1 hover:ring-indigo-400/40 hover:scale-[1.02] flex flex-col relative"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
    >
      <div className="aspect-[3/4] w-full bg-white/5 overflow-hidden relative">
        {imgUrl ? (
          <img src={imgUrl} alt={pc.city} className="w-full h-full object-cover group-hover:brightness-110 transition-all" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white/10">
            <Image className="w-6 h-6" />
          </div>
        )}
        <div className="absolute top-1 right-1 flex gap-0.5">
          {pc.has_detailed    && <span className="w-4 h-4 rounded-full bg-emerald-500/80 flex items-center justify-center text-[8px]" title="Enriched">✓</span>}
          {pc.has_illus_tags  && <span className="w-4 h-4 rounded-full bg-indigo-500/80  flex items-center justify-center text-[8px]" title="Illus Tags">🏷</span>}
          {pc.has_storytelling && <span className="w-4 h-4 rounded-full bg-amber-500/80   flex items-center justify-center text-[8px]" title="Storytelling">📖</span>}
          {pc.ig_media_id     && <span className="w-4 h-4 rounded-full bg-pink-500/80   flex items-center justify-center text-[8px]" title="Instagram">📱</span>}
        </div>
        {pc.strategy && (
          <span className={`absolute bottom-1 left-1 text-[8px] px-1.5 py-0.5 rounded-full font-mono font-medium ${strategyColor(pc.strategy)}`}>
            {strategyShort(pc.strategy)}
          </span>
        )}
      </div>
      <div className="p-2 flex flex-col justify-between flex-1">
        <div>
          <p className="text-white/80 text-[11px] font-medium truncate leading-tight">
            {pc.city}{pc.country ? `, ${pc.country}` : ''}
          </p>
          <p className="text-white/25 text-[9px] font-mono truncate mt-0.5">
            {pc.id.slice(0, 8)} · {timeAgo(pc.created_at)}
          </p>
        </div>
        <div className="mt-2 text-right">
          <button
            onClick={handlePush}
            disabled={pushing || !!pc.ig_media_id}
            className="px-2 py-0.5 rounded text-[9px] font-medium transition-all inline-block hover:opacity-80"
            style={{ 
              background: pc.ig_media_id ? 'rgba(16,185,129,0.15)' : 'rgba(219,39,119,0.15)', 
              color: pc.ig_media_id ? 'rgb(110,231,183)' : 'rgb(244,114,182)', 
              border: `1px solid ${pc.ig_media_id ? 'rgba(16,185,129,0.3)' : 'rgba(219,39,119,0.3)'}` 
            }}
          >
            {pushing ? '⏳ Pushing...' : pc.ig_media_id ? '📱 ✓ Publicado' : '📱 Push IG'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Postcards Browser ──────────────────────────────────────────────────

const PAGE_SIZE = 48;

function PostcardsBrowser({ onSelectPostcard }: { onSelectPostcard: (id: string) => void }) {
  const [postcards, setPostcards]     = useState<BrowserPostcard[]>([]);
  const [loading, setLoading]         = useState(false);
  const [hasMore, setHasMore]         = useState(true);
  const [totalCount, setTotalCount]   = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter]           = useState<'all' | 'missing_meta' | 'missing_tags' | 'has_story'>('all');
  const offsetRef = useRef(0);

  const fetchPage = useCallback(async (reset = false) => {
    setLoading(true);
    const offset = reset ? 0 : offsetRef.current;
    try {
      if (reset || totalCount === null) {
        const { count } = await supabase.from('postcards').select('id', { count: 'exact', head: true });
        setTotalCount(count ?? 0);
      }
      let query = supabase
        .from('postcards')
        .select('id, created_at, city, country, illustration_url, category, detailed_tags, illustration_tags, generation_metadata, ig_media_id')
        .order('created_at', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);

      if (searchQuery.trim()) query = query.or(`city.ilike.%${searchQuery.trim()}%,country.ilike.%${searchQuery.trim()}%`);
      if (filter === 'missing_meta') query = query.is('detailed_tags', null);
      else if (filter === 'missing_tags') query = query.or('illustration_tags.is.null,illustration_tags.eq.[]');
      else if (filter === 'has_story') query = query.not('generation_metadata->storytelling', 'is', null);

      const { data, error } = await query;
      if (error) throw error;

      const mapped: BrowserPostcard[] = (data || []).map((row) => {
        const meta = row.generation_metadata as Record<string, unknown> | null;
        return {
          id: row.id as string,
          created_at: row.created_at as string,
          city: (row.city as string) || '—',
          country: (row.country as string) || '',
          illustration_url: row.illustration_url as string | null,
          category: row.category as BrowserPostcard['category'],
          has_detailed: Array.isArray(row.detailed_tags) && (row.detailed_tags as unknown[]).length > 0,
          has_illus_tags: Array.isArray(row.illustration_tags) && (row.illustration_tags as unknown[]).length > 0,
          has_storytelling: !!(meta?.storytelling),
          strategy: (meta?.strategy as string) || null,
          ig_media_id: (row.ig_media_id as string | null) || null,
        };
      });

      const urls = mapped.map(p => p.illustration_url).filter(Boolean) as string[];
      preSignUrls(urls);

      if (reset) { setPostcards(mapped); offsetRef.current = PAGE_SIZE; }
      else        { setPostcards(prev => [...prev, ...mapped]); offsetRef.current = offset + PAGE_SIZE; }
      setHasMore(mapped.length === PAGE_SIZE);
    } catch (err) {
      console.error('[PostcardsBrowser]', err);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, filter, totalCount]);

  useEffect(() => { fetchPage(true); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [searchQuery, filter]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Postcards Browser</h2>
        {totalCount !== null && <span className="text-white/30 text-xs font-mono">{postcards.length} / {totalCount} total</span>}
      </div>

      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25" />
          <input
            type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search city or country…" className="w-full pl-9 pr-3 py-2 rounded-xl text-sm"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', outline: 'none' }}
          />
        </div>
        {[
          { key: 'all',          label: 'All' },
          { key: 'missing_meta', label: '⚠ No Enrichment' },
          { key: 'missing_tags', label: '⚠ No Illus Tags' },
          { key: 'has_story',    label: '📖 Has Story' },
        ].map((f) => (
          <button key={f.key} onClick={() => setFilter(f.key as typeof filter)}
            className="px-3 py-2 rounded-xl text-xs font-medium transition-all"
            style={{
              background: filter === f.key ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${filter === f.key ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.06)'}`,
              color: filter === f.key ? 'rgb(165,180,252)' : 'rgba(255,255,255,0.5)',
            }}
          >{f.label}</button>
        ))}
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
        {postcards.map((pc) => (
          <BrowserCard 
            key={pc.id} 
            pc={pc} 
            onClick={onSelectPostcard} 
            onForceUpdate={(id, ig_media_id) => {
              setPostcards(prev => prev.map(p => p.id === id ? { ...p, ig_media_id } : p));
            }}
          />
        ))}
      </div>

      {loading && <div className="flex items-center justify-center py-6 text-white/30 text-sm"><Loader className="w-4 h-4 animate-spin mr-2" /> Loading…</div>}
      {!loading && hasMore && postcards.length > 0 && (
        <button onClick={() => fetchPage(false)}
          className="w-full py-3 rounded-xl text-sm font-medium text-white/50 hover:text-white/80 hover:bg-white/5 transition-all flex items-center justify-center gap-2"
          style={{ border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <ChevronDown className="w-4 h-4" /> Load more postcards
        </button>
      )}
      {!loading && postcards.length === 0 && <div className="py-12 text-center text-white/20 text-sm">No postcards found</div>}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────

export function AdminBrowser() {
  const [selectedPostcardId, setSelectedPostcardId] = useState<string | null>(null);
  return (
    <div className="max-w-[1200px]">
      <PostcardsBrowser onSelectPostcard={(id) => setSelectedPostcardId(id)} />
      <AnimatePresence>
        {selectedPostcardId && (
          <PostcardDetailPanel
            postcardId={selectedPostcardId}
            onClose={() => setSelectedPostcardId(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * PostcardDetailPage.tsx — /:id
 *
 * Full admin detail view for a single postcard.
 * Shows ALL available data from postalpeek_postcards.
 */

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  MapPin,
  Clock,
  Copy,
  ExternalLink,
  Image as ImageIcon,
  Tag,
  Cpu,
  Eye,
  Wind,
  Palette,
  Film,
  Hash,
  Globe,
  RefreshCw,
  Search,
  Sparkles,
  Loader,
  CheckCircle,
  Scissors,
} from 'lucide-react';
import { supabase } from '@eb-packages/logic/src/supabase';
import { encodeUuidToHash } from '@eb-packages/logic/src/hash';
import { useSignedImage } from '../utils/useSignedImage';
import { WIDTHS } from '../utils/imageUtils';

// ── Full postcard type ──────────────────────────────────────────────────
interface PostcardDetail {
  id: string;
  created_at: string;
  // Geo
  city: string;
  country: string;
  location_name: string | null;
  lat: number | null;
  lng: number | null;
  // Images
  illustration_url: string | null;
  original_image_url: string | null;
  // Content
  category: { es: string; en: string } | string | null;
  description: { es: string; en: string } | string | null;
  // StreetView
  streetview_pov: Record<string, unknown> | null;
  // Generation
  generation_metadata: Record<string, unknown> | null;
  // Ownership
  owner_id: string | null;
  // Scene meta (Phase 4.2)
  scene_type: string | null;
  time_of_day: string | null;
  weather: string | null;
  human_activity: string | null;
  // Structural tags
  detailed_tags: unknown[] | null;
  illustration_tags: unknown[] | null;
  // Vibes (Phase 4.3)
  aesthetic_vibes: string[] | null;
  architecture_style: string | null;
  color_palette: string | null;
  // Video
  video_generation_status: string | null;
  imagine_task_id: string | null;
  should_animate: boolean | null;
  // SAM2
  sam2_masks: string[] | null;
  semantic_layers: Record<string, any>[] | null;
}

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

function bilingualText(v: { es: string; en: string } | string | null): string {
  if (!v) return '';
  if (typeof v === 'string') return v;
  const parts = [];
  if (v.en) parts.push(`EN: ${v.en}`);
  if (v.es) parts.push(`ES: ${v.es}`);
  return parts.join('  ·  ');
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).catch(() => {});
}

// ── Sub-components ─────────────────────────────────────────────────────

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-2xl border p-5 space-y-3"
      style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.07)' }}
    >
      <div className="flex items-center gap-2 text-white/40 text-xs uppercase tracking-widest font-semibold">
        <span className="text-white/30">{icon}</span>
        {title}
      </div>
      {children}
    </div>
  );
}

function Row({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex gap-3 text-sm">
      <span className="text-white/30 w-36 shrink-0 text-right">{label}</span>
      <span className={`text-white/80 flex-1 break-all ${mono ? 'font-mono text-xs' : ''}`}>{value ?? <em className="text-white/15">null</em>}</span>
    </div>
  );
}

function TagPill({ label }: { label: string }) {
  return (
    <span
      className="px-2.5 py-1 rounded-full text-xs font-medium border"
      style={{ background: 'rgba(99,102,241,0.12)', borderColor: 'rgba(99,102,241,0.3)', color: 'rgb(165,180,252)' }}
    >
      {label}
    </span>
  );
}

function JsonBlock({ data }: { data: unknown }) {
  return (
    <pre
      className="text-[11px] font-mono text-white/60 overflow-x-auto p-3 rounded-xl leading-relaxed whitespace-pre-wrap break-all"
      style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)' }}
    >
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

function ImgPanel({ url, label }: { url: string | null; label: string }) {
  const signed = useSignedImage(url, { width: WIDTHS.mobile });
  return (
    <div className="flex flex-col gap-2">
      <p className="text-white/30 text-xs">{label}</p>
      {signed ? (
        <a href={signed} target="_blank" rel="noopener noreferrer" className="group relative">
          <img src={signed} alt={label} className="w-full rounded-xl object-cover shadow-lg group-hover:brightness-110 transition-all" />
          <div className="absolute inset-0 rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: 'rgba(0,0,0,0.4)' }}>
            <ExternalLink className="w-5 h-5 text-white" />
          </div>
        </a>
      ) : (
        <div
          className="w-full aspect-[3/4] rounded-xl flex items-center justify-center"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px dashed rgba(255,255,255,0.1)' }}
        >
          <ImageIcon className="w-8 h-8 text-white/15" />
        </div>
      )}
    </div>
  );
}

function DetailedTagsTable({ tags }: { tags: unknown[] }) {
  type Tag = { label?: string | { en?: string; es?: string }; spanish_label?: string | { en?: string; es?: string }; type?: string; weight?: number; confidence?: number; count?: number; position?: string; box_2d?: number[]; bbox?: number[] };
  const typed = tags as Tag[];
  if (!typed.length) return <p className="text-white/20 text-xs">Empty</p>;
  return (
    <div className="overflow-x-auto">
      <table className="text-xs w-full border-collapse">
        <thead>
          <tr className="text-white/25 text-left">
            {['Label', 'ES', 'Type', 'Weight', 'Confidence', 'Count', 'Position', 'Bbox'].map((h) => (
              <th key={h} className="py-1.5 pr-4 font-normal">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {typed.map((tag, i) => (
            <tr key={i} className="border-t" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
              <td className="py-1.5 pr-4 text-white/80 font-medium">{typeof tag.label === 'object' && tag.label !== null ? bilingualText(tag.label as { en: string; es: string }) : (tag.label ?? '—')}</td>
              <td className="py-1.5 pr-4 text-white/50">{typeof tag.spanish_label === 'object' && tag.spanish_label !== null ? bilingualText(tag.spanish_label as { en: string; es: string }) : (tag.spanish_label ?? '—')}</td>
              <td className="py-1.5 pr-4 text-indigo-300/70">{tag.type ?? '—'}</td>
              <td className="py-1.5 pr-4 text-emerald-300/70">{tag.weight != null ? tag.weight.toFixed(2) : '—'}</td>
              <td className="py-1.5 pr-4 text-amber-300/70">{tag.confidence != null ? tag.confidence.toFixed(2) : '—'}</td>
              <td className="py-1.5 pr-4 text-white/40">{tag.count ?? '—'}</td>
              <td className="py-1.5 pr-4 text-white/30">{tag.position ?? '—'}</td>
              <td className="py-1.5 pr-4 text-white/30 font-mono text-[10px]">{(tag.box_2d ?? tag.bbox) ? `[${(tag.box_2d ?? tag.bbox)!.join(', ')}]` : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}


function InteractiveIllustrationPanel({ postcard }: { postcard: PostcardDetail }) {
  const signed = useSignedImage(postcard.illustration_url, { width: WIDTHS.desktop });
  const [showReward, setShowReward] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [showAllBoxes, setShowAllBoxes] = useState(false);
  const [localTags, setLocalTags] = useState<any[] | null>(null);

  const BOX_COLORS = [
    'rgba(251,191,36,0.85)',   // amber
    'rgba(99,102,241,0.85)',   // indigo
    'rgba(16,185,129,0.85)',   // emerald
    'rgba(244,63,94,0.85)',    // rose
    'rgba(168,85,247,0.85)',   // purple
    'rgba(14,165,233,0.85)',   // sky
    'rgba(249,115,22,0.85)',   // orange
    'rgba(236,72,153,0.85)',   // pink
  ];

  const runSemanticScan = async () => {
    setIsScanning(true);
    try {
      const baseUrl = import.meta.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321';
      const res = await fetch(`${baseUrl}/functions/v1/postalpeek-semantic-segment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
        },
        body: JSON.stringify({ image_url: postcard.illustration_url, postcard_id: postcard.id })
      });
      if (!res.ok) throw new Error(`Scan failed: ${await res.text()}`);
      const data = await res.json();
      
      // Update local state immediately — no reload needed
      setLocalTags(data.layers);
      setShowAllBoxes(true);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setIsScanning(false);
    }
  };

  // Use localTags (from scan) if available, otherwise fall back to DB data
  const activeTags = localTags ?? postcard.illustration_tags;

  const tagsWithBbox = useMemo(() =>
    (activeTags as { label?: string | { en?: string }; box_2d?: number[]; bbox?: number[]; confidence?: number }[] | null)?.filter(
      (t) => {
        const coords = t?.box_2d ?? t?.bbox;
        return coords && Array.isArray(coords) && coords.length === 4;
      },
    ) ?? [],
    [activeTags],
  );

  return (
    <div className="flex flex-col gap-3">
      {/* Header row */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-amber-200/80 text-xs font-semibold tracking-wide uppercase flex items-center gap-1.5">
           <Sparkles className="w-3.5 h-3.5" /> Interactive Poster
           {tagsWithBbox.length > 0 && (
             <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300">
               {tagsWithBbox.length}
             </span>
           )}
        </p>
        <div className="flex items-center gap-2">
          {tagsWithBbox.length > 0 && (
            <button
              onClick={() => setShowAllBoxes(prev => !prev)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
                showAllBoxes
                  ? 'bg-amber-500/20 text-amber-200 border border-amber-500/40'
                  : 'text-white/40 hover:text-white/60 border border-white/10 hover:bg-white/5'
              }`}
            >
              <Eye className="w-3 h-3" />
              {showAllBoxes ? 'Hide Boxes' : 'Show All'}
            </button>
          )}
          <button
            onClick={runSemanticScan}
            disabled={isScanning}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:bg-white/10 disabled:opacity-40"
            style={{ border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(165,180,252,0.9)' }}
          >
            {isScanning ? <Loader className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
            {isScanning ? 'Scanning...' : 'Run Pipeline'}
          </button>
        </div>
      </div>

      {/* Image preview — full width, no column constraint */}
      {signed ? (
        <>
          <div className="relative rounded-xl overflow-hidden border" style={{ borderColor: showAllBoxes ? 'rgba(251,191,36,0.3)' : 'rgba(255,255,255,0.1)' }}>
            <img src={signed} alt="Illustration" className="w-full block" style={{ maxHeight: '75vh' }} />
            {tagsWithBbox.map((tag, idx) => {
              const coords = tag.box_2d ?? tag.bbox;
              if (!coords) return null;
              const [ymin, xmin, ymax, xmax] = coords;
              const label = typeof tag.label === 'string' ? tag.label : tag.label?.en || 'Object';
              const color = BOX_COLORS[idx % BOX_COLORS.length];
              const isVisible = showAllBoxes;
              return (
                <div
                  key={idx}
                  onClick={() => setShowReward(label)}
                  className="absolute z-30 cursor-pointer transition-all duration-200 pointer-events-auto"
                  style={{
                    top: `${(ymin / 1000) * 100}%`, left: `${(xmin / 1000) * 100}%`,
                    height: `${((ymax - ymin) / 1000) * 100}%`, width: `${((xmax - xmin) / 1000) * 100}%`,
                    border: isVisible ? `2px solid ${color}` : '2px dashed rgba(251,191,36,0)',
                    backgroundColor: isVisible ? color.replace('0.85', '0.08') : 'transparent',
                    boxShadow: isVisible ? `0 0 8px ${color.replace('0.85', '0.3')}` : 'none',
                  }}
                  title={`${label}${tag.confidence ? ` (${tag.confidence}/10)` : ''}`}
                  onMouseEnter={(e) => {
                    if (!isVisible) {
                      e.currentTarget.style.border = '2px dashed rgba(251,191,36,0.8)';
                      e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)';
                      e.currentTarget.style.boxShadow = '0 0 15px rgba(251,191,36,0.4)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isVisible) {
                      e.currentTarget.style.border = '2px dashed rgba(251,191,36,0)';
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.boxShadow = 'none';
                    }
                  }}
                >
                  {/* Label badge — only visible in show-all mode */}
                  {isVisible && (
                    <span
                      className="absolute -top-5 left-0 px-1.5 py-0.5 rounded text-[9px] font-bold whitespace-nowrap"
                      style={{ backgroundColor: color, color: '#000' }}
                    >
                      {label}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Objects list summary when boxes are shown */}
          {showAllBoxes && tagsWithBbox.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {tagsWithBbox.map((tag, idx) => {
                const label = typeof tag.label === 'string' ? tag.label : tag.label?.en || 'Object';
                const color = BOX_COLORS[idx % BOX_COLORS.length];
                const coords = tag.box_2d ?? tag.bbox;
                const area = coords ? (((coords[2]-coords[0]) * (coords[3]-coords[1])) / 1e6 * 100).toFixed(1) : '?';
                return (
                  <div key={idx} className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/5 text-[10px]">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                    <span className="text-white/70 truncate">{label}</span>
                    <span className="text-white/30 ml-auto flex-shrink-0">{area}%</span>
                  </div>
                );
              })}
            </div>
          )}

          {showReward && (
            <motion.div
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="mt-2 p-5 rounded-2xl text-center border overflow-hidden relative shadow-xl"
              style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.15) 0%, rgba(217,119,6,0.3) 100%)', borderColor: 'rgba(245,158,11,0.4)' }}
            >
              <Sparkles className="w-10 h-10 text-amber-400 mx-auto mb-3 animate-pulse drop-shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
              <h3 className="text-amber-100 font-bold text-xl mb-1 tracking-tight">{showReward} Found!</h3>
              <p className="text-amber-200/80 text-sm mb-4 font-medium">+1 Travel Stamp Earned</p>
              <div className="flex gap-2 justify-center">
                <button
                  onClick={() => setShowReward(null)}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-white/10 text-white hover:bg-white/20 transition-all shadow-sm"
                >
                  Keep Exploring
                </button>
              </div>
            </motion.div>
          )}
        </>
      ) : (
        <div className="w-full aspect-[3/4] rounded-xl flex items-center justify-center border border-dashed border-white/10 bg-white/5">
          <ImageIcon className="w-8 h-8 text-white/15" />
        </div>
      )}
    </div>
  );
}

// ── Discoveries Section ─────────────────────────────────────────────────


type IllTag = { label?: string | { en?: string }; tag_type?: string; type?: string; box_2d?: number[]; bbox?: number[] };

function getTagLabel(t: IllTag): string {
  if (typeof t.label === 'string') return t.label;
  if (typeof t.label === 'object' && t.label?.en) return t.label.en;
  return JSON.stringify(t.label);
}

interface DiscoveryRow {
  id: string;
  postcard_id: string;
  user_id: string;
  tag_label_en: string;
  tag_type: string;
  bbox: number[];
  sticker_url: string | null;
  sticker_status: string;
  discovered_at: string;
}

function DiscoveriesSection({ postcard }: { postcard: PostcardDetail }) {
  const [discoveries, setDiscoveries] = useState<DiscoveryRow[]>([]);
  const [cropUrls, setCropUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<Set<string>>(new Set());
  const [genAllStatus, setGenAllStatus] = useState<'idle' | 'loading' | 'done'>('idle');
  const [genProgress, setGenProgress] = useState({ done: 0, total: 0 });
  const [cropStatus, setCropStatus] = useState<'idle' | 'loading' | 'done'>('idle');

  // Fetch discoveries for this postcard (all users — admin view)
  const fetchDiscoveries = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('postalpeek_discoveries')
      .select('*')
      .eq('postcard_id', postcard.id)
      .order('discovered_at', { ascending: false });
    if (data) setDiscoveries(data as DiscoveryRow[]);
    setLoading(false);
  }, [postcard.id]);

  useEffect(() => { fetchDiscoveries(); }, [fetchDiscoveries]);

  // Tags that have a bbox and can be vectorized
  const tagsWithBbox = useMemo(() =>
    (postcard.illustration_tags as IllTag[] | null)?.filter(
      (t) => {
        const coords = t?.box_2d ?? t?.bbox;
        return coords && Array.isArray(coords) && coords.length === 4;
      },
    ) ?? [],
    [postcard.illustration_tags],
  );

  const isAlreadyDiscovered = useCallback(
    (tagLabel: string) =>
      discoveries.some((d) => d.tag_label_en === tagLabel && d.sticker_status === 'done'),
    [discoveries],
  );

  // Batch crop all tags (FREE — no AI)
  const cropAll = useCallback(async () => {
    setCropStatus('loading');
    try {
      const baseUrl = import.meta.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321';
      const res = await fetch(`${baseUrl}/functions/v1/postalpeek-crop-tags`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
        },
        body: JSON.stringify({ postcard_id: postcard.id }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const urls: Record<string, string> = {};
      for (const crop of data.crops || []) {
        urls[crop.tag_label_en] = crop.crop_url;
      }
      setCropUrls(urls);
      setCropStatus('done');
    } catch (err) {
      console.error('[CropAll]', err);
      setCropStatus('idle');
    }
  }, [postcard.id]);

  // Generate a single sticker (Gemini vectorize — $)
  const generateOne = useCallback(async (tag: IllTag) => {
    const label = getTagLabel(tag);
    setGenerating((prev) => new Set(prev).add(label));
    try {
      const baseUrl = import.meta.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321';
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${baseUrl}/functions/v1/postalpeek-vectorize-tag`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          postcard_id: postcard.id,
          tag_label_en: label,
          tag_type: tag.tag_type || tag.type || 'object',
          bbox: tag.box_2d ?? tag.bbox,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      await fetchDiscoveries();
    } catch (err) {
      console.error('[GenSticker]', err);
    } finally {
      setGenerating((prev) => { const n = new Set(prev); n.delete(label); return n; });
    }
  }, [postcard.id, fetchDiscoveries]);

  // Generate ALL stickers sequentially
  const generateAll = useCallback(async () => {
    const pending = tagsWithBbox.filter((t) => !isAlreadyDiscovered(getTagLabel(t)));
    if (pending.length === 0) return;
    setGenAllStatus('loading');
    setGenProgress({ done: 0, total: pending.length });
    for (let i = 0; i < pending.length; i++) {
      await generateOne(pending[i]);
      setGenProgress({ done: i + 1, total: pending.length });
    }
    setGenAllStatus('done');
  }, [tagsWithBbox, generateOne, isAlreadyDiscovered]);

  const discoveredCount = discoveries.filter((d) => d.sticker_status === 'done').length;
  const pendingTags = tagsWithBbox.filter((t) => !isAlreadyDiscovered(getTagLabel(t)));
  const hasCrops = Object.keys(cropUrls).length > 0;

  return (
    <Section icon={<Search className="w-3.5 h-3.5" />} title="Discoveries / Objects">
      {/* Summary */}
      <div className="flex items-center gap-3 mb-2">
        <span className="text-white/60 text-xs">
          {discoveredCount} vectorized · {Object.keys(cropUrls).length} cropped
        </span>
        <span className="text-white/20 text-xs">·</span>
        <span className="text-white/40 text-xs">
          {tagsWithBbox.length} tag{tagsWithBbox.length !== 1 ? 's' : ''} with bbox
        </span>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-white/30 text-sm py-4">
          <Loader className="w-4 h-4 animate-spin" /> Loading discoveries…
        </div>
      ) : (
        <>
          {/* Action buttons row */}
          <div className="flex gap-3 mb-4">
            {/* Crop All — FREE */}
            <button
              onClick={cropAll}
              disabled={cropStatus === 'loading'}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-white transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2 hover:brightness-110 border border-white/5"
              style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.5), rgba(5,150,105,0.5))' }}
            >
              {cropStatus === 'loading' ? (
                <><Loader className="w-4 h-4 animate-spin" /> Cropping…</>
              ) : cropStatus === 'done' ? (
                <><CheckCircle className="w-4 h-4" /> Crops ready!</>
              ) : (
                <><ImageIcon className="w-4 h-4" /> Crop All (Free)</>
              )}
            </button>

            {/* Vectorize All — $ */}
            {pendingTags.length > 0 && (
              <button
                onClick={generateAll}
                disabled={genAllStatus === 'loading'}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-white transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2 hover:brightness-110 border border-white/5"
                style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.5), rgba(217,119,6,0.5))' }}
              >
                {genAllStatus === 'loading' ? (
                  <><Loader className="w-4 h-4 animate-spin" /> Vectorizing… {genProgress.done}/{genProgress.total}</>
                ) : genAllStatus === 'done' ? (
                  <><CheckCircle className="w-4 h-4" /> All done!</>
                ) : (
                  <><Sparkles className="w-4 h-4" /> Vectorize All · ${(pendingTags.length * 0.001).toFixed(3)}</>
                )}
              </button>
            )}
          </div>

          {/* Comparison grid */}
          {(hasCrops || discoveries.length > 0) && (
            <div className="overflow-x-auto mb-4">
              <table className="text-xs w-full border-collapse">
                <thead>
                  <tr className="text-white/25 text-left">
                    <th className="py-1.5 pr-3 font-normal">Label</th>
                    <th className="py-1.5 pr-3 font-normal">Type</th>
                    <th className="py-1.5 pr-3 font-normal">Bbox</th>
                    <th className="py-1.5 pr-3 font-normal text-center">
                      <span className="text-emerald-400/70">Crop ($0)</span>
                    </th>
                    <th className="py-1.5 pr-3 font-normal text-center">
                      <span className="text-amber-400/70">Vectorized ($)</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {tagsWithBbox.map((tag, i) => {
                    const label = getTagLabel(tag);
                    const disc = discoveries.find((d) => d.tag_label_en === label);
                    const cropUrl = cropUrls[label];
                    const isGen = generating.has(label);
                    return (
                      <tr key={i} className="border-t" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                        <td className="py-2 pr-3 text-white/80 font-medium">{label}</td>
                        <td className="py-2 pr-3 text-indigo-300/70">{tag.tag_type || tag.type || '—'}</td>
                        <td className="py-2 pr-3 text-white/30 font-mono text-[10px]">[{(tag.box_2d ?? tag.bbox)!.join(', ')}]</td>
                        {/* Crop column */}
                        <td className="py-2 pr-3 text-center">
                          {cropUrl ? (
                            <a href={cropUrl} target="_blank" rel="noopener noreferrer">
                              <img
                                src={cropUrl}
                                alt={label}
                                className="w-14 h-14 object-cover rounded-lg mx-auto hover:scale-110 transition-transform"
                                style={{ background: 'rgba(255,255,255,0.06)', filter: 'drop-shadow(0 0 2px white) drop-shadow(0 0 2px white)' }}
                              />
                            </a>
                          ) : (
                            <span className="text-white/15">—</span>
                          )}
                        </td>
                        {/* Vectorized column */}
                        <td className="py-2 pr-3 text-center">
                          {disc?.sticker_url ? (
                            <a href={disc.sticker_url} target="_blank" rel="noopener noreferrer">
                              <img
                                src={disc.sticker_url}
                                alt={label}
                                className="w-14 h-14 object-contain rounded-lg mx-auto hover:scale-110 transition-transform"
                                style={{ background: 'rgba(255,255,255,0.06)' }}
                              />
                            </a>
                          ) : (
                            <button
                              onClick={() => generateOne(tag)}
                              disabled={isGen}
                              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium transition-all hover:bg-white/10 disabled:opacity-40 mx-auto"
                              style={{ border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(245,158,11,0.9)' }}
                            >
                              {isGen ? <Loader className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                              {isGen ? '…' : 'Gen'}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {tagsWithBbox.length === 0 && discoveries.length === 0 && (
            <p className="text-white/20 text-sm py-4">
              No illustration tags with bbox — regenerate illustration tags first.
            </p>
          )}
        </>
      )}
    </Section>
  );
}

// ── Main ───────────────────────────────────────────────────────────────
export function PostcardDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [postcard, setPostcard] = useState<PostcardDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [regenLoading, setRegenLoading] = useState<Record<string, boolean>>({});

  const handleRegenerate = async (target: 'detailed' | 'illustration') => {
    if (!postcard) return;
    setRegenLoading((prev) => ({ ...prev, [target]: true }));
    try {
      const { error: fnError } = await supabase.functions.invoke(
        'postalpeek-regenerate-tags',
        { body: { postcard_id: postcard.id, targets: [target] } },
      );
      if (fnError) throw fnError;

      // Re-fetch the postcard to get updated data
      const { data: refreshed, error: refreshErr } = await supabase
        .from('postalpeek_postcards')
        .select(`
          id, created_at, city, country, location_name, lat, lng,
          illustration_url, original_image_url,
          category, description,
          streetview_pov, generation_metadata,
          owner_id,
          scene_type, time_of_day, weather, human_activity,
          detailed_tags, illustration_tags,
          aesthetic_vibes, architecture_style, color_palette,
          video_generation_status, imagine_task_id, should_animate, sam2_masks, semantic_layers
        `)
        .eq('id', postcard.id)
        .single();

      if (!refreshErr && refreshed) {
        setPostcard(refreshed as PostcardDetail);
      }
    } catch (err: unknown) {
      console.error(`[Regen] ${target} failed:`, err);
      const msg = err instanceof Error ? err.message : String(err);
      alert(`Regeneration failed: ${msg}`);
    } finally {
      setRegenLoading((prev) => ({ ...prev, [target]: false }));
    }
  };

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

    const load = async () => {
      setLoading(true);
      const query = supabase
        .from('postalpeek_postcards')
        .select(`
          id, created_at, city, country, location_name, lat, lng,
          illustration_url, original_image_url,
          category, description,
          streetview_pov, generation_metadata,
          owner_id,
          scene_type, time_of_day, weather, human_activity,
          detailed_tags, illustration_tags,
          aesthetic_vibes, architecture_style, color_palette,
          video_generation_status, imagine_task_id, should_animate, sam2_masks, semantic_layers
        `);

      const { data, error: err } = await (isUuid
        ? query.eq('id', id)
        : query.eq('short_id', id)
      ).single();

      if (cancelled) return;
      if (err || !data) {
        setError(err?.message || 'Postcard not found');
      } else {
        setPostcard(data as PostcardDetail);
      }
      setLoading(false);
    };

    void load();
    return () => { cancelled = true; };
  }, [id]);

  const strategy = postcard?.generation_metadata?.strategy as string | null;

  return (
    <div
      className="h-screen w-full flex flex-col overflow-y-auto"
      style={{ background: '#0a0a12', color: 'white', fontFamily: 'Inter, sans-serif' }}
    >
      {/* Header */}
      <header
        className="flex items-center gap-3 px-5 py-4 border-b sticky top-0 z-10"
        style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(10,10,18,0.95)', backdropFilter: 'blur(12px)' }}
      >
        <button
          onClick={() => window.history.length > 1 ? navigate(-1) : navigate('/admin')}
          className="flex items-center gap-2 text-white/50 hover:text-white transition-colors text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        {strategy && (
          <span className="text-white/25 text-xs font-mono ml-2">{strategy}</span>
        )}
        <div className="ml-auto flex items-center gap-2">
          {postcard && (
            <a
              href={`/${encodeUuidToHash(postcard.id)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-indigo-300 hover:bg-indigo-500/15 transition-colors border border-indigo-500/20"
              title="View in feed"
            >
              <ExternalLink className="w-3 h-3" />
              Feed
            </a>
          )}
          <span className="text-white/15 text-xs font-mono truncate max-w-[200px]">{id}</span>
          <button
            onClick={() => copyToClipboard(id ?? '')}
            className="p-1 rounded hover:bg-white/10 transition-colors"
            title="Copy ID"
          >
            <Copy className="w-3 h-3 text-white/30" />
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 p-6 sm:p-8">
        {loading && (
          <div className="flex items-center gap-3 text-white/40 mt-20">
            <div className="w-5 h-5 rounded-full border-2 border-white/20 border-t-white/60 animate-spin" />
            Loading postcard…
          </div>
        )}

        {error && <div className="text-red-400 mt-20 text-sm">{error}</div>}

        {postcard && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-6xl mx-auto space-y-6"
          >
            {/* Two-column layout */}
            {/* Interactive Poster — full width for maximum preview */}
            <Section icon={<Sparkles className="w-3.5 h-3.5" />} title="">
              <InteractiveIllustrationPanel postcard={postcard} />
            </Section>

            {/* Two-column layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

              {/* LEFT: Original image — sticky */}
              <div className="space-y-6 lg:sticky lg:top-24 lg:self-start">
                <Section icon={<ImageIcon className="w-3.5 h-3.5" />} title="Original">
                  <ImgPanel url={postcard.original_image_url} label="Street View" />
                </Section>
              </div>

              {/* RIGHT: All data */}
              <div className="lg:col-span-2 space-y-5">

                {/* Geo */}
                <Section icon={<MapPin className="w-3.5 h-3.5" />} title="Geography">
                  <Row label="City" value={postcard.city} />
                  <Row label="Country" value={postcard.country} />
                  <Row label="Location name" value={postcard.location_name} />
                  <Row
                    label="Coordinates"
                    value={
                      postcard.lat != null && postcard.lng != null ? (
                        <a
                          href={`https://maps.google.com/?q=${postcard.lat},${postcard.lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-indigo-300 hover:text-indigo-200 font-mono text-xs"
                        >
                          {postcard.lat.toFixed(6)}, {postcard.lng.toFixed(6)}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : null
                    }
                  />
                </Section>

                {/* Content */}
                <Section icon={<Globe className="w-3.5 h-3.5" />} title="Content">
                  <Row label="Category" value={bilingualText(postcard.category)} />
                  <Row label="Description" value={bilingualText(postcard.description)} />
                </Section>

                {/* Scene Metadata */}
                <Section icon={<Eye className="w-3.5 h-3.5" />} title="Scene Analysis">
                  <Row label="Scene type" value={postcard.scene_type} />
                  <Row label="Time of day" value={postcard.time_of_day} />
                  <Row label="Weather" value={postcard.weather} />
                  <Row label="Human activity" value={postcard.human_activity} />
                </Section>

                {/* Vibe Metadata */}
                <Section icon={<Palette className="w-3.5 h-3.5" />} title="Vibes & Style">
                  <Row
                    label="Aesthetic vibes"
                    value={
                      postcard.aesthetic_vibes?.length ? (
                        <div className="flex flex-wrap gap-1.5">
                          {postcard.aesthetic_vibes.map((v) => <TagPill key={v} label={v} />)}
                        </div>
                      ) : null
                    }
                  />
                  <Row label="Architecture style" value={postcard.architecture_style} />
                  <Row label="Color palette" value={postcard.color_palette} />
                </Section>

                {/* Generation metadata */}
                <Section icon={<Cpu className="w-3.5 h-3.5" />} title="Generation">
                  <Row label="Strategy" value={strategy} />
                  <Row label="Owner" value={postcard.owner_id} mono />
                  <Row label="Created" value={
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3 h-3 text-white/30" />
                      {new Date(postcard.created_at).toLocaleString()}
                      <span className="text-white/30 text-xs">({timeAgo(postcard.created_at)})</span>
                    </span>
                  } />
                  {postcard.generation_metadata && (
                    <div className="pt-1">
                      <p className="text-white/25 text-xs mb-1.5">Full metadata JSON</p>
                      <JsonBlock data={postcard.generation_metadata} />
                    </div>
                  )}
                </Section>

                {/* StreetView POV */}
                {postcard.streetview_pov && (
                  <Section icon={<Wind className="w-3.5 h-3.5" />} title="StreetView POV">
                    <JsonBlock data={postcard.streetview_pov} />
                  </Section>
                )}

                {/* Video */}
                <Section icon={<Film className="w-3.5 h-3.5" />} title="Video">
                  <Row label="Status" value={postcard.video_generation_status} />
                  <Row label="Should animate" value={postcard.should_animate != null ? String(postcard.should_animate) : null} />
                  <Row label="Imagine task ID" value={postcard.imagine_task_id} mono />
                </Section>

                {/* Detailed tags */}
                <Section icon={<Tag className="w-3.5 h-3.5" />} title="Detailed Tags (AI Analysis)">
                  <div className="flex justify-end -mt-1 mb-2">
                    <button
                      onClick={() => handleRegenerate('detailed')}
                      disabled={regenLoading.detailed}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:bg-white/10 disabled:opacity-40"
                      style={{ border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(165,180,252,0.9)' }}
                    >
                      <RefreshCw className={`w-3 h-3 ${regenLoading.detailed ? 'animate-spin' : ''}`} />
                      {regenLoading.detailed ? 'Regenerating…' : 'Regenerate'}
                    </button>
                  </div>
                  {Array.isArray(postcard.detailed_tags) && postcard.detailed_tags.length > 0 ? (
                    <DetailedTagsTable tags={postcard.detailed_tags} />
                  ) : (
                    <p className="text-white/20 text-sm">No detailed tags</p>
                  )}
                </Section>

                {/* Illustration tags */}
                <Section icon={<Hash className="w-3.5 h-3.5" />} title="Illustration Tags">
                  <div className="flex justify-end -mt-1 mb-2">
                    <button
                      onClick={() => handleRegenerate('illustration')}
                      disabled={regenLoading.illustration}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:bg-white/10 disabled:opacity-40"
                      style={{ border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(165,180,252,0.9)' }}
                    >
                      <RefreshCw className={`w-3 h-3 ${regenLoading.illustration ? 'animate-spin' : ''}`} />
                      {regenLoading.illustration ? 'Regenerating…' : 'Regenerate'}
                    </button>
                  </div>
                  {Array.isArray(postcard.illustration_tags) && postcard.illustration_tags.length > 0 ? (
                    typeof postcard.illustration_tags[0] === 'object' && postcard.illustration_tags[0] !== null ? (
                      <DetailedTagsTable tags={postcard.illustration_tags} />
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {(postcard.illustration_tags as Array<{ label?: string } | string>).map((tag, i) => (
                          <TagPill
                            key={i}
                            label={typeof tag === 'string' ? tag : tag?.label ?? JSON.stringify(tag)}
                          />
                        ))}
                      </div>
                    )
                  ) : (
                    <p className="text-white/20 text-sm">No illustration tags</p>
                  )}
                </Section>

                {/* Discoveries / Objects */}
                <DiscoveriesSection postcard={postcard} />

                

              </div>
            </div>
          </motion.div>
        )}
      </main>
    </div>
  );
}

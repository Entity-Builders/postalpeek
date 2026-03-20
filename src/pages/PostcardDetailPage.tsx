/**
 * PostcardDetailPage.tsx — /:id
 *
 * Full admin detail view for a single postcard.
 * Shows ALL available data from postalpeek_postcards.
 */

import React, { useEffect, useState } from 'react';
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
} from 'lucide-react';
import { supabase } from '@eb-packages/logic/src/supabase';
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
  type Tag = { label?: string | { en?: string; es?: string }; spanish_label?: string | { en?: string; es?: string }; type?: string; weight?: number; confidence?: number; count?: number; position?: string };
  const typed = tags as Tag[];
  if (!typed.length) return <p className="text-white/20 text-xs">Empty</p>;
  return (
    <div className="overflow-x-auto">
      <table className="text-xs w-full border-collapse">
        <thead>
          <tr className="text-white/25 text-left">
            {['Label', 'ES', 'Type', 'Weight', 'Confidence', 'Count', 'Position'].map((h) => (
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
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────
export function PostcardDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [postcard, setPostcard] = useState<PostcardDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
          video_generation_status, imagine_task_id, should_animate
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
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

              {/* LEFT: Images */}
              <div className="space-y-6">
                <Section icon={<ImageIcon className="w-3.5 h-3.5" />} title="Images">
                  <ImgPanel url={postcard.illustration_url} label="Illustration" />
                  <ImgPanel url={postcard.original_image_url} label="Original (Street View)" />
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
                  {Array.isArray(postcard.detailed_tags) && postcard.detailed_tags.length > 0 ? (
                    <DetailedTagsTable tags={postcard.detailed_tags} />
                  ) : (
                    <p className="text-white/20 text-sm">No detailed tags</p>
                  )}
                </Section>

                {/* Illustration tags */}
                <Section icon={<Hash className="w-3.5 h-3.5" />} title="Illustration Tags">
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

              </div>
            </div>
          </motion.div>
        )}
      </main>
    </div>
  );
}

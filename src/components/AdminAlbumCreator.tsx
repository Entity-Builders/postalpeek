/**
 * AdminAlbumCreator.tsx — Full-featured album CRUD inside admin dashboard
 *
 * Features:
 * - Create albums with all DB fields exposed
 * - Postcard picker with search
 * - Slot builder (add, remove, reorder, edit labels)
 * - Edit existing albums
 * - Delete albums
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Trash2,
  GripVertical,
  Search,
  X,
  ChevronDown,
  ChevronUp,
  ArrowUp,
  ArrowDown,
  Save,
  Loader,
  CheckCircle,
  Edit3,
  Image,
  Library,
  Eye,
} from 'lucide-react';
import { supabase } from '@eb-packages/logic/src/supabase';
import { encodeUuidToHash } from '@eb-packages/logic/src/hash';
import { useSignedImage } from '../utils/useSignedImage';
import { WIDTHS, preSignUrls } from '../utils/imageUtils';

// ── Types ──────────────────────────────────────────────────────────────

type ActionStatus = 'idle' | 'loading' | 'success' | 'error';
type Difficulty = 'easy' | 'medium' | 'hard' | 'epic';

interface AlbumFormData {
  title: string;
  description: string;
  category: string;
  country: string;
  city: string;
  difficulty: Difficulty;
  reward_claims: number;
  cover_image_url: string;
  is_active: boolean;
}

interface SlotData {
  id?: string; // existing slot ID (for editing)
  postcard_id: string;
  slot_label: string;
  slot_order: number;
  illustration_url: string | null;
  city: string;
  country: string;
}

interface ExistingAlbum {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  country: string | null;
  city: string | null;
  difficulty: string;
  reward_claims: number;
  cover_image_url: string | null;
  is_active: boolean;
  source: string | null;
  created_at: string;
  slot_count: number;
}

interface PickerPostcard {
  id: string;
  city: string;
  country: string;
  illustration_url: string | null;
  category: string | null;
}

// ── Constants ──────────────────────────────────────────────────────────

const DIFFICULTIES: { value: Difficulty; label: string; icon: string }[] = [
  { value: 'easy', label: 'Easy', icon: '🌿' },
  { value: 'medium', label: 'Medium', icon: '⚡' },
  { value: 'hard', label: 'Hard', icon: '🔥' },
  { value: 'epic', label: 'Epic', icon: '💎' },
];

const EMPTY_FORM: AlbumFormData = {
  title: '',
  description: '',
  category: 'country_collection',
  country: '',
  city: '',
  difficulty: 'easy',
  reward_claims: 5,
  cover_image_url: '',
  is_active: true,
};

// ── Shared UI Primitives ───────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return <label className="text-white/50 text-xs block mb-1">{children}</label>;
}

function TextInput({
  value,
  onChange,
  placeholder,
  type = 'text',
  mono = false,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  mono?: boolean;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full px-3 py-2 rounded-xl text-sm ${mono ? 'font-mono' : ''}`}
      style={{
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.1)',
        color: 'white',
        outline: 'none',
      }}
    />
  );
}

function TextArea({
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full px-3 py-2 rounded-xl text-sm resize-none"
      style={{
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.1)',
        color: 'white',
        outline: 'none',
      }}
    />
  );
}

function StatusMsg({ status, message }: { status: ActionStatus; message: string }) {
  if (status === 'idle' || !message) return null;
  const colors = {
    loading: 'bg-indigo-950/60 text-indigo-300 border-indigo-700/30',
    success: 'bg-emerald-950/60 text-emerald-300 border-emerald-700/30',
    error: 'bg-red-950/60 text-red-300 border-red-700/30',
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

// ── Small Thumbnail ────────────────────────────────────────────────────

function Thumbnail({ url, alt, size = 'w-12 h-12' }: { url: string | null; alt: string; size?: string }) {
  const signedUrl = useSignedImage(url, { width: WIDTHS.thumb });
  return (
    <div className={`${size} rounded-lg overflow-hidden bg-white/5 shrink-0`}>
      {signedUrl ? (
        <img src={signedUrl} alt={alt} className="w-full h-full object-cover" loading="lazy" />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-white/10">
          <Image className="w-4 h-4" />
        </div>
      )}
    </div>
  );
}

// ── Postcard Picker Modal ──────────────────────────────────────────────

function PostcardPicker({
  isOpen,
  onClose,
  onSelect,
  excludeIds,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (pc: PickerPostcard) => void;
  excludeIds: Set<string>;
}) {
  const [postcards, setPostcards] = useState<PickerPostcard[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [hasMore, setHasMore] = useState(true);
  const offsetRef = useRef(0);

  const fetchPostcards = useCallback(
    async (reset = false) => {
      setLoading(true);
      const offset = reset ? 0 : offsetRef.current;
      try {
        let query = supabase
          .from('postalpeek_postcards')
          .select('id, city, country, illustration_url, category')
          .not('illustration_url', 'is', null)
          .order('created_at', { ascending: false })
          .range(offset, offset + 29);

        if (search.trim()) {
          query = query.or(
            `city.ilike.%${search.trim()}%,country.ilike.%${search.trim()}%`,
          );
        }

        const { data, error } = await query;
        if (error) throw error;

        const mapped: PickerPostcard[] = (data || []).map((r) => ({
          id: r.id as string,
          city: (r.city as string) || '—',
          country: (r.country as string) || '',
          illustration_url: r.illustration_url as string | null,
          category: r.category as string | null,
        }));

        // Pre-sign URLs
        preSignUrls(
          mapped.map((p) => p.illustration_url).filter(Boolean) as string[],
        );

        if (reset) {
          setPostcards(mapped);
          offsetRef.current = 30;
        } else {
          setPostcards((prev) => [...prev, ...mapped]);
          offsetRef.current = offset + 30;
        }
        setHasMore(mapped.length === 30);
      } catch (err) {
        console.error('[PostcardPicker]', err);
      } finally {
        setLoading(false);
      }
    },
    [search],
  );

  useEffect(() => {
    if (isOpen) {
      fetchPostcards(true);
    }
  }, [isOpen, search]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="w-[90vw] max-w-3xl max-h-[80vh] rounded-2xl overflow-hidden flex flex-col"
        style={{ background: '#0f0f1a', border: '1px solid rgba(255,255,255,0.1)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="px-5 py-4 border-b flex items-center gap-3"
          style={{ borderColor: 'rgba(255,255,255,0.06)' }}
        >
          <Search className="w-4 h-4 text-white/30" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by city or country…"
            autoFocus
            className="flex-1 bg-transparent text-white text-sm outline-none placeholder-white/25"
          />
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-lg transition-colors">
            <X className="w-4 h-4 text-white/40" />
          </button>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2">
            {postcards.map((pc) => {
              const isExcluded = excludeIds.has(pc.id);
              return (
                <button
                  key={pc.id}
                  disabled={isExcluded}
                  onClick={() => onSelect(pc)}
                  className={`rounded-xl overflow-hidden text-left transition-all ${
                    isExcluded
                      ? 'opacity-30 cursor-not-allowed'
                      : 'hover:ring-1 hover:ring-indigo-400/40 hover:scale-[1.03] cursor-pointer'
                  }`}
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: `1px solid ${isExcluded ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.06)'}`,
                  }}
                >
                  <div className="aspect-[3/4] w-full bg-white/5 overflow-hidden relative">
                    <PickerThumb url={pc.illustration_url} alt={pc.city} />
                    {isExcluded && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                        <CheckCircle className="w-5 h-5 text-emerald-400" />
                      </div>
                    )}
                  </div>
                  <div className="p-1.5">
                    <p className="text-white/70 text-[10px] font-medium truncate">{pc.city}</p>
                    <p className="text-white/30 text-[8px] truncate">{pc.country}</p>
                  </div>
                </button>
              );
            })}
          </div>

          {loading && (
            <div className="flex items-center justify-center py-4 text-white/30 text-sm">
              <Loader className="w-4 h-4 animate-spin mr-2" />
              Loading…
            </div>
          )}

          {!loading && hasMore && postcards.length > 0 && (
            <button
              onClick={() => fetchPostcards(false)}
              className="w-full mt-3 py-2 rounded-xl text-sm text-white/40 hover:text-white/70 hover:bg-white/5 transition-all flex items-center justify-center gap-2"
              style={{ border: '1px solid rgba(255,255,255,0.06)' }}
            >
              <ChevronDown className="w-4 h-4" />
              Load more
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

function PickerThumb({ url, alt }: { url: string | null; alt: string }) {
  const signedUrl = useSignedImage(url, { width: WIDTHS.thumb });
  if (!signedUrl)
    return (
      <div className="w-full h-full flex items-center justify-center text-white/10">
        <Image className="w-5 h-5" />
      </div>
    );
  return <img src={signedUrl} alt={alt} className="w-full h-full object-cover" loading="lazy" />;
}



// ── Slot Row ───────────────────────────────────────────────────────────

function SlotRow({
  slot,
  index,
  total,
  onRemove,
  onMoveUp,
  onMoveDown,
  onLabelChange,
}: {
  slot: SlotData;
  index: number;
  total: number;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onLabelChange: (label: string) => void;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 10 }}
      className="flex items-center gap-2 p-2 rounded-xl border group"
      style={{
        background: 'rgba(255,255,255,0.03)',
        borderColor: 'rgba(255,255,255,0.06)',
      }}
    >
      {/* Order controls */}
      <div className="flex flex-col gap-0.5 shrink-0">
        <button
          onClick={onMoveUp}
          disabled={index === 0}
          className="p-0.5 rounded hover:bg-white/10 transition-colors disabled:opacity-20"
        >
          <ArrowUp className="w-3 h-3 text-white/40" />
        </button>
        <button
          onClick={onMoveDown}
          disabled={index === total - 1}
          className="p-0.5 rounded hover:bg-white/10 transition-colors disabled:opacity-20"
        >
          <ArrowDown className="w-3 h-3 text-white/40" />
        </button>
      </div>

      {/* Slot number */}
      <span className="text-white/20 text-xs font-mono w-5 text-center shrink-0">
        #{index + 1}
      </span>

      {/* Thumbnail */}
      <Thumbnail url={slot.illustration_url} alt={slot.slot_label} size="w-10 h-10" />

      {/* Info & editable label */}
      <div className="flex-1 min-w-0">
        <input
          type="text"
          value={slot.slot_label}
          onChange={(e) => onLabelChange(e.target.value)}
          className="w-full bg-transparent text-white/80 text-xs font-medium outline-none border-b border-transparent focus:border-indigo-400/50 transition-colors"
          placeholder="Slot label…"
        />
        <p className="text-white/25 text-[9px] truncate">
          {slot.city}{slot.country ? `, ${slot.country}` : ''} · {(slot.postcard_id || '').slice(0, 8)}
        </p>
      </div>

      {/* Preview link */}
      <a
        href={`/preview/${encodeUuidToHash(slot.postcard_id)}`}
        target="_blank"
        rel="noopener noreferrer"
        title="Open postcard preview"
        className="p-1.5 rounded-lg hover:bg-indigo-500/20 text-white/20 hover:text-indigo-400 transition-all opacity-0 group-hover:opacity-100"
      >
        <Eye className="w-3.5 h-3.5" />
      </a>

      {/* Remove */}
      <button
        onClick={onRemove}
        className="p-1.5 rounded-lg hover:bg-red-500/20 text-white/20 hover:text-red-400 transition-all opacity-0 group-hover:opacity-100"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </motion.div>
  );
}

// ── Existing Album Row ─────────────────────────────────────────────────

function ExistingAlbumRow({
  album,
  isSelected,
  onSelect,
}: {
  album: ExistingAlbum;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const coverUrl = useSignedImage(album.cover_image_url, { width: WIDTHS.thumb });
  const diff = DIFFICULTIES.find((d) => d.value === album.difficulty);

  return (
    <button
      onClick={onSelect}
      className={`w-full flex items-center gap-3 p-2.5 rounded-xl text-left transition-all ${
        isSelected
          ? 'ring-1 ring-indigo-400/50'
          : 'hover:bg-white/5'
      }`}
      style={{
        background: isSelected ? 'rgba(99,102,241,0.1)' : 'rgba(255,255,255,0.02)',
        border: `1px solid ${isSelected ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.04)'}`,
      }}
    >
      <div className="w-10 h-10 rounded-lg overflow-hidden bg-white/5 shrink-0">
        {coverUrl ? (
          <img src={coverUrl} alt={album.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white/10">
            <Library className="w-4 h-4" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-white/80 text-sm font-medium truncate">{album.title}</p>
          {!album.is_active && (
            <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-300 font-medium">
              Inactive
            </span>
          )}
        </div>
        <p className="text-white/30 text-[10px] truncate">
          {diff?.icon} {album.difficulty} · {album.slot_count} slots · {album.source || 'curated'}
          {album.country ? ` · ${album.country}` : ''}
        </p>
      </div>
      <Edit3 className="w-3.5 h-3.5 text-white/15 shrink-0" />
    </button>
  );
}

// ── Main Component ─────────────────────────────────────────────────────

export function AdminAlbumCreator() {
  // ── State ──
  const [form, setForm] = useState<AlbumFormData>({ ...EMPTY_FORM });
  const [slots, setSlots] = useState<SlotData[]>([]);
  const [editingAlbumId, setEditingAlbumId] = useState<string | null>(null);

  const [existingAlbums, setExistingAlbums] = useState<ExistingAlbum[]>([]);
  const [albumsLoading, setAlbumsLoading] = useState(false);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [albumListOpen, setAlbumListOpen] = useState(true);

  const [saveStatus, setSaveStatus] = useState<{ status: ActionStatus; message: string }>({
    status: 'idle',
    message: '',
  });
  const [deleteStatus, setDeleteStatus] = useState<{ status: ActionStatus; message: string }>({
    status: 'idle',
    message: '',
  });

  // ── Helpers ──
  const updateForm = useCallback(
    <K extends keyof AlbumFormData>(key: K, value: AlbumFormData[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const excludedIds = useMemo(() => new Set(slots.map((s) => s.postcard_id)), [slots]);

  // ── Fetch existing albums ──
  const fetchAlbums = useCallback(async () => {
    setAlbumsLoading(true);
    try {
      const { data, error } = await supabase
        .from('postalpeek_albums')
        .select('id, title, description, category, country, city, difficulty, reward_claims, cover_image_url, is_active, source, created_at')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get slot counts in a separate query
      const albumIds = (data || []).map((a) => a.id);
      const { data: slotCounts } = await supabase
        .from('postalpeek_album_slots')
        .select('album_id')
        .in('album_id', albumIds);

      const countMap: Record<string, number> = {};
      (slotCounts || []).forEach((s) => {
        countMap[s.album_id] = (countMap[s.album_id] || 0) + 1;
      });

      setExistingAlbums(
        (data || []).map((a) => ({
          ...a,
          slot_count: countMap[a.id] || 0,
        })) as ExistingAlbum[],
      );
    } catch (err) {
      console.error('[AdminAlbumCreator] fetchAlbums', err);
    } finally {
      setAlbumsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlbums();
  }, [fetchAlbums]);

  // ── Load album for editing ──
  const loadAlbumForEdit = useCallback(async (album: ExistingAlbum) => {
    setEditingAlbumId(album.id);
    setForm({
      title: album.title,
      description: album.description || '',
      category: album.category || '',
      country: album.country || '',
      city: album.city || '',
      difficulty: (album.difficulty as Difficulty) || 'easy',
      reward_claims: album.reward_claims,
      cover_image_url: album.cover_image_url || '',
      is_active: album.is_active,
    });

    // Load slots
    const { data: slotsData, error } = await supabase
      .from('postalpeek_album_slots')
      .select('id, postcard_id, slot_label, slot_order')
      .eq('album_id', album.id)
      .order('slot_order', { ascending: true });

    if (error || !slotsData) {
      setSlots([]);
      return;
    }

    // Fetch postcard details for each slot
    const postcardIds = slotsData.map((s) => s.postcard_id).filter(Boolean);
    const { data: postcards } = await supabase
      .from('postalpeek_postcards')
      .select('id, illustration_url, city, country')
      .in('id', postcardIds);

    const pcMap: Record<string, { illustration_url: string | null; city: string; country: string }> = {};
    (postcards || []).forEach((p) => {
      pcMap[p.id] = {
        illustration_url: p.illustration_url,
        city: (p.city as string) || '—',
        country: (p.country as string) || '',
      };
    });

    // Pre-sign illustration URLs
    preSignUrls(
      (postcards || []).map((p) => p.illustration_url).filter(Boolean) as string[],
    );

    setSlots(
      slotsData.map((s) => ({
        id: s.id,
        postcard_id: s.postcard_id,
        slot_label: s.slot_label,
        slot_order: s.slot_order,
        illustration_url: pcMap[s.postcard_id]?.illustration_url || null,
        city: pcMap[s.postcard_id]?.city || '—',
        country: pcMap[s.postcard_id]?.country || '',
      })),
    );
  }, []);

  // ── Reset form ──
  const resetForm = useCallback(() => {
    setForm({ ...EMPTY_FORM });
    setSlots([]);
    setEditingAlbumId(null);
    setSaveStatus({ status: 'idle', message: '' });
    setDeleteStatus({ status: 'idle', message: '' });
  }, []);

  // ── Add postcard as slot ──
  const addSlot = useCallback((pc: PickerPostcard) => {
    setSlots((prev) => [
      ...prev,
      {
        postcard_id: pc.id,
        slot_label: pc.city || pc.country || 'Untitled',
        slot_order: prev.length + 1,
        illustration_url: pc.illustration_url,
        city: pc.city,
        country: pc.country,
      },
    ]);
  }, []);

  // ── Slot operations ──
  const removeSlot = useCallback((index: number) => {
    setSlots((prev) => prev.filter((_, i) => i !== index).map((s, i) => ({ ...s, slot_order: i + 1 })));
  }, []);

  const moveSlot = useCallback((from: number, to: number) => {
    setSlots((prev) => {
      const arr = [...prev];
      const [moved] = arr.splice(from, 1);
      arr.splice(to, 0, moved);
      return arr.map((s, i) => ({ ...s, slot_order: i + 1 }));
    });
  }, []);

  const updateSlotLabel = useCallback((index: number, label: string) => {
    setSlots((prev) => prev.map((s, i) => (i === index ? { ...s, slot_label: label } : s)));
  }, []);

  // ── Save album ──
  const saveAlbum = useCallback(async () => {
    if (!form.title.trim()) {
      setSaveStatus({ status: 'error', message: 'Title is required' });
      return;
    }

    setSaveStatus({ status: 'loading', message: editingAlbumId ? 'Updating album…' : 'Creating album…' });

    try {
      // Determine cover: manual override or first slot's illustration
      const coverUrl =
        form.cover_image_url.trim() ||
        (slots.length > 0 ? slots[0].illustration_url : null);

      const albumPayload = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        category: form.category.trim() || null,
        country: form.country.trim() || null,
        city: form.city.trim() || null,
        difficulty: form.difficulty,
        reward_claims: form.reward_claims,
        cover_image_url: coverUrl,
        is_active: form.is_active,
        source: 'curated',
      };

      let albumId: string;

      if (editingAlbumId) {
        // Update existing album
        const { error } = await supabase
          .from('postalpeek_albums')
          .update(albumPayload)
          .eq('id', editingAlbumId);
        if (error) throw error;
        albumId = editingAlbumId;

        // Delete existing slots and re-insert
        const { error: delError } = await supabase
          .from('postalpeek_album_slots')
          .delete()
          .eq('album_id', editingAlbumId);
        if (delError) throw delError;
      } else {
        // Insert new album
        const { data, error } = await supabase
          .from('postalpeek_albums')
          .insert(albumPayload)
          .select('id')
          .single();
        if (error) throw error;
        albumId = data.id;
      }

      // Insert slots
      if (slots.length > 0) {
        const slotPayloads = slots.map((s, i) => ({
          album_id: albumId,
          postcard_id: s.postcard_id,
          slot_label: s.slot_label,
          slot_order: i + 1,
        }));

        const { error: slotError } = await supabase
          .from('postalpeek_album_slots')
          .insert(slotPayloads);
        if (slotError) throw slotError;
      }

      setSaveStatus({
        status: 'success',
        message: `✅ Album "${form.title}" ${editingAlbumId ? 'updated' : 'created'} with ${slots.length} slots`,
      });

      // Refresh album list
      fetchAlbums();

      // If new album, switch to edit mode so user can continue working
      if (!editingAlbumId) {
        setEditingAlbumId(albumId);
      }
    } catch (err: unknown) {
      setSaveStatus({
        status: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }, [form, slots, editingAlbumId, fetchAlbums]);

  // ── Delete album ──
  const deleteAlbum = useCallback(async () => {
    if (!editingAlbumId) return;
    if (!confirm(`Delete album "${form.title}"? This will also delete all slots. This action is permanent.`))
      return;

    setDeleteStatus({ status: 'loading', message: 'Deleting…' });
    try {
      const { error } = await supabase
        .from('postalpeek_albums')
        .delete()
        .eq('id', editingAlbumId);
      if (error) throw error;

      setDeleteStatus({ status: 'success', message: '✅ Album deleted' });
      resetForm();
      fetchAlbums();
    } catch (err: unknown) {
      setDeleteStatus({
        status: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }, [editingAlbumId, form.title, resetForm, fetchAlbums]);

  // ── Render ──
  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">
          {editingAlbumId ? '✏️ Edit Album' : '📚 Create Album'}
        </h2>
        {editingAlbumId && (
          <div className="flex items-center gap-2">
            <a
              href={`/album/${editingAlbumId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-indigo-300 hover:bg-indigo-500/10 transition-colors"
              style={{ border: '1px solid rgba(99,102,241,0.2)' }}
            >
              <Eye className="w-3 h-3" />
              Preview
            </a>
            <button
              onClick={resetForm}
              className="px-3 py-1.5 rounded-lg text-xs text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors"
              style={{ border: '1px solid rgba(255,255,255,0.06)' }}
            >
              + New Album
            </button>
          </div>
        )}
      </div>

      <div className="flex gap-6">
        {/* ── LEFT: Existing Albums List ── */}
        <div className="w-64 shrink-0 space-y-2">
          <button
            onClick={() => setAlbumListOpen(!albumListOpen)}
            className="flex items-center justify-between w-full text-white/50 text-[10px] uppercase tracking-widest font-semibold"
          >
            <span>Existing Albums ({existingAlbums.length})</span>
            {albumListOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>

          <AnimatePresence>
            {albumListOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="space-y-1 max-h-[60vh] overflow-y-auto pr-1">
                  {albumsLoading ? (
                    <div className="flex items-center justify-center py-6 text-white/30 text-sm">
                      <Loader className="w-4 h-4 animate-spin mr-2" />
                      Loading…
                    </div>
                  ) : existingAlbums.length === 0 ? (
                    <p className="text-white/20 text-xs text-center py-4">No albums yet</p>
                  ) : (
                    existingAlbums.map((album) => (
                      <ExistingAlbumRow
                        key={album.id}
                        album={album}
                        isSelected={editingAlbumId === album.id}
                        onSelect={() => loadAlbumForEdit(album)}
                      />
                    ))
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── RIGHT: Form ── */}
        <div className="flex-1 space-y-5">
          {/* Basic info */}
          <div
            className="rounded-xl p-4 space-y-3 border"
            style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.06)' }}
          >
            <p className="text-white/40 text-[10px] uppercase tracking-widest font-semibold">
              📝 Basic Info
            </p>

            <div>
              <Label>Title *</Label>
              <TextInput
                value={form.title}
                onChange={(v) => updateForm('title', v)}
                placeholder="e.g. Architecture of Buenos Aires"
              />
            </div>

            <div>
              <Label>Description</Label>
              <TextArea
                value={form.description}
                onChange={(v) => updateForm('description', v)}
                placeholder="A brief description of this album…"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Category</Label>
                <TextInput
                  value={form.category}
                  onChange={(v) => updateForm('category', v)}
                  placeholder="e.g. country_collection"
                />
              </div>
              <div>
                <Label>Difficulty</Label>
                <select
                  value={form.difficulty}
                  onChange={(e) => updateForm('difficulty', e.target.value as Difficulty)}
                  className="w-full px-3 py-2 rounded-xl text-sm"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: 'white',
                    outline: 'none',
                  }}
                >
                  {DIFFICULTIES.map((d) => (
                    <option key={d.value} value={d.value} style={{ background: '#1a1a2e', color: 'white' }}>
                      {d.icon} {d.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Country</Label>
                <TextInput
                  value={form.country}
                  onChange={(v) => updateForm('country', v)}
                  placeholder="e.g. Argentina"
                />
              </div>
              <div>
                <Label>City</Label>
                <TextInput
                  value={form.city}
                  onChange={(v) => updateForm('city', v)}
                  placeholder="e.g. Buenos Aires"
                />
              </div>
              <div>
                <Label>Reward Claims</Label>
                <TextInput
                  value={String(form.reward_claims)}
                  onChange={(v) => updateForm('reward_claims', parseInt(v) || 0)}
                  type="number"
                  mono
                />
              </div>
            </div>

            {/* Active toggle */}
            <div className="flex items-center gap-3 pt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => updateForm('is_active', e.target.checked)}
                  style={{ accentColor: 'rgba(99,102,241,1)' }}
                />
                <span className="text-white/60 text-xs">Active (visible to users)</span>
              </label>
            </div>

            {/* Cover URL override */}
            <div>
              <Label>Cover Image URL (optional — auto-set from first slot)</Label>
              <TextInput
                value={form.cover_image_url}
                onChange={(v) => updateForm('cover_image_url', v)}
                placeholder="Leave empty to use first slot's illustration"
                mono
              />
            </div>
          </div>


          {/* Slots */}
          <div
            className="rounded-xl p-4 border space-y-3"
            style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.06)' }}
          >
            <div className="flex items-center justify-between">
              <p className="text-white/40 text-[10px] uppercase tracking-widest font-semibold">
                🃏 Slots ({slots.length})
              </p>
              <button
                onClick={() => setPickerOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-indigo-300 hover:bg-indigo-500/15 transition-all"
                style={{ border: '1px solid rgba(99,102,241,0.3)' }}
              >
                <Plus className="w-3.5 h-3.5" />
                Add Postcard
              </button>
            </div>

            {slots.length === 0 ? (
              <div className="py-8 text-center">
                <GripVertical className="w-8 h-8 text-white/10 mx-auto mb-2" />
                <p className="text-white/25 text-xs">No slots yet — click "Add Postcard" to add postcards</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                <AnimatePresence>
                  {slots.map((slot, i) => (
                    <SlotRow
                      key={`${slot.postcard_id}-${i}`}
                      slot={slot}
                      index={i}
                      total={slots.length}
                      onRemove={() => removeSlot(i)}
                      onMoveUp={() => moveSlot(i, i - 1)}
                      onMoveDown={() => moveSlot(i, i + 1)}
                      onLabelChange={(label) => updateSlotLabel(i, label)}
                    />
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={saveAlbum}
              disabled={saveStatus.status === 'loading' || !form.title.trim()}
              className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-medium text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110"
              style={{
                background: 'linear-gradient(135deg, rgba(99,102,241,0.6), rgba(139,92,246,0.6))',
                border: '1px solid rgba(255,255,255,0.05)',
              }}
            >
              {saveStatus.status === 'loading' ? (
                <Loader className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {editingAlbumId ? 'Update Album' : 'Create Album'}
            </button>

            {editingAlbumId && (
              <button
                onClick={deleteAlbum}
                disabled={deleteStatus.status === 'loading'}
                className="px-5 py-3 rounded-xl text-sm font-medium text-red-300 hover:bg-red-500/15 transition-all disabled:opacity-40"
                style={{ border: '1px solid rgba(239,68,68,0.3)' }}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>

          <StatusMsg status={saveStatus.status} message={saveStatus.message} />
          <StatusMsg status={deleteStatus.status} message={deleteStatus.message} />
        </div>
      </div>

      {/* Postcard Picker Modal */}
      <AnimatePresence>
        <PostcardPicker
          isOpen={pickerOpen}
          onClose={() => setPickerOpen(false)}
          onSelect={(pc) => {
            addSlot(pc);
            // Don't close the picker — let user add multiple postcards quickly
          }}
          excludeIds={excludedIds}
        />
      </AnimatePresence>
    </div>
  );
}

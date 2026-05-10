/**
 * AdminPostcards.tsx — /admin/postcards
 * Postcard actions: regenerate illustration, delete, object analysis, segmentation.
 */

import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Loader, Scissors } from 'lucide-react';
import { supabase } from '@eb-packages/logic/src/supabase';
import { ActionBtn, StatusMsg, SectionTitle } from '../../components/admin/AdminUI';
import type { ActionStatus } from '../../components/admin/AdminUI';

// ── Types ──────────────────────────────────────────────────────────────

interface PipelineTag { label: string; type: string; box_2d: number[]; }
interface SegResult   { label: string; mask_url: string; status: 'pending' | 'loading' | 'done' | 'error'; }
interface DinoBox     { label: string; box: number[]; bbox?: number[]; confidence: number; }
interface GsamResult  { annotated_url: string | null; mask_url: string | null; inverted_mask_url: string | null; outputs: string[] }

const STICKER_LABELS = 'person, sign, car, tree, bench, lamppost, storefront, animal, statue, awning, door, chair, table, motorcycle, bicycle, plant, window, umbrella';

export function AdminPostcards() {
  const edgeBase = import.meta.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321';
  const edgeKey  = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WO7o6oSc4wYjSnO28-VRLNxMEnOj9aQREp8o';

  // Core id + status
  const [postcardId,     setPostcardId]     = useState('');
  const [postcardStatus, setPostcardStatus] = useState<{ status: ActionStatus; message: string }>({ status: 'idle', message: '' });

  // Pipeline state
  const [pipelinePhotoUrl,        setPipelinePhotoUrl]        = useState<string | null>(null);
  const [pipelineIllustrationUrl, setPipelineIllustrationUrl] = useState<string | null>(null);
  const [detectedTags,            setDetectedTags]            = useState<PipelineTag[]>([]);
  const [detectStatus,            setDetectStatus]            = useState<{ status: ActionStatus; message: string }>({ status: 'idle', message: '' });
  const [dinoBoxes,               setDinoBoxes]               = useState<DinoBox[]>([]);
  void setDinoBoxes; // Setter reserved for future Dino integration
  const [segments,                setSegments]                = useState<SegResult[]>([]);
  const [gsamStatus,              setGsamStatus]              = useState<{ status: ActionStatus; message: string }>({ status: 'idle', message: '' });
  const [gsamResult,              setGsamResult]              = useState<GsamResult | null>(null);
  const [extractStatus,           setExtractStatus]           = useState<{ status: ActionStatus; message: string }>({ status: 'idle', message: '' });

  // ── Helpers ──
  const callEdgeFn = useCallback(async (fn: string, body: Record<string, unknown>) => {
    const r = await fetch(`${edgeBase}/functions/v1/${fn}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${edgeKey}` },
      body: JSON.stringify(body),
    });
    const d = await r.json();
    if (!r.ok || d?.error) throw new Error(d?.error || `Failed (${r.status})`);
    return d;
  }, [edgeBase, edgeKey]);

  // ── Actions ──────────────────────────────────────────────────────────

  const regenerateIllustration = useCallback(async () => {
    if (!postcardId.trim()) return;
    setPostcardStatus({ status: 'loading', message: 'Regenerating illustration…' });
    try {
      const { data, error } = await supabase.functions.invoke('postalpeek-regenerate-illustration', { body: { postcard_id: postcardId.trim() } });
      if (error) throw error;
      setPostcardStatus({ status: 'success', message: data?.message || 'Illustration regenerated' });
    } catch (err: unknown) {
      setPostcardStatus({ status: 'error', message: err instanceof Error ? err.message : String(err) });
    }
  }, [postcardId]);

  const deletePostcard = useCallback(async () => {
    if (!postcardId.trim()) return;
    if (!confirm(`Delete postcard ${postcardId}? This is permanent.`)) return;
    setPostcardStatus({ status: 'loading', message: 'Deleting…' });
    try {
      const { error } = await supabase.rpc('admin_delete_postcard', { p_postcard_id: postcardId.trim() });
      if (error) throw error;
      setPostcardStatus({ status: 'success', message: 'Deleted' });
      setPostcardId('');
    } catch (err: unknown) {
      setPostcardStatus({ status: 'error', message: err instanceof Error ? err.message : String(err) });
    }
  }, [postcardId]);

  const runDetection = useCallback(async () => {
    if (!postcardId.trim()) return;
    setDetectStatus({ status: 'loading', message: 'Fetching postcard…' });
    setDetectedTags([]); setSegments([]);
    try {
      const { data: pc, error } = await supabase.from('postcards').select('original_image_url, illustration_url').eq('id', postcardId.trim()).single();
      if (error || !pc?.original_image_url) throw new Error('Postcard not found');
      setPipelinePhotoUrl(pc.original_image_url);
      if (pc.illustration_url) setPipelineIllustrationUrl(pc.illustration_url);
      setDetectStatus({ status: 'loading', message: 'Calling Gemini on real photo…' });
      const data = await callEdgeFn('postalpeek-detect-objects', { image_url: pc.original_image_url });
      const tags: PipelineTag[] = data.tags || [];
      setDetectedTags(tags);
      setSegments(tags.map((t: PipelineTag) => ({ label: t.label, mask_url: '', status: 'pending' as const })));
      setDetectStatus({ status: 'loading', message: `Saving ${tags.length} tags to DB…` });
      const { error: saveErr } = await supabase.from('postcards').update({ illustration_tags: tags }).eq('id', postcardId.trim());
      if (saveErr) throw new Error(`Save failed: ${saveErr.message}`);
      setDetectStatus({ status: 'success', message: `${tags.length} objects found (real photo) & saved` });
    } catch (err: unknown) {
      setDetectStatus({ status: 'error', message: err instanceof Error ? err.message : String(err) });
    }
  }, [postcardId, callEdgeFn]);

  const runAnalyzeIllustration = useCallback(async () => {
    if (!postcardId.trim()) return;
    setDetectStatus({ status: 'loading', message: 'Fetching postcard…' });
    setDetectedTags([]); setSegments([]);
    try {
      const { data: pc, error } = await supabase.from('postcards').select('illustration_url').eq('id', postcardId.trim()).single();
      if (error || !pc?.illustration_url) throw new Error('No illustration found');
      setPipelineIllustrationUrl(pc.illustration_url);
      setDetectStatus({ status: 'loading', message: 'Analyzing illustration with Gemini Pro…' });
      const { data: segData, error: segErr } = await supabase.functions.invoke('postalpeek-semantic-segment', { body: { postcard_id: postcardId.trim() } });
      if (segErr) throw segErr;
      const layers = segData?.layers || [];
      const tags: PipelineTag[] = layers.filter((t: unknown) => (t as PipelineTag).box_2d?.length === 4);
      setDetectedTags(tags);
      setSegments(tags.map((t: PipelineTag) => ({ label: t.label, mask_url: '', status: 'pending' as const })));
      setDetectStatus({ status: 'success', message: `${tags.length} objects found (illustration) & saved` });
    } catch (err: unknown) {
      setDetectStatus({ status: 'error', message: err instanceof Error ? err.message : String(err) });
    }
  }, [postcardId]);

  const runSegmentOne = useCallback(async (idx: number) => {
    const boxes  = dinoBoxes.length > 0 ? dinoBoxes : null;
    const source = boxes ? boxes[idx] : detectedTags[idx];
    if (!pipelinePhotoUrl || !source) return;
    let clickX: number, clickY: number;
    if (boxes && idx < boxes.length) {
      const coords = boxes[idx].box || boxes[idx].bbox || [0, 0, 0, 0];
      const [xMin, yMin, xMax, yMax] = coords;
      clickX = Math.round(((xMin + xMax) / 2) * 512);
      clickY = Math.round(((yMin + yMax) / 2) * 384);
    } else {
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
      const data = await callEdgeFn('postalpeek-segment', { image_url: cfUrl, click_x: clickX, click_y: clickY, label: source.label });
      setSegments(prev => prev.map((s, i) => i === idx ? { ...s, mask_url: data.mask_url, status: 'done' } : s));
    } catch {
      setSegments(prev => prev.map((s, i) => i === idx ? { ...s, status: 'error' } : s));
    }
  }, [pipelinePhotoUrl, detectedTags, dinoBoxes, callEdgeFn]);

  const runGroundedSam = useCallback(async () => {
    if (!postcardId.trim()) return;
    setGsamStatus({ status: 'loading', message: 'Fetching postcard…' });
    setGsamResult(null);
    try {
      const { data: pc, error } = await supabase.from('postcards').select('original_image_url, illustration_url').eq('id', postcardId.trim()).single();
      if (error || !pc?.original_image_url) throw new Error('Postcard not found');
      setPipelinePhotoUrl(pc.original_image_url);
      if (pc.illustration_url) setPipelineIllustrationUrl(pc.illustration_url);
      setGsamStatus({ status: 'loading', message: 'Calling Grounded SAM on real photo (~16s)…' });
      const data = await callEdgeFn('postalpeek-grounded-sam', { image_url: pc.original_image_url, labels: STICKER_LABELS });
      setGsamResult(data);
      const { error: updateErr } = await supabase.from('postcards').update({
        segmentation_annotated_url:      data.annotated_url || null,
        segmentation_mask_url:           data.mask_url || null,
        segmentation_inverted_mask_url:  data.inverted_mask_url || null,
      }).eq('id', postcardId.trim());
      if (updateErr) console.warn('[Segment] DB save error:', updateErr.message);
      setGsamStatus({ status: 'success', message: `Done & saved — ${data.outputs?.length || 0} output images` });
    } catch (err: unknown) {
      setGsamStatus({ status: 'error', message: err instanceof Error ? err.message : String(err) });
    }
  }, [postcardId, callEdgeFn]);

  const runObjectExtraction = useCallback(async () => {
    if (!postcardId.trim()) return;
    setExtractStatus({ status: 'loading', message: 'Extracting objects via SAM2...' });
    try {
      const data = await callEdgeFn('postalpeek-extract-objects', { postcard_id: postcardId.trim() });
      setExtractStatus({ status: 'success', message: `✅ Done — ${data.total || 0} objects extracted and saved.` });
    } catch (err: unknown) {
      setExtractStatus({ status: 'error', message: err instanceof Error ? err.message : String(err) });
    }
  }, [postcardId, callEdgeFn]);

  // unused but keeping for API completeness
  void segments; void runSegmentOne;

  return (
    <div className="max-w-lg space-y-6">
      <h2 className="text-xl font-semibold">Postcard Actions</h2>

      {/* ID input */}
      <div>
        <label className="text-white/50 text-xs block mb-1.5">Postcard ID (UUID)</label>
        <input
          type="text" value={postcardId} onChange={(e) => setPostcardId(e.target.value)}
          placeholder="3f2504e0-4f89-11d3-9a0c-0305e82c3301"
          className="w-full px-3 py-2.5 rounded-xl text-sm font-mono"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', outline: 'none' }}
        />
      </div>

      {/* Core actions */}
      <div className="space-y-2">
        <ActionBtn onClick={regenerateIllustration} disabled={!postcardId.trim() || postcardStatus.status === 'loading'}>
          <span>🎨</span><span>Regenerate Illustration</span>
        </ActionBtn>
        <ActionBtn onClick={deletePostcard} disabled={!postcardId.trim() || postcardStatus.status === 'loading'} variant="danger">
          <span>🗑️</span><span>Delete Postcard</span>
        </ActionBtn>
      </div>
      <StatusMsg status={postcardStatus.status} message={postcardStatus.message} />

      {/* Object Analysis */}
      <div className="pt-2">
        <SectionTitle>🔍 Object Analysis</SectionTitle>
        <p className="text-white/30 text-[9px] mb-3 -mt-2">Detect objects & save bounding boxes to illustration_tags. Choose source image.</p>
        <div className="flex gap-2">
          <ActionBtn onClick={runDetection} disabled={!postcardId.trim() || detectStatus.status === 'loading'} variant="amber">
            {detectStatus.status === 'loading' ? <Loader className="w-3 h-3 animate-spin" /> : <span>📷</span>}
            <span>Real Photo</span>
          </ActionBtn>
          <ActionBtn onClick={runAnalyzeIllustration} disabled={!postcardId.trim() || detectStatus.status === 'loading'}>
            {detectStatus.status === 'loading' ? <Loader className="w-3 h-3 animate-spin" /> : <span>🎨</span>}
            <span>Illustration</span>
          </ActionBtn>
        </div>
        <StatusMsg status={detectStatus.status} message={detectStatus.message} />
      </div>

      {/* Segmentation */}
      <div className="pt-2">
        <SectionTitle>✂️ One-Click Segmentation</SectionTitle>
        <p className="text-white/30 text-[9px] mb-3 -mt-2">Grounded SAM on real photo → masks persisted to DB. $0.015/run, ~16s</p>
        <ActionBtn onClick={runGroundedSam} disabled={!postcardId.trim() || gsamStatus.status === 'loading'}>
          {gsamStatus.status === 'loading' ? <Loader className="w-3 h-3 animate-spin" /> : <Scissors className="w-3 h-3" />}
          <span>Segment Postcard</span>
        </ActionBtn>
        <StatusMsg status={gsamStatus.status} message={gsamStatus.message} />

        {/* Object Extraction */}
        <div className="mt-6 pt-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <SectionTitle>🧩 Object Extraction Pipeline</SectionTitle>
          <p className="text-white/30 text-[9px] mb-3 -mt-2">Creates individual transparent PNGs of Gemini-detected objects.</p>
          <ActionBtn onClick={runObjectExtraction} disabled={!postcardId.trim() || extractStatus.status === 'loading'} variant="success">
            {extractStatus.status === 'loading' ? <Loader className="w-3 h-3 animate-spin" /> : <Scissors className="w-3 h-3" />}
            <span>Extract Objects</span>
          </ActionBtn>
          <StatusMsg status={extractStatus.status} message={extractStatus.message} />
        </div>

        {/* SAM result images */}
        {gsamResult && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 space-y-4">
            {gsamResult.annotated_url && (
              <div>
                <p className="text-white/40 text-[10px] uppercase tracking-wider mb-1">🎯 Real Photo — Detected + Segmented</p>
                <a href={gsamResult.annotated_url} target="_blank" rel="noopener noreferrer">
                  <img src={gsamResult.annotated_url} alt="Annotated" className="w-full rounded-lg border" style={{ borderColor: 'rgba(139,92,246,0.2)' }} />
                </a>
              </div>
            )}
            {pipelineIllustrationUrl && gsamResult.mask_url && (
              <div>
                <p className="text-white/40 text-[10px] uppercase tracking-wider mb-1">🎨 Illustration + Mask Overlay</p>
                <div className="relative rounded-lg overflow-hidden border" style={{ borderColor: 'rgba(139,92,246,0.2)' }}>
                  <img src={pipelineIllustrationUrl} alt="Illustration" className="w-full block" />
                  <img src={gsamResult.mask_url} alt="Mask overlay" className="absolute inset-0 w-full h-full" style={{ mixBlendMode: 'multiply', opacity: 0.5 }} />
                </div>
                <p className="text-white/30 text-[9px] mt-1">Masks from real photo applied to illustration</p>
              </div>
            )}
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
                    <img src={gsamResult.inverted_mask_url} alt="Inverted" className="w-full rounded bg-black" />
                  </a>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

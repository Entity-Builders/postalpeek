/**
 * PipelineConfigurator.tsx — Unified pipeline control panel for the admin.
 *
 * Replaces scattered generation triggers (Wander, Hunt, Dynamic Hunt, Trip)
 * with a single configurator where pipeline steps can be toggled, presets
 * saved/loaded, and execution triggered individually or in batch.
 */

import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader, Save, Play, ChevronDown, Eye } from 'lucide-react';
import { ILLUSTRATION_STYLES, ACTIVE_STYLE_KEY } from '../../../../eb-infra/supabase/functions/_shared/postcard-engine/illustration-styles.ts';
import {
  buildWanderPrompt,
  buildHuntPrompt,
  buildIllustrationPrompt,
  buildTaxonomyOnlyPrompt,
  VIBES,
} from '../../../../eb-infra/supabase/functions/_shared/postcard-engine/prompts.ts';
import type { PipelineStepConfig } from '../../../../eb-infra/supabase/functions/_shared/postcard-engine/types.ts';

// ── Types ──────────────────────────────────────────────────────────────

type ActionStatus = 'idle' | 'loading' | 'success' | 'error';
type SourceMode = 'wander' | 'hunt' | 'prompt' | 'single' | 'landmark';

interface PipelinePreset {
  name: string;
  steps: PipelineStepConfig;
  icon: string;
  description: string;
  isBuiltIn?: boolean;
}

interface BatchProgress {
  current: number;
  total: number;
  currentLocation: string;
  currentStep: string;
  results: Array<{
    location: string;
    status: 'success' | 'error';
    postcard_id?: string;
    error?: string;
  }>;
}

interface PipelineConfiguratorProps {
  onPostcardGenerated?: () => void;
  onRefetchLog?: () => void;
}

// ── Built-in Presets ───────────────────────────────────────────────────

const BUILT_IN_PRESETS: PipelinePreset[] = [
  {
    name: 'Full Quality',
    icon: '💎',
    description: 'All steps enabled — maximum detail per postcard',
    isBuiltIn: true,
    steps: {
      resolveCoordinates: true,
      aiInsights: true,
      generateIllustration: true,
      illustrationTags: true,
      reverseGeocode: true,
      businessDiscovery: true,
    },
  },
  {
    name: 'Album Batch',
    icon: '⚡',
    description: 'No illustration tags or business discovery — fast album generation',
    isBuiltIn: true,
    steps: {
      resolveCoordinates: true,
      aiInsights: true,
      generateIllustration: true,
      illustrationTags: false,
      reverseGeocode: true,
      businessDiscovery: false,
    },
  },
  {
    name: 'Debug',
    icon: '🔬',
    description: 'StreetView + AI only — test coordinates without generating illustration',
    isBuiltIn: true,
    steps: {
      resolveCoordinates: true,
      aiInsights: true,
      generateIllustration: false,
      illustrationTags: false,
      reverseGeocode: true,
      businessDiscovery: false,
    },
  },
];

const HUNT_THEME_OPTIONS = [
  { slug: 'monuments',   label: '🏛️ Monumentos Históricos' },
  { slug: 'skyscrapers', label: '🏙️ Rascacielos' },
  { slug: 'bridges',     label: '🌉 Puentes' },
  { slug: 'markets',     label: '🛒 Mercados y Bazares' },
  { slug: 'churches',    label: '⛪ Iglesias y Catedrales' },
  { slug: 'street_art',  label: '🎨 Arte Urbano' },
  { slug: 'staircases',  label: '🪜 Escaleras y Callejones' },
];

// ── Step Definitions ───────────────────────────────────────────────────

interface StepDef {
  key: keyof PipelineStepConfig;
  icon: string;
  label: string;
  hint: string;
  required?: boolean;
  dependsOn?: keyof PipelineStepConfig;
}

const STEP_DEFINITIONS: StepDef[] = [
  { key: 'resolveCoordinates', icon: '📍', label: 'Resolve Coordinates', hint: 'Valida y refina las coordenadas GPS usando Google Places para mayor precisión' },
  { key: 'aiInsights',         icon: '🤖', label: 'AI Insights',         hint: 'Analiza la foto con Gemini: categoría, descripción, tags visuales, vibe estético y storytelling' },
  { key: 'generateIllustration', icon: '🎨', label: 'Generate Illustration', hint: 'Genera la ilustración artística de la postal usando el vibe detectado por AI Insights', dependsOn: 'aiInsights' },
  { key: 'illustrationTags',   icon: '🏷️', label: 'Illustration Tags',   hint: 'Analiza la ilustración generada para detectar objetos y elementos (usado en gacha/stickers)', dependsOn: 'generateIllustration' },
  { key: 'reverseGeocode',     icon: '🗺️', label: 'Reverse Geocode',     hint: 'Convierte las coordenadas en ciudad y país legibles (ej: -34.6, -58.3 → Buenos Aires, Argentina)' },
  { key: 'businessDiscovery',  icon: '🏪', label: 'Business Discovery',  hint: 'Busca negocios y puntos de interés cercanos a la ubicación para asociar a la postal' },
];

// ── Helpers ─────────────────────────────────────────────────────────────

const PRESETS_KEY = 'postalpeek-pipeline-presets';
const ACTIVE_PRESET_KEY = 'postalpeek-active-preset';

function loadCustomPresets(): PipelinePreset[] {
  try {
    return JSON.parse(localStorage.getItem(PRESETS_KEY) || '[]');
  } catch { return []; }
}

function saveCustomPresets(presets: PipelinePreset[]): void {
  localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
}

function loadActivePresetName(): string {
  return localStorage.getItem(ACTIVE_PRESET_KEY) || 'Full Quality';
}

function saveActivePresetName(name: string): void {
  localStorage.setItem(ACTIVE_PRESET_KEY, name);
}

// ── Component ──────────────────────────────────────────────────────────

export function PipelineConfigurator({ onPostcardGenerated, onRefetchLog }: PipelineConfiguratorProps) {
  // ─ Step config
  const [steps, setSteps] = useState<PipelineStepConfig>(BUILT_IN_PRESETS[0].steps);
  const [illustrationStyleKeys, setIllustrationStyleKeys] = useState<string[]>([ACTIVE_STYLE_KEY]);

  // ─ Presets
  const [customPresets, setCustomPresets] = useState<PipelinePreset[]>(loadCustomPresets);
  const [activePresetName, setActivePresetName] = useState(loadActivePresetName);
  const [newPresetName, setNewPresetName] = useState('');

  const allPresets = [...BUILT_IN_PRESETS, ...customPresets];

  // ─ Source mode
  const [sourceMode, setSourceMode] = useState<SourceMode>('wander');

  // ─ Source: Single
  const [singleLat, setSingleLat] = useState('');
  const [singleLng, setSingleLng] = useState('');
  const [singleName, setSingleName] = useState('');

  // ─ Source: Prompt (batch)
  const [batchPrompt, setBatchPrompt] = useState('');
  const [batchCountry, setBatchCountry] = useState('');
  const [batchCount, setBatchCount] = useState(6);

  // ─ Source: Hunt
  const [huntTheme, setHuntTheme] = useState('monuments');
  const [huntCountry, setHuntCountry] = useState('');

  // ─ Source: Landmark Precision
  const [landmarkQuery, setLandmarkQuery] = useState('');
  const [landmarkNameEs, setLandmarkNameEs] = useState('');

  // ─ Prompt viewer
  const [promptViewerOpen, setPromptViewerOpen] = useState(false);
  const [activePromptTab, setActivePromptTab] = useState<'insights' | 'illustration' | 'illusTags' | 'taxonomy'>('insights');

  // ─ Execution state
  const [status, setStatus] = useState<{ status: ActionStatus; message: string }>({ status: 'idle', message: '' });
  const [batchProgress, setBatchProgress] = useState<BatchProgress | null>(null);

  const edgeBase = import.meta.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321';
  const edgeKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WO7o6oSc4wYjSnO28-VRLNxMEnOj9aQREp8o';

  // ─ Load active preset on mount (initializing state, not a side-effect)
  const initialPreset = allPresets.find(p => p.name === activePresetName);
  const [stepsInitialized] = useState(() => {
    return initialPreset?.steps ?? BUILT_IN_PRESETS[0].steps;
  });
  // Sync steps from stepsInitialized only on first render
  useEffect(() => {
    setSteps(stepsInitialized);
  }, [stepsInitialized]);

  // ─ Toggle a step
  const toggleStep = (key: keyof PipelineStepConfig) => {
    setSteps(prev => {
      const next = { ...prev, [key]: !prev[key] };
      // Enforce dependencies: if parent disabled, disable children
      if (key === 'aiInsights' && !next.aiInsights) {
        next.generateIllustration = false;
        next.illustrationTags = false;
      }
      if (key === 'generateIllustration' && !next.generateIllustration) {
        next.illustrationTags = false;
      }
      // Auto-enable parent if child enabled
      if (key === 'generateIllustration' && next.generateIllustration) {
        next.aiInsights = true;
      }
      if (key === 'illustrationTags' && next.illustrationTags) {
        next.generateIllustration = true;
        next.aiInsights = true;
      }
      return next;
    });
    setActivePresetName('Custom');
  };

  // ─ Apply preset
  const applyPreset = (preset: PipelinePreset) => {
    setSteps(preset.steps);
    setActivePresetName(preset.name);
    saveActivePresetName(preset.name);
  };

  // ─ Save custom preset
  const savePreset = () => {
    const name = newPresetName.trim();
    if (!name) return;
    const newPreset: PipelinePreset = {
      name,
      icon: '📌',
      description: 'Custom preset',
      steps: { ...steps },
    };
    const updated = [...customPresets.filter(p => p.name !== name), newPreset];
    setCustomPresets(updated);
    saveCustomPresets(updated);
    setActivePresetName(name);
    saveActivePresetName(name);
    setNewPresetName('');
  };



  // ─ Get random illustration style
  const getRandomStyle = useCallback(() => {
    return illustrationStyleKeys[Math.floor(Math.random() * illustrationStyleKeys.length)];
  }, [illustrationStyleKeys]);

  // ─ Call edge function
  const callEdge = useCallback(async (fn: string, params = '', body: Record<string, unknown> = {}) => {
    const res = await fetch(
      `${edgeBase}/functions/v1/${fn}?force=true${params ? `&${params}` : ''}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${edgeKey}` }, body: JSON.stringify(body) },
    );
    
    // Parse as JSON only if Content-Type is valid, else read as text to catch "Function not found"
    const isJson = res.headers.get('content-type')?.includes('application/json');
    let data;
    
    if (isJson) {
      data = await res.json();
    } else {
      const text = await res.text();
      throw new Error(`Edge Function error (${res.status}): ${text || 'Unknown error. Check Edge URL.'}`);
    }

    if (!res.ok || data?.error) throw new Error(data?.error || `${fn} failed (${res.status})`);
    return data;
  }, [edgeBase, edgeKey]);

  // ─ Execute: Single pipeline run
  const executeSingle = useCallback(async () => {
    setStatus({ status: 'loading', message: 'Running pipeline…' });
    try {
      const body: Record<string, unknown> = {
        illustration_style_key: getRandomStyle(),
        pipeline_config: steps,
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let data: any;
      if (sourceMode === 'wander') {
        data = await callEdge('postalpeek-walker-wander', '', body);
        const loc = data?.data?.location || 'done';
        const pid = data?.data?.postcard_id;
        setStatus({ status: 'success', message: `${loc}${pid ? ` · ID: ${pid}` : ''}` });
      } else if (sourceMode === 'hunt') {
        const params: string[] = [`theme=${huntTheme}`];
        if (huntCountry.trim()) params.push(`country=${encodeURIComponent(huntCountry.trim())}`);
        data = await callEdge('postalpeek-walker-hunt', params.join('&'), body);
        const loc = data?.data?.location || 'done';
        const pid = data?.data?.postcard_id;
        setStatus({ status: 'success', message: `${loc} · ${data?.attempts ?? 1} attempt(s)${pid ? ` · ID: ${pid}` : ''}` });
      } else if (sourceMode === 'single') {
        if (!singleLat.trim() || !singleLng.trim()) {
          setStatus({ status: 'error', message: 'Lat/Lng required' });
          return;
        }
        const params = `lat=${singleLat.trim()}&lng=${singleLng.trim()}&theme=monuments`;
        if (singleName.trim()) body.location_name = singleName.trim();
        data = await callEdge('postalpeek-walker-hunt', params, body);
        const loc = data?.data?.location || 'done';
        const pid = data?.data?.postcard_id;
        setStatus({ status: 'success', message: `${loc}${pid ? ` · ID: ${pid}` : ''}` });
      } else if (sourceMode === 'landmark') {
        if (!landmarkQuery.trim()) {
          setStatus({ status: 'error', message: 'Landmark name required (e.g. "Eiffel Tower, Paris")' });
          return;
        }
        const displayName = landmarkNameEs.trim() || landmarkQuery.trim();
        data = await callEdge('postalpeek-generate-album', '', {
          ...body,
          prompt: `Landmark: ${landmarkQuery.trim()}`,
          count: 1,
          landmark_precision: {
            landmarkQuery: landmarkQuery.trim(),
            landmarkName: {
              en: landmarkQuery.trim(),
              es: displayName,
            },
          },
        });
        const landmarkPid = data?.data?.postcard_id;
        setStatus({ status: 'success', message: `🏛️ ${landmarkQuery} · ${landmarkPid ? `ID: ${landmarkPid}` : 'queued'}` });
      }

      onPostcardGenerated?.();
      setTimeout(() => onRefetchLog?.(), 2000);
    } catch (err: unknown) {
      setStatus({ status: 'error', message: err instanceof Error ? err.message : String(err) });
    }
  }, [sourceMode, steps, getRandomStyle, callEdge, huntTheme, huntCountry, singleLat, singleLng, singleName, landmarkQuery, landmarkNameEs, onPostcardGenerated, onRefetchLog]);

  // ─ Execute: Batch (prompt → album)
  const executeBatch = useCallback(async () => {
    if (!batchPrompt.trim()) return;
    setStatus({ status: 'loading', message: `🤖 Planning album for "${batchPrompt}" (Asking Gemini)…` });
    setBatchProgress(null); // No longer doing sequential loop in frontend

    try {
      const data = await callEdge('postalpeek-generate-album', '', {
        prompt: batchPrompt.trim(),
        country: batchCountry.trim() || undefined,
        count: batchCount,
        pipeline_config: steps,
        illustration_style_key: getRandomStyle(),
      });

      const stats = data?.stats;
      setStatus({
        status: 'success',
        message: `${stats?.queued ?? 0} slots queued · Album: ${data?.title || data?.album_id}`,
      });

      onPostcardGenerated?.();
      setTimeout(() => onRefetchLog?.(), 2000);
    } catch (err: unknown) {
      setBatchProgress(null);
      setStatus({ status: 'error', message: err instanceof Error ? err.message : String(err) });
    }
  }, [batchPrompt, batchCountry, batchCount, steps, getRandomStyle, callEdge, onPostcardGenerated, onRefetchLog]);

  // ─ Main execute
  const execute = sourceMode === 'prompt' ? executeBatch : executeSingle;
  const isRunning = status.status === 'loading';
  const canExecute = sourceMode !== 'single' || (singleLat.trim() && singleLng.trim());
  const canExecuteLandmark = sourceMode !== 'landmark' || landmarkQuery.trim().length > 2;

  // ── Calculate estimated time
  const estimateTime = () => {
    let base = 3; // streetview
    if (steps.resolveCoordinates) base += 1;
    if (steps.aiInsights) base += 6;
    if (steps.generateIllustration) base += 10;
    if (steps.illustrationTags) base += 7;
    if (steps.reverseGeocode) base += 1;
    if (steps.businessDiscovery) base += 3;
    return base;
  };

  const perCardTime = estimateTime();
  const totalEstimate = sourceMode === 'prompt' ? perCardTime * batchCount : perCardTime;

  return (
    <div className="max-w-lg space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">🔧 Pipeline Configurator</h2>
        <span className="text-white/30 text-[10px] font-mono">~{totalEstimate}s est.</span>
      </div>

      {/* ── Preset Selector ── */}
      <div className="rounded-xl p-4 border" style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(99,102,241,0.2)' }}>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-white/60 text-[10px] uppercase tracking-widest font-semibold">Preset</span>
          <span
            className="text-[10px] px-1.5 py-0.5 rounded font-mono"
            style={{ background: 'rgba(99,102,241,0.2)', color: 'rgb(165,180,252)' }}
          >
            {activePresetName}
          </span>
        </div>

        {/* Preset buttons */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {allPresets.map(preset => (
            <button
              key={preset.name}
              onClick={() => applyPreset(preset)}
              className="px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all border"
              style={{
                background: activePresetName === preset.name ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.04)',
                borderColor: activePresetName === preset.name ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.06)',
                color: activePresetName === preset.name ? 'rgb(165,180,252)' : 'rgba(255,255,255,0.6)',
              }}
            >
              {preset.icon} {preset.name}
            </button>
          ))}
        </div>

        {/* Save new preset */}
        <div className="flex gap-1.5">
          <input
            type="text"
            value={newPresetName}
            onChange={(e) => setNewPresetName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && savePreset()}
            placeholder="Save as new preset…"
            className="flex-1 px-2.5 py-1.5 rounded-lg text-xs"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: 'white', outline: 'none' }}
          />
          <button
            onClick={savePreset}
            disabled={!newPresetName.trim()}
            className="px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-30"
            style={{ background: 'rgba(99,102,241,0.15)', color: 'rgb(165,180,252)' }}
          >
            <Save className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* ── Step Toggles ── */}
      <div className="rounded-xl p-4 border" style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.08)' }}>
        <span className="text-white/60 text-[10px] uppercase tracking-widest font-semibold mb-3 block">Pipeline Steps</span>

        <div className="space-y-1">
          {STEP_DEFINITIONS.map((step) => {
            const isEnabled = steps[step.key] !== false;
            const parentDisabled = step.dependsOn && steps[step.dependsOn] === false;
            const isDisabled = step.required || parentDisabled;

            return (
              <button
                key={step.key}
                onClick={() => !isDisabled && toggleStep(step.key)}
                disabled={!!isDisabled}
                className="w-full flex items-center gap-3 p-2.5 rounded-lg transition-all text-left group"
                style={{
                  background: isEnabled ? 'rgba(99,102,241,0.08)' : 'rgba(255,255,255,0.02)',
                  opacity: parentDisabled ? 0.3 : 1,
                }}
              >
                <span className="text-base">{step.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium ${isEnabled ? 'text-white' : 'text-white/40'}`}>{step.label}</span>
                    {step.required && <span className="text-[8px] text-white/20 uppercase">required</span>}
                  </div>
                  <span className="text-[10px] text-white/25">{step.hint}</span>
                </div>
                <div
                  className="w-8 h-4.5 rounded-full relative transition-all flex-shrink-0"
                  style={{
                    background: isEnabled ? 'rgba(99,102,241,0.6)' : 'rgba(255,255,255,0.1)',
                  }}
                >
                  <div
                    className="absolute top-0.5 w-3.5 h-3.5 rounded-full transition-all"
                    style={{
                      background: isEnabled ? 'white' : 'rgba(255,255,255,0.3)',
                      left: isEnabled ? '16px' : '2px',
                    }}
                  />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Prompt Viewer ── */}
      <div className="rounded-xl border" style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.08)' }}>
        <button
          onClick={() => setPromptViewerOpen(!promptViewerOpen)}
          className="w-full flex items-center gap-2 p-4 text-left"
        >
          <Eye className="w-3.5 h-3.5 text-white/40" />
          <span className="text-white/60 text-[10px] uppercase tracking-widest font-semibold flex-1">Prompt Viewer</span>
          <ChevronDown
            className={`w-3.5 h-3.5 text-white/30 transition-transform ${promptViewerOpen ? 'rotate-180' : ''}`}
          />
        </button>

        <AnimatePresence>
          {promptViewerOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-4 space-y-3">
                {/* Tabs */}
                <div className="flex gap-1 flex-wrap">
                  {([
                    { key: 'insights' as const, label: '🤖 AI Insights', show: steps.aiInsights !== false },
                    { key: 'illustration' as const, label: '🎨 Illustration', show: steps.generateIllustration !== false },
                    { key: 'illusTags' as const, label: '🏷️ Illus Tags', show: steps.illustrationTags !== false },
                    { key: 'taxonomy' as const, label: '🔍 Taxonomy Only', show: true },
                  ]).filter(t => t.show).map(tab => (
                    <button
                      key={tab.key}
                      onClick={() => setActivePromptTab(tab.key)}
                      className="px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all"
                      style={{
                        background: activePromptTab === tab.key ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.03)',
                        border: `1px solid ${activePromptTab === tab.key ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.06)'}`,
                        color: activePromptTab === tab.key ? 'rgb(165,180,252)' : 'rgba(255,255,255,0.4)',
                      }}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Prompt content */}
                <div className="relative">
                  <pre
                    className="text-[10px] leading-relaxed text-white/60 whitespace-pre-wrap font-mono rounded-lg p-3 max-h-[400px] overflow-y-auto custom-scrollbar"
                    style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)' }}
                  >
                    {activePromptTab === 'insights' && (() => {
                      const lens = 'wide_angle';
                      if (sourceMode === 'hunt') {
                        const theme = HUNT_THEME_OPTIONS.find(t => t.slug === huntTheme);
                        return buildHuntPrompt(lens, {
                          slug: huntTheme,
                          searchHint: `Look for ${theme?.label || huntTheme}`,
                          nameSingular: { es: theme?.label || huntTheme, en: theme?.label || huntTheme },
                        });
                      }
                      return buildWanderPrompt(lens);
                    })()}
                    {activePromptTab === 'illustration' && (() => {
                      const sampleVibe = VIBES[0];
                      return buildIllustrationPrompt(sampleVibe, {
                        architecture_style: 'colonial',
                        aesthetic_vibes: ['vintage_nostalgia'],
                        color_palette: 'warm_terracotta',
                        scene_type: 'historic_center',
                      }, illustrationStyleKeys[0]);
                    })()}
                    {activePromptTab === 'illusTags' && [
                      'Analyze this stylized illustration and list all prominent objects and visual elements.',
                      '',
                      'Return a JSON array. Each object must have:',
                      '- "label": { "en": "english_name", "es": "spanish_name" }',
                      '- "type": one of "architecture", "vehicle", "nature", "object", "person", "animal", "scene_details", "style"',
                      '- "weight": number 1-10 (visual prominence)',
                      '- "confidence": number 1-10',
                      '- "count": number',
                      '- "position": "foreground" | "midground" | "background"',
                      '- "box_2d": [ymin, xmin, ymax, xmax] normalized 0-1000',
                      '',
                      'Detect up to 15 objects. Only include clearly visible objects.',
                    ].join('\n')}
                    {activePromptTab === 'taxonomy' && buildTaxonomyOnlyPrompt('wide_angle')}
                  </pre>

                  {/* Mode indicator */}
                  {activePromptTab === 'insights' && (
                    <div className="absolute top-2 right-2">
                      <span
                        className="text-[8px] px-1.5 py-0.5 rounded font-mono uppercase"
                        style={{ background: 'rgba(99,102,241,0.2)', color: 'rgb(165,180,252)' }}
                      >
                        {sourceMode} mode
                      </span>
                    </div>
                  )}
                  {activePromptTab === 'illustration' && (
                    <div className="absolute top-2 right-2">
                      <span
                        className="text-[8px] px-1.5 py-0.5 rounded font-mono"
                        style={{ background: 'rgba(245,158,11,0.2)', color: 'rgb(252,211,77)' }}
                      >
                        sample hints shown
                      </span>
                    </div>
                  )}
                </div>

                <p className="text-[9px] text-white/20">
                  💡 Estos son los prompts reales que se envían a Gemini. Cambiar el source mode cambia el prompt de AI Insights.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Illustration Style (only when illustration is enabled) ── */}
      {steps.generateIllustration !== false && (
        <div className="rounded-xl p-4 border" style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.08)' }}>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-white/60 text-[10px] uppercase tracking-widest font-semibold">🎨 Illustration Style</span>
            <span
              className="text-[10px] px-1.5 py-0.5 rounded font-mono"
              style={{ background: 'rgba(99,102,241,0.2)', color: 'rgb(165,180,252)' }}
            >
              {illustrationStyleKeys.length > 1 ? 'multi' : illustrationStyleKeys[0]}
            </span>
          </div>
          <div className="space-y-1 max-h-[120px] overflow-y-auto custom-scrollbar">
            {Object.entries(ILLUSTRATION_STYLES).map(([key, style]) => {
              const isSelected = illustrationStyleKeys.includes(key);
              return (
                <label
                  key={key}
                  className="flex items-center gap-2 p-1.5 rounded-lg cursor-pointer transition-all"
                  style={{
                    background: isSelected ? 'rgba(99,102,241,0.1)' : 'transparent',
                  }}
                >
                  <input
                    type="checkbox"
                    className="flex-shrink-0 cursor-pointer"
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
                  <span className={`text-xs ${isSelected ? 'text-white' : 'text-white/50'}`}>
                    {key === ACTIVE_STYLE_KEY ? '✓ ' : ''}{style.label}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Source Mode ── */}
      <div className="rounded-xl p-4 border" style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.08)' }}>
        <span className="text-white/60 text-[10px] uppercase tracking-widest font-semibold mb-3 block">Source</span>

        {/* Mode tabs */}
        <div className="flex gap-1 mb-3 p-0.5 rounded-lg flex-wrap" style={{ background: 'rgba(255,255,255,0.04)' }}>
          {[
            { mode: 'wander' as SourceMode, label: '🌍 Wander' },
            { mode: 'hunt' as SourceMode, label: '🎯 Hunt' },
            { mode: 'prompt' as SourceMode, label: '🤖 Prompt' },
            { mode: 'single' as SourceMode, label: '📍 Single' },
            { mode: 'landmark' as SourceMode, label: '🏛️ Landmark' },
          ].map(({ mode, label }) => (
            <button
              key={mode}
              onClick={() => setSourceMode(mode)}
              className="flex-1 px-2 py-1.5 rounded-md text-xs font-medium transition-all"
              style={{
                background: sourceMode === mode ? 'rgba(99,102,241,0.25)' : 'transparent',
                color: sourceMode === mode ? 'rgb(165,180,252)' : 'rgba(255,255,255,0.4)',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Source: Wander */}
        {sourceMode === 'wander' && (
          <p className="text-white/30 text-xs">Random GPS → full pipeline. No configuration needed.</p>
        )}

        {/* Source: Hunt */}
        {sourceMode === 'hunt' && (
          <div className="space-y-2">
            <select
              value={huntTheme}
              onChange={(e) => setHuntTheme(e.target.value)}
              className="w-full px-3 py-2 rounded-xl text-sm"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', outline: 'none' }}
            >
              {HUNT_THEME_OPTIONS.map(opt => (
                <option key={opt.slug} value={opt.slug} style={{ background: '#1a1a2e', color: 'white' }}>{opt.label}</option>
              ))}
            </select>
            <input
              type="text"
              value={huntCountry}
              onChange={(e) => setHuntCountry(e.target.value)}
              placeholder="Country filter (optional)"
              className="w-full px-3 py-2 rounded-xl text-sm"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'white', outline: 'none' }}
            />
          </div>
        )}

        {/* Source: Prompt (batch) */}
        {sourceMode === 'prompt' && (
          <div className="space-y-2">
            <input
              type="text"
              value={batchPrompt}
              onChange={(e) => setBatchPrompt(e.target.value)}
              placeholder="estadios de futbol de buenos aires, plazas de roma…"
              className="w-full px-3 py-2.5 rounded-xl text-sm"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'white', outline: 'none' }}
            />
            <input
              type="text"
              value={batchCountry}
              onChange={(e) => setBatchCountry(e.target.value)}
              placeholder="Country filter (optional)"
              className="w-full px-3 py-2 rounded-xl text-sm"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'white', outline: 'none' }}
            />
            <div className="flex items-center gap-2">
              <span className="text-white/40 text-xs">Postcards:</span>
              <select
                value={batchCount}
                onChange={(e) => setBatchCount(Number(e.target.value))}
                className="px-2 py-1 rounded-lg text-xs font-mono"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', outline: 'none' }}
              >
                {[3, 4, 5, 6, 8, 10].map(n => (
                  <option key={n} value={n} style={{ background: '#1a1a2e' }}>{n}</option>
                ))}
              </select>
              <span className="text-white/20 text-[10px]">~{perCardTime * batchCount}s total</span>
            </div>
            <p className="text-white/20 text-[10px]">
              Gemini generates GPS locations → creates album → runs pipeline for each
            </p>
          </div>
        )}

        {/* Source: Single Location */}
        {sourceMode === 'single' && (
          <div className="space-y-2">
            <input
              type="text"
              value={singleName}
              onChange={(e) => setSingleName(e.target.value)}
              placeholder="Location name (e.g. La Bombonera, Buenos Aires)"
              className="w-full px-3 py-2 rounded-xl text-sm"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'white', outline: 'none' }}
            />
            <div className="flex gap-2">
              <input
                type="text"
                value={singleLat}
                onChange={(e) => setSingleLat(e.target.value)}
                placeholder="Lat (e.g. -34.6358)"
                className="flex-1 px-3 py-2 rounded-xl text-sm font-mono"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'white', outline: 'none' }}
              />
              <input
                type="text"
                value={singleLng}
                onChange={(e) => setSingleLng(e.target.value)}
                placeholder="Lng (e.g. -58.3698)"
                className="flex-1 px-3 py-2 rounded-xl text-sm font-mono"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'white', outline: 'none' }}
              />
            </div>
          </div>
        )}

        {/* Source: Landmark Precision */}
        {sourceMode === 'landmark' && (
          <div className="space-y-2">
            <p className="text-white/40 text-[10px]">
              🏛️ <strong style={{ color: 'rgba(165,180,252,0.8)' }}>Landmark Precision</strong> — Geocodifica el lugar exacto y verifica que sea visible antes de generar la ilustración.
            </p>
            <input
              type="text"
              value={landmarkQuery}
              onChange={(e) => setLandmarkQuery(e.target.value)}
              placeholder="Landmark name in English (e.g. Eiffel Tower, Paris)"
              className="w-full px-3 py-2.5 rounded-xl text-sm"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(165,180,252,0.25)', color: 'white', outline: 'none' }}
            />
            <input
              type="text"
              value={landmarkNameEs}
              onChange={(e) => setLandmarkNameEs(e.target.value)}
              placeholder="Nombre en español (opcional, ej: Torre Eiffel, París)"
              className="w-full px-3 py-2 rounded-xl text-sm"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'white', outline: 'none' }}
            />
            <div className="rounded-lg p-2.5" style={{ background: 'rgba(165,180,252,0.06)', border: '1px solid rgba(165,180,252,0.12)' }}>
              <p className="text-[10px] text-white/40 leading-relaxed">
                💡 El pipeline geocodificará las coordenadas exactas, apuntará la cámara hacia el landmark y pedirá a Gemini que confirme visualmente que está presente antes de gastar créditos en la ilustración.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── Execute Button ── */}
      <button
        onClick={execute}
        disabled={isRunning || (sourceMode === 'prompt' && !batchPrompt.trim()) || !canExecute || !canExecuteLandmark}
        className="w-full px-4 py-3 rounded-xl text-sm font-semibold text-white transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 hover:brightness-110 border border-white/5"
        style={{
          background: sourceMode === 'prompt'
            ? 'linear-gradient(135deg, rgba(139,92,246,0.4), rgba(99,102,241,0.3))'
            : sourceMode === 'landmark'
              ? 'linear-gradient(135deg, rgba(245,158,11,0.4), rgba(239,68,68,0.25))'
              : 'linear-gradient(135deg, rgba(99,102,241,0.4), rgba(59,130,246,0.3))',
        }}
      >
        {isRunning ? <Loader className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
        {sourceMode === 'prompt'
          ? `Generate Album (${batchCount} postcards)`
          : sourceMode === 'wander' ? 'Run Wander Pipeline'
          : sourceMode === 'hunt' ? `Run Hunt: ${HUNT_THEME_OPTIONS.find(o => o.slug === huntTheme)?.label || huntTheme}`
          : sourceMode === 'landmark' ? `🏛️ Capture: ${landmarkQuery || 'Enter landmark…'}`
          : 'Run Pipeline'
        }
      </button>

      {/* ── Status ── */}
      <AnimatePresence>
        {status.status !== 'idle' && status.message && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={`px-3 py-2 rounded-lg text-xs flex items-center gap-2 border ${
              status.status === 'loading' ? 'bg-indigo-950/60 text-indigo-300 border-indigo-700/30' :
              status.status === 'success' ? 'bg-emerald-950/60 text-emerald-300 border-emerald-700/30' :
              'bg-red-950/60 text-red-300 border-red-700/30'
            }`}
          >
            {status.status === 'loading' && <Loader className="w-3 h-3 animate-spin shrink-0" />}
            {status.status === 'success' && '✅'}
            {status.status === 'error' && '❌'}
            <span className="break-all">{status.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Batch Progress ── */}
      {batchProgress && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl p-4 border"
          style={{ background: 'rgba(99,102,241,0.06)', borderColor: 'rgba(99,102,241,0.15)' }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-white/70 text-xs font-medium">
              📮 {batchProgress.currentLocation}
            </span>
            <span className="text-white/40 text-[10px] font-mono">
              {batchProgress.current}/{batchProgress.total}
            </span>
          </div>
          <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <motion.div
              className="h-full rounded-full"
              style={{ background: 'linear-gradient(90deg, rgba(99,102,241,0.8), rgba(139,92,246,0.8))' }}
              initial={{ width: '0%' }}
              animate={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
          <p className="text-white/30 text-[10px] mt-1.5">{batchProgress.currentStep}</p>

          {/* Results */}
          {batchProgress.results.length > 0 && (
            <div className="mt-3 space-y-1">
              {batchProgress.results.map((r, i) => (
                <div key={i} className="flex items-center gap-1.5 text-[10px]">
                  <span>{r.status === 'success' ? '✅' : '❌'}</span>
                  <span className={r.status === 'success' ? 'text-white/50' : 'text-red-400'}>{r.location}</span>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}

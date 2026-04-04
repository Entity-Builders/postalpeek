import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader, Compass, Eye, Zap, Star, Target } from 'lucide-react';

import { CapturedFrame, svThumb, scoreColor } from './explorer-utils';

// phaseConfig logic moved to PhaseIndicator component

export function PhaseIndicator({ phase, message }: { phase: number; message: string }) {
  let icon, color, bg, border;
  switch (phase) {
    case 1: icon = <Compass className="w-4 h-4" />; color = 'text-purple-400'; bg = 'rgba(147,51,234,0.1)'; border = 'rgba(147,51,234,0.25)'; break;
    case 2: icon = <Compass className="w-4 h-4" />; color = 'text-blue-400'; bg = 'rgba(59,130,246,0.1)'; border = 'rgba(59,130,246,0.25)'; break;
    case 3: icon = <Eye className="w-4 h-4" />; color = 'text-amber-400'; bg = 'rgba(245,158,11,0.1)'; border = 'rgba(245,158,11,0.25)'; break;
    case 4: icon = <Zap className="w-4 h-4" />; color = 'text-emerald-400'; bg = 'rgba(16,185,129,0.1)'; border = 'rgba(16,185,129,0.25)'; break;
    default: icon = <Loader className="w-4 h-4 animate-spin" />; color = 'text-white/30'; bg = 'transparent'; border = 'transparent'; break;
  }
  return (
    <motion.div
      key={`${phase}-${message.slice(0, 20)}`}
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="mx-3 mt-3 mb-1 px-3 py-2 rounded-xl flex items-center gap-2.5"
      style={{ background: bg, border: `1px solid ${border}` }}
    >
      <span className={color}>{icon}</span>
      <p className={`text-[11px] font-mono font-medium truncate ${color}`}>
        {phase > 0 && <span className="opacity-60 mr-1.5">PHASE {phase} ·</span>}
        {message}
      </p>
    </motion.div>
  );
}

export interface FrameSectionProps {
  label: string;
  labelIcon?: React.ReactNode;
  labelColor?: string;
  count: number;
  frames: CapturedFrame[];
  mapsApiKey: string;
  accentColor?: string;
  accentBorder?: string;
  showPlaceholder?: boolean;
  columns?: 2 | 3;
}

export function FrameSection({
  label,
  labelIcon,
  labelColor = 'rgba(255,255,255,0.3)',
  count,
  frames,
  mapsApiKey,
  accentColor = 'transparent',
  accentBorder = 'transparent',
  showPlaceholder = false,
  columns = 2,
}: FrameSectionProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl overflow-hidden"
      style={{
        background: accentColor,
        border: `1px solid ${accentBorder || 'rgba(255,255,255,0.06)'}`,
      }}
    >
      <div className="flex items-center gap-2 px-3 py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        {labelIcon && <span style={{ color: labelColor }}>{labelIcon}</span>}
        <p className="text-[9px] font-mono font-semibold uppercase tracking-widest" style={{ color: labelColor }}>
          {label}
        </p>
        <span className="text-[9px] font-mono ml-auto" style={{ color: labelColor, opacity: 0.6 }}>
          {count} frame{count !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="p-2 grid gap-2" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
        <AnimatePresence initial={false}>
          {frames.map((frame, idx) => (
            <FrameCard key={`${frame.pano_id}-${frame.fov}-${frame.phase}`} frame={frame} idx={idx} label={label} mapsApiKey={mapsApiKey} />
          ))}
          {showPlaceholder && (
            <motion.div key="placeholder" animate={{ opacity: [0.3, 0.6, 0.3] }} transition={{ duration: 1.5, repeat: Infinity }}
              className="rounded-lg flex items-center justify-center" style={{ aspectRatio: '3/2', border: '1px dashed rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.02)' }}>
              <Loader className="w-4 h-4 text-white/15 animate-spin" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

export interface FrameCardProps {
  frame: CapturedFrame;
  idx: number;
  label: string;
  mapsApiKey: string;
  showParentInfo?: boolean;
  parentFrame?: CapturedFrame | null;
}

export function FrameCard({ frame, idx, label, mapsApiKey, showParentInfo = false, parentFrame }: FrameCardProps) {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.25, delay: idx * 0.04 }}
      className="relative rounded-lg overflow-hidden"
      style={{
        aspectRatio: '3/2',
        border: frame.is_winner ? '2px solid #10b981' : frame.is_candidate ? '2px solid rgba(251,191,36,0.7)' : frame.status === 'perfect' ? '2px solid #10b981' : frame.phase === 'approach' ? '1px solid rgba(251,191,36,0.35)' : frame.phase === 'refinement' ? '1px solid rgba(99,102,241,0.3)' : '1px solid rgba(255,255,255,0.08)',
        boxShadow: frame.is_winner ? '0 0 16px rgba(16,185,129,0.35)' : frame.is_candidate ? '0 0 12px rgba(251,191,36,0.2)' : 'none',
      }}>
      <img src={svThumb(frame.pano_id, frame.heading, frame.fov, frame.pitch, mapsApiKey, '640x426')} alt={`${label} frame ${frame.index}`} className="w-full h-full object-cover" loading="eager" />

      {frame.is_candidate && (
        <motion.div initial={{ opacity: 0, scale: 0.7, y: -4 }} animate={{ opacity: 1, scale: 1, y: 0 }} className="absolute top-1.5 left-1.5 flex items-center gap-1 px-1.5 py-0.5 rounded-md" style={{ background: 'rgba(251,191,36,0.92)', backdropFilter: 'blur(4px)' }}>
          <Star className="w-2.5 h-2.5 text-black fill-black" />
          <span className="text-[8px] font-bold text-black uppercase tracking-wide">Candidate</span>
        </motion.div>
      )}

      {showParentInfo && parentFrame && (
        <div className="absolute top-1.5 left-1.5 flex items-center gap-1 px-1.5 py-0.5 rounded-md" style={{ background: 'rgba(99,102,241,0.85)', backdropFilter: 'blur(4px)' }}>
          <Target className="w-2.5 h-2.5 text-white" />
          <span className="text-[7px] font-bold text-white/90 uppercase tracking-wide truncate" style={{ maxWidth: 48 }}>from #{parentFrame.index}</span>
        </div>
      )}

      {!showParentInfo && (
        <div className="absolute top-1 right-1 text-[8px] font-mono px-1 py-0.5 rounded" style={{ background: 'rgba(0,0,0,0.7)', color: 'rgba(255,255,255,0.55)' }}>{frame.fov}°</div>
      )}
      {showParentInfo && (
        <div className="absolute top-1 right-1 text-[8px] font-mono px-1 py-0.5 rounded" style={{ background: 'rgba(0,0,0,0.7)', color: 'rgba(255,255,255,0.55)' }}>{frame.fov}°</div>
      )}

      {frame.status && (
        <div className="absolute bottom-1.5 right-1.5 w-2 h-2 rounded-full" style={{ background: frame.status === 'perfect' ? '#10b981' : '#ef4444', boxShadow: frame.status === 'perfect' ? '0 0 6px #10b981' : 'none' }} />
      )}

      {frame.score !== undefined && !frame.narration && (
        <motion.div initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} className="absolute bottom-1.5 left-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: scoreColor(frame.score).bg, color: '#fff' }}>{frame.score}/10</motion.div>
      )}

      {frame.prominence_pct !== undefined && frame.prominence_pct > 0 && !frame.score && !frame.narration && (
        <div className="absolute bottom-1.5 left-1.5 text-[8px] font-mono px-1 py-0.5 rounded" style={{ background: 'rgba(0,0,0,0.65)', color: 'rgba(255,255,255,0.5)' }}>{frame.prominence_pct}%</div>
      )}

      {/* Lenstype approach label */}
      {frame.lens_type && frame.phase === 'approach' && !frame.narration && (
        <div className="absolute inset-x-0 bottom-0 text-[7px] font-mono text-center py-0.5 truncate" style={{ background: 'rgba(251,191,36,0.2)', color: '#fbbf24' }}>{frame.lens_type.replace('FOV', '').trim()}</div>
      )}

      {/* Narration Overlay */}
      {frame.narration && (
        <>
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent pointer-events-none" />
          <div className="absolute inset-x-0 bottom-0 p-1.5 flex flex-col justify-end">
            <div className="flex items-center gap-1.5 mb-1">
              {frame.score !== undefined && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: scoreColor(frame.score).bg, color: '#fff' }}>{frame.score}/10</span>
              )}
              {frame.prominence_pct !== undefined && frame.prominence_pct > 0 && (
                <span className="text-[8px] font-mono px-1 py-0.5 rounded bg-black/60 text-white/70">{frame.prominence_pct}%</span>
              )}
            </div>
            <p className="text-[8px] font-serif leading-tight text-white/90 line-clamp-3 text-shadow-sm" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}>
              {frame.narration}
            </p>
          </div>
        </>
      )}

      {frame.is_winner && (
        <div className="absolute top-0 right-0 left-0 h-0.5 rounded-t-lg" style={{ background: '#10b981' }} />
      )}
    </motion.div>
  );
}

export interface RefinementSectionProps {
  label: string;
  icon?: React.ReactNode;
  description?: string;
  frames: CapturedFrame[];
  discoveryFrames: CapturedFrame[];
  mapsApiKey: string;
  accentColor?: string;
  accentBorder?: string;
  labelColor?: string;
  showPlaceholder?: boolean;
}

export function RefinementSection({
  label,
  icon,
  description,
  frames,
  discoveryFrames,
  mapsApiKey,
  accentColor = 'transparent',
  accentBorder = 'transparent',
  labelColor = 'rgba(255,255,255,0.4)',
  showPlaceholder = false,
}: RefinementSectionProps) {
  const groups = new Map<string, CapturedFrame[]>();
  const ungrouped: CapturedFrame[] = [];

  for (const f of frames) {
    if (f.parent_pano_id) {
      const g = groups.get(f.parent_pano_id) ?? [];
      g.push(f);
      groups.set(f.parent_pano_id, g);
    } else {
      ungrouped.push(f);
    }
  }

  const groupedEntries = Array.from(groups.entries());

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl overflow-hidden" style={{ background: accentColor, border: `1px solid ${accentBorder || 'rgba(255,255,255,0.06)'}` }}>
      <div className="flex items-center gap-2 px-3 py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        {icon && <span style={{ color: labelColor }}>{icon}</span>}
        <div className="flex-1 min-w-0">
          <p className="text-[9px] font-mono font-semibold uppercase tracking-widest" style={{ color: labelColor }}>{label}</p>
          {description && <p className="text-[8px] font-mono mt-0.5 truncate" style={{ color: labelColor, opacity: 0.5 }}>{description}</p>}
        </div>
        <span className="text-[9px] font-mono" style={{ color: labelColor, opacity: 0.6 }}>{frames.length} shot{frames.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="p-2 flex flex-col gap-3">
        {groupedEntries.map(([parentId, groupFrames], groupIdx) => {
          const parent = discoveryFrames.find(f => f.pano_id === parentId);
          return (
            <div key={parentId}>
              {parent && (
                <div className="flex items-center gap-2 mb-1.5 px-0.5">
                  <div className="rounded-md overflow-hidden shrink-0 relative" style={{ width: 36, height: 24, border: '1px solid rgba(251,191,36,0.5)' }}>
                    <img src={svThumb(parent.pano_id, parent.heading, parent.fov, parent.pitch, mapsApiKey, '120x80')} alt={`Parent candidate #${parent.index}`} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.35)' }}>
                      <Star className="w-2 h-2 text-amber-400 fill-amber-400" />
                    </div>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[8px] font-mono font-semibold" style={{ color: labelColor }}>
                      Based on Candidate #{parent.index}
                      {parent.score !== undefined && <span className="ml-1 opacity-60">· score {parent.score}/10</span>}
                    </p>
                    {parent.prominence_pct !== undefined && <p className="text-[7px] font-mono opacity-50" style={{ color: labelColor }}>{parent.prominence_pct}% prominence → requesting better shots</p>}
                  </div>
                  {groupIdx < groupedEntries.length - 1 && <div className="ml-auto shrink-0 text-[9px] font-mono opacity-30" style={{ color: labelColor }}>#{groupIdx + 1}</div>}
                </div>
              )}
              <div className="grid gap-1.5" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                {groupFrames.map((frame, idx) => (
                  <FrameCard key={`${frame.pano_id}-${frame.fov}-${frame.phase}`} frame={frame} idx={idx} label={label} mapsApiKey={mapsApiKey} showParentInfo={false} parentFrame={parent ?? null} />
                ))}
              </div>
              {groupIdx < groupedEntries.length - 1 && <div className="mt-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.04)' }} />}
            </div>
          );
        })}

        {ungrouped.length > 0 && (
          <div className="grid gap-1.5" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            {ungrouped.map((frame, idx) => (
              <FrameCard key={`${frame.pano_id}-${frame.fov}-${frame.phase}`} frame={frame} idx={idx} label={label} mapsApiKey={mapsApiKey} />
            ))}
          </div>
        )}

        {showPlaceholder && (
          <motion.div animate={{ opacity: [0.3, 0.6, 0.3] }} transition={{ duration: 1.5, repeat: Infinity }} className="rounded-lg flex items-center justify-center" style={{ aspectRatio: '3/2', border: '1px dashed rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.02)', minHeight: 48 }}>
            <Loader className="w-4 h-4 text-white/15 animate-spin" />
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

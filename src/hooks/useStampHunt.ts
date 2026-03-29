import { useState, useCallback, useRef, useEffect } from 'react';
import { useAuth } from '@eb-packages/logic/src/hooks/useAuth';
import { useMiniGameEngine } from '@eb-packages/logic/src/hooks/useMiniGameEngine';
import type { FeedItem } from '../components/Postcard';

// ── Seeded random from string (deterministic positions per postcard) ────
function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return Math.abs(hash);
}

function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) & 0xffffffff;
    return (state >>> 0) / 0xffffffff;
  };
}

// ── Stamp position & difficulty ─────────────────────────────────────────
export interface StampPlacement {
  /** X position 0–1 (percentage of image width) */
  x: number;
  /** Y position 0–1 (percentage of image height) */
  y: number;
  /** Stamp size as fraction of image width (0.04 = small, 0.08 = large) */
  size: number;
  /** Rotation in degrees */
  rotation: number;
  /** Difficulty tier */
  difficulty: 'easy' | 'medium' | 'hard';
}

export function computeStampPlacement(postcardId: string): StampPlacement {
  const hash = hashCode(postcardId);
  const rng = seededRandom(hash);

  // Keep stamp away from edges (10%–90% range)
  const x = 0.10 + rng() * 0.80;
  const y = 0.10 + rng() * 0.80;
  const rotation = (rng() * 30) - 15; // -15° to +15°

  // Difficulty based on hash modulo
  const difficultyRoll = hash % 100;
  let difficulty: 'easy' | 'medium' | 'hard';
  let size: number;

  if (difficultyRoll < 30) {
    difficulty = 'easy';
    size = 0.09 + rng() * 0.02; // 9–11% of width
  } else if (difficultyRoll < 75) {
    difficulty = 'medium';
    size = 0.06 + rng() * 0.02; // 6–8% of width
  } else {
    difficulty = 'hard';
    size = 0.04 + rng() * 0.015; // 4–5.5% of width
  }

  return { x, y, size, rotation, difficulty };
}

// ═══════════════════════════════════════════════════════════════════════
// Hook: useStampHunt
// ═══════════════════════════════════════════════════════════════════════
export function useStampHunt(item: FeedItem) {
  const { user } = useAuth();
  
  const engine = useMiniGameEngine({
    gameType: 'stamp_hunt',
    userId: user?.id,
    autoStartTimer: true,
    loseCondition: (m) => m.elapsedSeconds >= 15,
  });

  const [placement, setPlacement] = useState(() => computeStampPlacement(item.id + Math.random().toString()));
  const [showReward, setShowReward] = useState(false);
  const [hintActive, setHintActive] = useState(false);
  
  const missCountRef = useRef(0);
  const found = engine.status === 'won';

  // Start engine if idle
  useEffect(() => {
    if (engine.status === 'idle') {
      engine.start();
    }
  }, [engine.status, engine]);

  // Dynamic difficult scaling
  useEffect(() => {
    if (engine.playerInfo && engine.playerInfo.level > 1) {
      setPlacement(prev => {
        let size = prev.size;
        let diff = prev.difficulty;
        if (engine.playerInfo!.level >= 5) {
          diff = 'hard';
          size = 0.04; // Very small
        } else if (engine.playerInfo!.level >= 3) {
          diff = 'medium';
          size = 0.06;
        } else {
          diff = 'easy';
          size = 0.09;
        }
        return { ...prev, size, difficulty: diff };
      });
    }
  }, [engine.playerInfo]); // Fixed missing dependency by watching the entire object, or engine.playerInfo

  // Auto-hint at 60 seconds
  useEffect(() => {
    if (found) return;
    if (engine.metrics.elapsedSeconds >= 60 && !hintActive && engine.metrics.hintsUsed === 0) {
      setHintActive(true);
      engine.useHint();
      setTimeout(() => setHintActive(false), 3000);
    }
  }, [engine.metrics.elapsedSeconds, found, hintActive, engine]);

  const handleImageClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (found) return;

    engine.registerClick();

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = (e.clientX - rect.left) / rect.width;
    const clickY = (e.clientY - rect.top) / rect.height;

    const tolerance = placement.size * 0.8;
    const dx = clickX - placement.x;
    const dy = clickY - placement.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist <= tolerance) {
      engine.win();
      setShowReward(true);
      setTimeout(() => setShowReward(false), 3500);
    } else {
      missCountRef.current += 1;
      if (missCountRef.current >= 5 && !hintActive) {
        setHintActive(true);
        engine.useHint();
        missCountRef.current = 0;
        setTimeout(() => setHintActive(false), 2000);
      }
    }
  }, [found, placement, engine, hintActive]);

  return {
    placement,
    found,
    tapsCount: engine.metrics.clicks,
    hintsUsed: engine.metrics.hintsUsed,
    hintActive,
    showReward,
    elapsedSeconds: engine.metrics.elapsedSeconds,
    status: engine.status,
    handleImageClick,
  };
}

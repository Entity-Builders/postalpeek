import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, Star, Puzzle } from 'lucide-react';
import { useAuth } from '@entity-builders/logic/src/hooks/useAuth';
import { useMiniGameEngine } from '@entity-builders/logic/src/hooks/useMiniGameEngine';
import type { FeedItem } from './Postcard';
import { NextGameCountdown } from './NextGameCountdown';
import { GameTimerBar } from './GameTimerBar';
import { t } from '../utils/i18n';

// ── Types ──────────────────────────────────────────────────────────────

interface PuzzlePiece {
  /** Current position index (0..(N*N-1)) */
  currentPos: number;
  /** Original/correct position index */
  correctPos: number;
}

// ── Shuffle utility — Fisher-Yates, guaranteed solvable ────────────────
function createShuffledPieces(size: number): PuzzlePiece[] {
  const total = size * size;
  const indices = Array.from({ length: total }, (_, i) => i);

  // Fisher-Yates shuffle
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }

  // If nothing moved, force a swap so the puzzle is not already solved
  const isSolved = indices.every((v, i) => v === i);
  if (isSolved) {
    [indices[0], indices[1]] = [indices[1], indices[0]];
  }

  return indices.map((correctPos, currentPos) => ({
    currentPos,
    correctPos,
  }));
}

// ═══════════════════════════════════════════════════════════════════════
// Hook: usePostcardPuzzle — encapsulates all puzzle state
// ═══════════════════════════════════════════════════════════════════════
export function usePostcardPuzzle(item: FeedItem) {
  const { user } = useAuth();
  
  const engine = useMiniGameEngine({
    gameType: 'puzzle',
    userId: user?.id,
    loseCondition: (m) => m.elapsedSeconds >= 45,
  });

  const [gridSize, setGridSize] = useState(3);
  const [pieces, setPieces] = useState<PuzzlePiece[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(true);
  const [isPeeking, setIsPeeking] = useState(false);

  const initRef = useRef<string | null>(null);

  const total = gridSize * gridSize;
  const isComplete = engine.status === 'won';

  const correctCount = useMemo(
    () => pieces.filter((p) => p.currentPos === p.correctPos).length,
    [pieces],
  );

  // Store engine functions in refs so we don't need them in dependency arrays
  // (which would cause re-renders because `engine` updates every second tick)
  const engineStartRef = useRef(engine.start);
  engineStartRef.current = engine.start;
  const engineWinRef = useRef(engine.win);
  engineWinRef.current = engine.win;

  // Initialize: wait for playerInfo, show preview, then shuffle and start
  useEffect(() => {
    if (!engine.playerInfo || initRef.current === item.id) return;
    initRef.current = item.id;
    
    setIsPreviewing(true);
    setSelectedIndex(null);

    const size = engine.playerInfo.level >= 5 ? 4 : engine.playerInfo.level === 1 ? 2 : 3;
    setGridSize(size);

    const timer = setTimeout(() => {
      setPieces(createShuffledPieces(size));
      setIsPreviewing(false);
      engineStartRef.current();
    }, 2500);

    return () => clearTimeout(timer);
  }, [engine.playerInfo, item.id]);

  // Check completion declaratively
  useEffect(() => {
    if (pieces.length === 0 || isPreviewing || isComplete) return;
    const allCorrect = pieces.every((p) => p.currentPos === p.correctPos);
    if (allCorrect) {
      engineWinRef.current();
    }
  }, [pieces, isPreviewing, isComplete]);

  const handleTileTap = useCallback(
    (tileIndex: number) => {
      if (isComplete || isPreviewing || isPeeking) return;

      if (selectedIndex === null) {
        setSelectedIndex(tileIndex);
      } else if (selectedIndex === tileIndex) {
        setSelectedIndex(null);
      } else {
        setPieces((prev) => prev.map((p) => {
            if (p.currentPos === selectedIndex) return { ...p, currentPos: tileIndex };
            if (p.currentPos === tileIndex) return { ...p, currentPos: selectedIndex };
            return p;
        }));
        engine.registerClick();
        setSelectedIndex(null);
      }
    },
    [selectedIndex, isComplete, isPreviewing, isPeeking, engine],
  );

  const handlePeek = useCallback(() => {
    if (isPeeking || isComplete) return;
    setIsPeeking(true);
    engine.useHint();
    setTimeout(() => setIsPeeking(false), 2000);
  }, [isPeeking, isComplete, engine]);

  return {
    pieces,
    selectedIndex,
    moves: engine.metrics.clicks,
    isComplete,
    isPreviewing,
    isPeeking,
    peeksUsed: engine.metrics.hintsUsed,
    correctCount,
    total,
    gridSize,
    handleTileTap,
    handlePeek,
    elapsedSeconds: engine.metrics.elapsedSeconds,
    status: engine.status,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// Component: PuzzleImageOverlay — renders the puzzle grid over the image
// ═══════════════════════════════════════════════════════════════════════
interface PuzzleImageOverlayProps {
  puzzle: ReturnType<typeof usePostcardPuzzle>;
  imageUrl: string;
}

export function PuzzleImageOverlay({ puzzle, imageUrl }: PuzzleImageOverlayProps) {
  const { pieces, selectedIndex, isPreviewing, isPeeking, gridSize, handleTileTap, isComplete } = puzzle;

  // During preview or peeking, show the full image
  if (isPreviewing || isPeeking) {
    return (
      <div className="absolute inset-0 z-20">
        {/* Full image shown — with a label */}
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none"
          >
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-black/50 backdrop-blur-sm shadow-lg">
              <Eye className="w-4 h-4 text-white" />
              <span className="text-white text-xs font-semibold">
                {isPreviewing
                  ? t({ es: 'Memoriza la imagen...', en: 'Memorize the image...' })
                  : t({ es: 'Pista — original', en: 'Hint — original' })}
              </span>
            </div>
          </motion.div>
        </AnimatePresence>
        {isPreviewing && (
          <motion.div
            className="absolute bottom-0 left-0 h-1 bg-amber-400 z-40"
            initial={{ width: '100%' }}
            animate={{ width: '0%' }}
            transition={{ duration: 2.5, ease: 'linear' }}
          />
        )}
      </div>
    );
  }

  // During completion, show full image with celebration
  if (isComplete) {
    return (
      <div className="absolute inset-0 z-20 pointer-events-none">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 flex items-center justify-center"
        >
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15 }}
            className="flex items-center gap-2 px-5 py-3 rounded-full shadow-2xl backdrop-blur-md"
            style={{
              background: 'linear-gradient(135deg, rgba(16,185,129,0.9) 0%, rgba(5,150,105,0.95) 100%)',
              border: '1px solid rgba(255,255,255,0.25)',
            }}
          >
            <span className="text-lg">🧩</span>
            <span className="text-white font-bold text-sm tracking-tight">
              {t({ es: '¡Completado!', en: 'Complete!' })}
            </span>
          </motion.div>
        </motion.div>
      </div>
    );
  }

  // Puzzle grid
  const gapPx = 2;
  const tileSizePct = 100 / gridSize;

  return (
    <div className="absolute inset-0 z-20 bg-stone-900">
      {/* Puzzle tiles */}
      {pieces.map((piece) => {
        // Where this piece IS now (currentPos) → visual position
        const visualRow = Math.floor(piece.currentPos / gridSize);
        const visualCol = piece.currentPos % gridSize;
        // Where this piece BELONGS (correctPos) → image crop
        const srcRow = Math.floor(piece.correctPos / gridSize);
        const srcCol = piece.correctPos % gridSize;

        const isSelected = selectedIndex === piece.currentPos;
        const isCorrect = piece.currentPos === piece.correctPos;

        return (
          <motion.div
            key={`piece-${piece.correctPos}`}
            initial={false}
            animate={{
              left: `calc(${visualCol * tileSizePct}% + ${gapPx / 2}px)`,
              top: `calc(${visualRow * tileSizePct}% + ${gapPx / 2}px)`,
              scale: isSelected ? 1.04 : 1,
              boxShadow: isSelected
                ? '0 0 0 3px rgba(59,130,246,0.8), 0 4px 12px rgba(0,0,0,0.3)'
                : '0 1px 3px rgba(0,0,0,0.4)',
              borderColor: isSelected
                ? 'rgba(59,130,246,0.9)'
                : isCorrect
                  ? 'rgba(16,185,129,0.5)'
                  : 'rgba(255,255,255,0.1)',
            }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className={`absolute cursor-pointer border hover:brightness-105 ${isSelected || isCorrect ? 'border-2' : 'border'}`}
            style={{
              width: `calc(${tileSizePct}% - ${gapPx}px)`,
              height: `calc(${tileSizePct}% - ${gapPx}px)`,
              backgroundImage: `url(${imageUrl})`,
              backgroundSize: `${gridSize * 100}% ${gridSize * 100}%`,
              backgroundPosition: `${(srcCol / (gridSize - 1)) * 100}% ${(srcRow / (gridSize - 1)) * 100}%`,
              borderRadius: '6px',
              borderStyle: 'solid',
              zIndex: isSelected ? 10 : 1,
            }}
            onClick={(e) => {
              e.stopPropagation();
              handleTileTap(piece.currentPos);
            }}
          />
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Component: PuzzleBottomPanel — shows during puzzle gameplay
// ═══════════════════════════════════════════════════════════════════════
interface PuzzleBottomPanelProps {
  item: FeedItem;
  puzzle: ReturnType<typeof usePostcardPuzzle>;
  onClose: (won: boolean, elapsedSeconds: number) => void;
}

export function PuzzleBottomPanel({ puzzle, onClose }: PuzzleBottomPanelProps) {
  const {
    moves,
    correctCount,
    total,
    isComplete,
    isPreviewing,
    handlePeek,
    isPeeking,
    elapsedSeconds,
    status,
  } = puzzle;

  // Star rating based on moves (for 3×3, optimal ~9 swaps)
  const starRating = moves <= 12 ? 3 : moves <= 20 ? 2 : 1;

  // ── Complete state ──
  if (isComplete || status === 'won') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm mx-auto pointer-events-auto bg-white/95 backdrop-blur-md rounded-2xl p-3 shadow-lg border border-emerald-500/30"
      >
        <GameTimerBar elapsedSeconds={elapsedSeconds} maxSeconds={45} status="won" />

        {/* Compact stats + Listo button */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="flex items-center gap-3"
        >
          <div className="flex items-center gap-1.5">
            <Puzzle className="w-3.5 h-3.5 text-emerald-500" />
            <span className="text-stone-700 text-xs font-bold tabular-nums">
              {moves} {t({ es: 'mov.', en: 'moves' })}
            </span>
          </div>
          <div className="w-px h-3 bg-stone-200" />
          <div className="flex items-center gap-0.5">
            {[1, 2, 3].map((i) => (
              <Star
                key={i}
                className={`w-3.5 h-3.5 ${
                  i <= starRating ? 'text-amber-400 fill-amber-400' : 'text-stone-300'
                }`}
              />
            ))}
          </div>

          <div className="flex-1" />
          <NextGameCountdown seconds={3} onAdvance={() => onClose(true, elapsedSeconds)} />
        </motion.div>
      </motion.div>
    );
  }

  // ── Lost state ──
  if (status === 'lost') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm mx-auto pointer-events-auto bg-white/95 backdrop-blur-md rounded-2xl p-3 shadow-lg border border-red-500/50"
      >
        <GameTimerBar elapsedSeconds={elapsedSeconds} maxSeconds={45} status="lost" />
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="flex items-center gap-3"
        >
          <div className="flex items-center gap-1.5 text-red-600">
            <span className="text-xl">👎</span>
            <span className="text-sm font-bold">{t({ es: '¡Intenta más rápido!', en: 'Try faster!' })}</span>
          </div>
          <div className="flex-1" />
          <button
            onClick={() => onClose(false, elapsedSeconds)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-stone-900 text-white font-bold text-sm"
          >
            {t({ es: 'Continuar', en: 'Continue' })}
          </button>
        </motion.div>
      </motion.div>
    );
  }

  // ── In-progress state ──
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      className="w-full max-w-sm mx-auto pointer-events-auto bg-white/95 backdrop-blur-md rounded-2xl p-4 shadow-lg border border-white/50"
    >
      {/* Progress bar */}
      <div className="mb-2">
        <div className="flex items-center justify-between mb-1">
          {/* Status */}
          {isPreviewing ? (
            <div className="flex items-center gap-1.5 text-amber-600 text-xs font-medium">
              <Eye className="w-3 h-3" />
              <span>{t({ es: 'Memoriza...', en: 'Memorize...' })}</span>
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-1.5"
            >
              <Puzzle className="w-3.5 h-3.5 text-blue-500" />
              <span className="text-stone-800 text-xs font-semibold">
                {t({ es: 'Movimientos:', en: 'Moves:' })}{' '}
                <span className="text-blue-600 tabular-nums">{moves}</span>
              </span>
            </motion.div>
          )}

          {/* Score + buttons */}
          <div className="flex items-center gap-2 shrink-0">
            {!isPreviewing && (
              <>
                <span className="text-xs font-bold text-stone-500 tabular-nums">
                  {correctCount}/{total}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePeek();
                  }}
                  disabled={isPeeking}
                  className="flex items-center gap-1 px-2 py-1 rounded-full bg-blue-100 hover:bg-blue-200 text-blue-600 text-[11px] font-semibold transition-all disabled:opacity-40"
                >
                  <Eye className="w-3 h-3" />
                  {t({ es: 'Ver', en: 'Peek' })}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Visual progress bar */}
        {!isPreviewing && (
          <GameTimerBar elapsedSeconds={elapsedSeconds} maxSeconds={45} status={status} />
        )}
      </div>
    </motion.div>
  );
}

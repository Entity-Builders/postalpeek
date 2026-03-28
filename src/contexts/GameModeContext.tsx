import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';

interface GameModeContextType {
  isGameActive: boolean;
  setGameActive: (active: boolean) => void;
}

const GameModeContext = createContext<GameModeContextType | null>(null);

export function GameModeProvider({ children }: { children: ReactNode }) {
  const [isGameActive, setIsGameActive] = useState(false);

  const setGameActive = useCallback((active: boolean) => {
    setIsGameActive(active);
  }, []);

  return (
    <GameModeContext.Provider value={{ isGameActive, setGameActive }}>
      {children}
    </GameModeContext.Provider>
  );
}

export function useGameMode() {
  const context = useContext(GameModeContext);
  if (!context) {
    throw new Error('useGameMode must be used within a GameModeProvider');
  }
  return context;
}

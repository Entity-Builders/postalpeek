import React, { createContext, useContext } from 'react';
import { useStamps, UseStampsReturn } from '../hooks/useStamps';

const StampContext = createContext<UseStampsReturn | null>(null);

export function StampProvider({ children, userId }: { children: React.ReactNode; userId?: string | null }) {
  const stampData = useStamps(userId);
  return <StampContext.Provider value={stampData}>{children}</StampContext.Provider>;
}

export function useStampContext() {
  const context = useContext(StampContext);
  if (!context) {
    throw new Error('useStampContext must be used within a StampProvider');
  }
  return context;
}

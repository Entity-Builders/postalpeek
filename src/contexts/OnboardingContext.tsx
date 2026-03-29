import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ONBOARDING_KEY = '@postalpeek_onboarding_completed';

export type TutorialStep = 'welcome' | 'carousel' | 'game' | 'done';

interface OnboardingState {
  hasCompleted: boolean | null;
  tutorialStep: TutorialStep;
  tutorialStamps: number;
  setTutorialStep: (step: TutorialStep) => void;
  setTutorialStamps: (amount: number | ((prev: number) => number)) => void;
  completeOnboarding: () => Promise<void>;
  resetOnboarding: () => Promise<void>;
}

const OnboardingContext = createContext<OnboardingState | null>(null);

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [hasCompleted, setHasCompleted] = useState<boolean | null>(null);
  const [tutorialStep, setTutorialStep] = useState<TutorialStep>('welcome');
  const [tutorialStamps, setTutorialStamps] = useState(0);

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_KEY)
      .then(val => {
        setHasCompleted(val === 'true');
      })
      .catch(() => setHasCompleted(false));
  }, []);

  const completeOnboarding = useCallback(async () => {
    try {
      await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
      setHasCompleted(true);
      setTutorialStep('done');
    } catch (e) {
      console.error('Failed to save onboarding state', e);
    }
  }, []);

  const resetOnboarding = useCallback(async () => {
    try {
      await AsyncStorage.removeItem(ONBOARDING_KEY);
      setHasCompleted(false);
      setTutorialStep('welcome');
      setTutorialStamps(0);
    } catch (e) {
      console.error('Failed to reset onboarding state', e);
    }
  }, []);

  return (
    <OnboardingContext.Provider
      value={{
        hasCompleted,
        tutorialStep,
        tutorialStamps,
        setTutorialStep,
        setTutorialStamps,
        completeOnboarding,
        resetOnboarding
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error('useOnboarding must be used within an OnboardingProvider');
  }
  return context;
}

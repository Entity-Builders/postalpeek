import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { t, useLang } from '../utils/i18n';
import confetti from 'canvas-confetti';

interface TriviaBottomPanelProps {
  trivia: any;
  onResolve: () => void;
  isClaimLoading?: boolean;
  isTriviaLocked?: boolean;
  onClose?: () => void;
}

export function TriviaBottomPanel({
  trivia,
  onResolve,
  isClaimLoading,
  isTriviaLocked,
  onClose,
}: TriviaBottomPanelProps) {
  const lang = useLang();
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const question = trivia?.question?.[lang] || trivia?.question?.['en'] || 'Question missing';
  
  let options: string[] = [];
  let correctAnswer = '';

  if (Array.isArray(trivia?.options)) {
    // New format (from prompt_v2): Array of objects { text: { en, es }, isCorrect: boolean }
    options = trivia.options.map((o: any) => {
      const text = o.text?.[lang] || o.text?.['en'] || '';
      if (o.isCorrect) correctAnswer = text;
      return text;
    }).filter(Boolean);
  } else {
    // Legacy format: Object { en: string[], es: string[] }
    options = trivia?.options?.[lang] || trivia?.options?.['en'] || [];
    correctAnswer = trivia?.correct_answer?.[lang] || trivia?.correct_answer?.['en'] || '';
  }

  const handleSelect = (opt: string) => {
    if (isSuccess || isError || isClaimLoading) return;
    
    setSelectedOption(opt);
    if (opt === correctAnswer) {
      setIsSuccess(true);
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
      setTimeout(() => {
        onResolve();
      }, 1500);
    } else {
      setIsError(true);
      setTimeout(() => {
        setIsError(false);
        setSelectedOption(null);
      }, 1000);
    }
  };

  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      className="absolute bottom-0 left-0 right-0 z-30 bg-white rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.15)] pb-safe pt-5 px-5"
    >
      <div className="flex flex-col gap-4 pb-4">
        {/* Header row for Close button if applicable */}
        {onClose && !isTriviaLocked && (
          <div className="flex items-center justify-between mb-[-4px]">
            <h3 className="text-lg font-bold text-stone-800">
              {t({ es: 'Trivia Local', en: 'Local Trivia' }, lang)}
            </h3>
            <button
              onClick={onClose}
              className="p-1 -mr-2 rounded-full text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors"
            >
              <XCircle className="w-6 h-6" />
            </button>
          </div>
        )}

        <div className="flex bg-amber-50 rounded-xl p-4 border border-amber-200">
          <div className="flex-1 pr-2">
            {isTriviaLocked && (
              <h3 className="text-sm font-bold text-amber-900 leading-tight mb-1.5">
                {t({ es: '¡Descubre la postal!', en: 'Reveal the postcard!' }, lang)}
              </h3>
            )}
            <p className="text-[15px] text-stone-800 font-medium leading-snug">
              {question}
            </p>
          </div>
          <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center shrink-0 shadow-sm border border-amber-200/50">
            <span className="text-2xl">🗺️</span>
          </div>
        </div>

        <div className="flex flex-col gap-2 mt-1">
          {options.map((opt: string) => {
            const isSelected = selectedOption === opt;
            const isCorrect = isSelected && isSuccess;
            const isWrong = isSelected && isError;

            let stateClass = 'bg-stone-50 border-stone-200 text-stone-800 hover:bg-stone-100';
            let Icon = null;

            if (isCorrect) {
              stateClass = 'bg-green-50 border-green-500 text-green-800';
              Icon = CheckCircle;
            } else if (isWrong) {
              stateClass = 'bg-red-50 border-red-500 text-red-800';
              Icon = XCircle;
            } else if (isSelected) {
              stateClass = 'bg-indigo-50 border-indigo-300 text-indigo-800';
            }

            return (
              <motion.button
                key={opt}
                animate={isWrong ? { x: [-5, 5, -5, 5, 0] } : {}}
                transition={{ duration: 0.4 }}
                onClick={() => handleSelect(opt)}
                disabled={isSuccess || isClaimLoading}
                className={`relative flex items-center p-3.5 rounded-xl border-2 transition-all font-semibold text-left ${stateClass}`}
              >
                <div className="flex-1 pr-8">
                  <span className="leading-snug block">{opt}</span>
                </div>
                {Icon && (
                  <div className="absolute right-4 top-1/2 -translate-y-1/2">
                    <Icon className="w-5 h-5" />
                  </div>
                )}
                {isCorrect && isClaimLoading && (
                  <div className="absolute right-4 top-1/2 -translate-y-1/2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                  </div>
                )}
              </motion.button>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}

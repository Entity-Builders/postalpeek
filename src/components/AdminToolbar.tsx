import React, { useState, useCallback, useEffect } from 'react';
import { supabase } from '@eb-packages/logic/src/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { t } from '../utils/i18n';

interface AdminToolbarProps {
  isAdmin: boolean;
  onPostcardGenerated?: () => void;
}

type GenerationStatus = 'idle' | 'generating' | 'success' | 'error';

interface GenerationResult {
  status: GenerationStatus;
  message: string;
  data?: {
    postcard_id: string;
    location: string;
    city: string;
    country: string;
    category: string;
    description: string;
    visual_tags: string[];
    detailed_tags_count: number;
    scene_type: string | null;
    strategy: string;
  };
}

export function AdminToolbar({
  isAdmin,
  onPostcardGenerated,
}: AdminToolbarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [result, setResult] = useState<GenerationResult>({
    status: 'idle',
    message: '',
  });

  const triggerWander = useCallback(async () => {
    setResult({ status: 'generating', message: 'Generating postcard...' });

    try {
      const { data, error } = await supabase.functions.invoke(
        'postalpeek-walker-wander',
        { body: {}, headers: {} },
      );

      if (error) throw error;

      if (data?.success && data?.data) {
        setResult({
          status: 'success',
          message: `✅ ${data.data.location}`,
          data: data.data,
        });
        onPostcardGenerated?.();
      } else if (data?.skipped) {
        // Local environment skip — retry with force
        const forceRes = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321'}/functions/v1/postalpeek-walker-wander?force=true`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WO7o6oSc4wYjSnO28-VRLNxMEnOj9aQREp8o'}`,
            },
            body: JSON.stringify({}),
          },
        );
        const forceData = await forceRes.json();

        if (forceData?.success && forceData?.data) {
          setResult({
            status: 'success',
            message: `✅ ${forceData.data.location}`,
            data: forceData.data,
          });
          onPostcardGenerated?.();
        } else {
          throw new Error(forceData?.error || 'Unknown error');
        }
      } else {
        throw new Error(data?.error || 'Unknown error');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setResult({ status: 'error', message: `❌ ${msg}` });
    }
  }, [onPostcardGenerated]);

  const triggerTrip = useCallback(async () => {
    setResult({ status: 'generating', message: 'Generating trip postcard...' });

    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321'}/functions/v1/postalpeek-walker-trip?force=true`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WO7o6oSc4wYjSnO28-VRLNxMEnOj9aQREp8o'}`,
          },
          body: JSON.stringify({}),
        },
      );
      const data = await res.json();

      if (data?.success) {
        setResult({
          status: 'success',
          message: `✅ Trip: ${data.postcards_created || 0} postcards created`,
        });
        onPostcardGenerated?.();
      } else {
        throw new Error(data?.error || 'Trip generation failed');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setResult({ status: 'error', message: `❌ ${msg}` });
    }
  }, [onPostcardGenerated]);

  // --- Enrichment stats ---
  const [unenrichedCount, setUnenrichedCount] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen || !isAdmin) return;
    // Fetch count of postcards missing detailed_tags
    supabase
      .from('postalpeek_postcards')
      .select('id', { count: 'exact', head: true })
      .is('detailed_tags', null)
      .then(({ count }) => setUnenrichedCount(count ?? 0));
  }, [isOpen, isAdmin]);

  const copyEnrichCommand = useCallback(() => {
    const cmd = unenrichedCount && unenrichedCount > 20
      ? `yarn workspace postalpeek enrich:collection --limit 20`
      : `yarn workspace postalpeek enrich:collection`;
    navigator.clipboard.writeText(cmd);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [unenrichedCount]);

  if (!isAdmin) return null;

  return (
    <>
      {/* Floating admin toggle button */}
      <motion.button
        onClick={() => setIsOpen((prev) => !prev)}
        className='fixed top-4 right-4 z-[9999] w-10 h-10 rounded-full flex items-center justify-center shadow-lg backdrop-blur-md border'
        style={{
          background: isOpen
            ? 'rgba(239, 68, 68, 0.8)'
            : 'rgba(99, 102, 241, 0.8)',
          borderColor: isOpen
            ? 'rgba(239, 68, 68, 0.4)'
            : 'rgba(99, 102, 241, 0.4)',
        }}
        whileTap={{ scale: 0.9 }}
        title='Admin Panel'
      >
        <span className='text-white text-lg'>{isOpen ? '✕' : '⚡'}</span>
      </motion.button>

      {/* Admin panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className='fixed top-16 right-4 z-[9998] w-72 rounded-2xl shadow-2xl backdrop-blur-xl border overflow-hidden'
            style={{
              background: 'rgba(15, 15, 25, 0.9)',
              borderColor: 'rgba(99, 102, 241, 0.2)',
            }}
          >
            {/* Header */}
            <div
              className='px-4 py-3 border-b'
              style={{ borderColor: 'rgba(255,255,255,0.08)' }}
            >
              <div className='flex items-center gap-2'>
                <span className='inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse' />
                <span className='text-white/90 text-sm font-medium tracking-wide'>
                  Admin Panel
                </span>
              </div>
            </div>

            {/* Generation Actions */}
            <div className='p-3 space-y-2'>
              <button
                onClick={triggerWander}
                disabled={result.status === 'generating'}
                className='w-full px-4 py-2.5 rounded-xl text-sm font-medium text-white transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2'
                style={{
                  background:
                    'linear-gradient(135deg, rgba(99, 102, 241, 0.6), rgba(139, 92, 246, 0.6))',
                }}
              >
                <span>🌍</span>
                <span>Generate Wander Postcard</span>
              </button>

              <button
                onClick={triggerTrip}
                disabled={result.status === 'generating'}
                className='w-full px-4 py-2.5 rounded-xl text-sm font-medium text-white transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2'
                style={{
                  background:
                    'linear-gradient(135deg, rgba(16, 185, 129, 0.6), rgba(5, 150, 105, 0.6))',
                }}
              >
                <span>✈️</span>
                <span>Generate Trip Postcard</span>
              </button>
            </div>

            {/* Enrichment Section */}
            <div
              className='px-4 py-3 border-t'
              style={{ borderColor: 'rgba(255,255,255,0.06)' }}
            >
              <div className='flex items-center justify-between mb-2'>
                <span className='text-white/60 text-xs font-medium tracking-wide uppercase'>
                  Enrichment
                </span>
                {unenrichedCount !== null && (
                  <span
                    className='text-[10px] px-2 py-0.5 rounded-full font-mono'
                    style={{
                      background:
                        unenrichedCount === 0
                          ? 'rgba(16, 185, 129, 0.2)'
                          : 'rgba(251, 191, 36, 0.2)',
                      color:
                        unenrichedCount === 0
                          ? 'rgb(110, 231, 183)'
                          : 'rgb(253, 224, 71)',
                    }}
                  >
                    {unenrichedCount === 0
                      ? '✅ All enriched'
                      : `${unenrichedCount} pending`}
                  </span>
                )}
              </div>
              {unenrichedCount !== null && unenrichedCount > 0 && (
                <button
                  onClick={copyEnrichCommand}
                  className='w-full px-3 py-2 rounded-lg text-xs text-white/70 transition-all duration-200 flex items-center gap-2 hover:text-white/90'
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                  }}
                >
                  <span>{copied ? '✅' : '📋'}</span>
                  <span className='font-mono truncate'>
                    {copied
                      ? 'Copied!'
                      : `yarn workspace postalpeek enrich:collection`}
                  </span>
                </button>
              )}
            </div>

            {/* Status */}
            <AnimatePresence mode='wait'>
              {result.status !== 'idle' && (
                <motion.div
                  key={result.status + result.message}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className='px-4 pb-3'
                >
                  <div
                    className='px-3 py-2 rounded-lg text-xs'
                    style={{
                      background:
                        result.status === 'generating'
                          ? 'rgba(99, 102, 241, 0.15)'
                          : result.status === 'success'
                            ? 'rgba(16, 185, 129, 0.15)'
                            : 'rgba(239, 68, 68, 0.15)',
                      color:
                        result.status === 'generating'
                          ? 'rgba(165, 180, 252, 1)'
                          : result.status === 'success'
                            ? 'rgba(110, 231, 183, 1)'
                            : 'rgba(252, 165, 165, 1)',
                    }}
                  >
                    {result.status === 'generating' && (
                      <div className='flex items-center gap-2'>
                        <div className='w-3 h-3 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin' />
                        <span>{result.message}</span>
                      </div>
                    )}
                    {result.status === 'success' && (
                      <div>
                        <p className='font-medium'>{result.message}</p>
                        {result.data && (
                          <div className='mt-1.5 space-y-1 text-[10px]'>
                            <p className='text-white/40 font-mono'>
                              {result.data.postcard_id}
                            </p>
                            <p className='text-white/60'>
                              📍 {result.data.city}, {result.data.country}
                            </p>
                            <p className='text-white/50'>
                              {t(result.data.category)} ·{' '}
                              {result.data.scene_type?.replace(/_/g, ' ') ||
                                '—'}
                            </p>
                            <p className='text-white/40'>
                              🏷️ {result.data.detailed_tags_count} tags · 🎲{' '}
                              {result.data.strategy}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                    {result.status === 'error' && <p>{result.message}</p>}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

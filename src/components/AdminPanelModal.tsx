import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@eb-packages/logic/src/supabase';
import type { User } from '@supabase/supabase-js';

// ── Types ──────────────────────────────────────────────────────────────

interface AdminPanelModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  onPostcardGenerated?: () => void;
}

interface UserStats {
  collectionCount: number;
  totalPostcards: number;
  unenrichedCount: number;
  noIllustrationTagsCount: number;
  dailyPackToday: boolean;
  albumsCount: number;
  albumsCompleted: number;
}

type Tab = 'data' | 'user-actions' | 'postcard-actions' | 'generation';

type ActionStatus = 'idle' | 'loading' | 'success' | 'error';

// ── Helpers ────────────────────────────────────────────────────────────

function StatusBadge({ status, message }: { status: ActionStatus; message: string }) {
  if (status === 'idle') return null;

  const colors = {
    loading: { bg: 'rgba(99,102,241,0.15)', text: 'rgb(165,180,252)' },
    success: { bg: 'rgba(16,185,129,0.15)', text: 'rgb(110,231,183)' },
    error: { bg: 'rgba(239,68,68,0.15)', text: 'rgb(252,165,165)' },
  };

  const c = colors[status];
  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-2 px-3 py-2 rounded-lg text-xs flex items-center gap-2"
      style={{ background: c.bg, color: c.text }}
    >
      {status === 'loading' && (
        <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
      )}
      {status === 'success' && '✅'}
      {status === 'error' && '❌'}
      <span>{message}</span>
    </motion.div>
  );
}

function StatRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
      <span className="text-white/50 text-xs">{label}</span>
      <span className="text-white/90 text-xs font-mono">{value}</span>
    </div>
  );
}

function DangerButton({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full px-4 py-2.5 rounded-xl text-sm font-medium text-white transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 hover:brightness-110"
      style={{
        background: 'linear-gradient(135deg, rgba(239,68,68,0.5), rgba(220,38,38,0.5))',
        border: '1px solid rgba(239,68,68,0.2)',
      }}
    >
      {children}
    </button>
  );
}

function ActionButton({
  onClick,
  disabled,
  children,
  gradient = 'linear-gradient(135deg, rgba(99,102,241,0.6), rgba(139,92,246,0.6))',
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  gradient?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full px-4 py-2.5 rounded-xl text-sm font-medium text-white transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 hover:brightness-110"
      style={{ background: gradient }}
    >
      {children}
    </button>
  );
}

// ── Main Component ─────────────────────────────────────────────────────

export function AdminPanelModal({ isOpen, onClose, user, onPostcardGenerated }: AdminPanelModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>('data');
  const [stats, setStats] = useState<UserStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // Action statuses
  const [actionStatus, setActionStatus] = useState<{ status: ActionStatus; message: string }>({
    status: 'idle',
    message: '',
  });

  // Postcard ID input
  const [postcardId, setPostcardId] = useState('');

  // Generation
  const [genStatus, setGenStatus] = useState<{ status: ActionStatus; message: string }>({
    status: 'idle',
    message: '',
  });

  // Enrichment
  const [copied, setCopied] = useState(false);

  // Backfill
  const [backfillStatus, setBackfillStatus] = useState<{ status: ActionStatus; message: string }>({
    status: 'idle',
    message: '',
  });

  // ── Fetch user stats ──

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const userId = user?.id;

      // Parallel queries
      const [collectionRes, totalRes, unenrichedRes, noIllTagsRes, dailyPackRes, albumsRes] =
        await Promise.all([
          userId
            ? supabase
                .from('postalpeek_postcards')
                .select('id', { count: 'exact', head: true })
                .eq('owner_id', userId)
            : Promise.resolve({ count: 0 }),
          supabase.from('postalpeek_postcards').select('id', { count: 'exact', head: true }),
          supabase
            .from('postalpeek_postcards')
            .select('id', { count: 'exact', head: true })
            .is('detailed_tags', null),
          supabase
            .from('postalpeek_postcards')
            .select('id', { count: 'exact', head: true })
            .not('illustration_url', 'is', null)
            .or('illustration_tags.is.null,illustration_tags.eq.[]'),
          userId
            ? supabase
                .from('postalpeek_daily_packs')
                .select('id')
                .eq('user_id', userId)
                .gte('opened_at', new Date().toISOString().slice(0, 10))
                .maybeSingle()
            : Promise.resolve({ data: null }),
          supabase.from('postalpeek_albums').select('id, completed_at', { count: 'exact' }),
        ]);

      const albumsCompleted =
        (albumsRes.data as { id: string; completed_at: string | null }[] | null)?.filter(
          (a) => a.completed_at,
        ).length ?? 0;

      setStats({
        collectionCount: (collectionRes as { count: number | null }).count ?? 0,
        totalPostcards: (totalRes as { count: number | null }).count ?? 0,
        unenrichedCount: (unenrichedRes as { count: number | null }).count ?? 0,
        noIllustrationTagsCount: (noIllTagsRes as { count: number | null }).count ?? 0,
        dailyPackToday: !!dailyPackRes.data,
        albumsCount: (albumsRes as { count: number | null }).count ?? 0,
        albumsCompleted,
      });
    } catch (err) {
      console.error('Failed to fetch admin stats', err);
    } finally {
      setStatsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (isOpen) fetchStats();
  }, [isOpen, fetchStats]);

  // ── User Actions ──

  const resetClaimLimits = useCallback(async () => {
    if (!user?.id) return;
    setActionStatus({ status: 'loading', message: 'Resetting claim limits...' });
    try {
      const { error } = await supabase.rpc('postalpeek_admin_reset_claims', {
        p_user_id: user.id,
      });
      if (error) throw error;
      setActionStatus({ status: 'success', message: 'Claim limits reset ✅' });
      fetchStats();
    } catch (err: unknown) {
      setActionStatus({
        status: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }, [user?.id, fetchStats]);

  const unclaimAllPostcards = useCallback(async () => {
    if (!user?.id) return;
    if (!confirm('This will remove ownership of ALL postcards for this user. Are you sure?')) return;
    setActionStatus({ status: 'loading', message: 'Unclaiming all postcards...' });
    try {
      const { data, error } = await supabase.rpc('postalpeek_admin_unclaim_all', {
        p_user_id: user.id,
      });
      if (error) throw error;
      setActionStatus({ status: 'success', message: `${data ?? 0} postcards unclaimed ✅` });
      fetchStats();
    } catch (err: unknown) {
      setActionStatus({
        status: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }, [user?.id, fetchStats]);

  const resetDailyPack = useCallback(async () => {
    if (!user?.id) return;
    setActionStatus({ status: 'loading', message: 'Resetting daily pack...' });
    try {
      // Use RPC because postalpeek_daily_packs has no DELETE RLS policy
      const { error } = await supabase.rpc('postalpeek_admin_reset_daily_pack', {
        p_user_id: user.id,
      });
      if (error) throw error;
      setActionStatus({ status: 'success', message: 'Daily pack reset ✅' });
      fetchStats();
    } catch (err: unknown) {
      setActionStatus({
        status: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }, [user?.id, fetchStats]);

  // ── Postcard Actions ──

  const deletePostcard = useCallback(async () => {
    if (!postcardId.trim()) return;
    if (!confirm(`Delete postcard ${postcardId}? This is permanent.`)) return;
    setActionStatus({ status: 'loading', message: 'Deleting postcard...' });
    try {
      const { error } = await supabase.rpc('postalpeek_admin_delete_postcard', {
        p_postcard_id: postcardId.trim(),
      });
      if (error) throw error;
      setActionStatus({ status: 'success', message: `Postcard ${postcardId.slice(0, 8)}… deleted ✅` });
      setPostcardId('');
      fetchStats();
      onPostcardGenerated?.();
    } catch (err: unknown) {
      setActionStatus({
        status: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }, [postcardId, fetchStats, onPostcardGenerated]);

  const regenerateIllustration = useCallback(async () => {
    if (!postcardId.trim()) return;
    setActionStatus({ status: 'loading', message: 'Regenerating illustration...' });
    try {
      const { data, error } = await supabase.functions.invoke('postalpeek-regenerate-illustration', {
        body: { postcard_id: postcardId.trim() },
      });
      if (error) {
        // supabase.functions.invoke wraps non-2xx with a generic message;
        // the real body lives in error.context (a Response object)
        let realMessage = error.message;
        try {
          const ctx = (error as unknown as { context: Response }).context;
          if (ctx && typeof ctx.json === 'function') {
            const body = await ctx.json();
            realMessage = body?.error || body?.message || realMessage;
          }
        } catch { /* ignore parse failures */ }
        throw new Error(realMessage);
      }
      setActionStatus({
        status: 'success',
        message: data?.message || `Illustration regenerated ✅`,
      });
      onPostcardGenerated?.();
    } catch (err: unknown) {
      setActionStatus({
        status: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }, [postcardId, onPostcardGenerated]);

  const regenerateDescriptions = useCallback(async () => {
    if (!postcardId.trim()) return;
    setActionStatus({ status: 'loading', message: 'Regenerating descriptions...' });
    try {
      const { data, error } = await supabase.functions.invoke('postalpeek-regenerate-descriptions', {
        body: { postcard_id: postcardId.trim() },
      });
      if (error) {
        let realMessage = error.message;
        try {
          const ctx = (error as unknown as { context: Response }).context;
          if (ctx && typeof ctx.json === 'function') {
            const body = await ctx.json();
            realMessage = body?.error || body?.message || realMessage;
          }
        } catch { /* ignore parse failures */ }
        throw new Error(realMessage);
      }
      setActionStatus({
        status: 'success',
        message: data?.message || `Descriptions regenerated ✅`,
      });
      onPostcardGenerated?.();
    } catch (err: unknown) {
      setActionStatus({
        status: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }, [postcardId, onPostcardGenerated]);

  // ── Generation (Wander / Trip) ──

  const triggerWander = useCallback(async () => {
    setGenStatus({ status: 'loading', message: 'Generating wander postcard...' });
    try {
      const { data, error } = await supabase.functions.invoke('postalpeek-walker-wander', {
        body: {},
        headers: {},
      });
      if (error) throw error;

      if (data?.success && data?.data) {
        setGenStatus({ status: 'success', message: `✅ ${data.data.location}` });
        onPostcardGenerated?.();
      } else if (data?.skipped) {
        // Force retry for local env
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
          setGenStatus({ status: 'success', message: `✅ ${forceData.data.location}` });
          onPostcardGenerated?.();
        } else {
          throw new Error(forceData?.error || 'Unknown error');
        }
      } else {
        throw new Error(data?.error || 'Unknown error');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setGenStatus({ status: 'error', message: msg });
    }
  }, [onPostcardGenerated]);

  const triggerTrip = useCallback(async () => {
    setGenStatus({ status: 'loading', message: 'Generating trip postcard...' });
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
        setGenStatus({
          status: 'success',
          message: `✅ Trip: ${data.postcards_created || 0} postcards created`,
        });
        onPostcardGenerated?.();
      } else {
        throw new Error(data?.error || 'Trip generation failed');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setGenStatus({ status: 'error', message: msg });
    }
  }, [onPostcardGenerated]);

  const copyEnrichCommand = useCallback(() => {
    const count = stats?.unenrichedCount ?? 0;
    const cmd =
      count > 20
        ? 'yarn workspace postalpeek enrich:collection --limit 20'
        : 'yarn workspace postalpeek enrich:collection';
    navigator.clipboard.writeText(cmd);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [stats?.unenrichedCount]);

  const runIllustrationTagsBackfill = useCallback(async () => {
    setBackfillStatus({ status: 'loading', message: 'Analyzing illustrations… (batch of 10)' });
    try {
      const { data, error } = await supabase.functions.invoke('backfill-illustration-tags', {
        body: { batch_size: 10, dry_run: false },
      });
      if (error) throw error;
      const processed = data?.processed ?? 0;
      const failed = data?.failed ?? 0;
      if (processed === 0) {
        setBackfillStatus({ status: 'success', message: '✅ All postcards already have illustration tags!' });
      } else {
        setBackfillStatus({
          status: 'success',
          message: `✅ Processed ${processed} postcards${failed > 0 ? ` (${failed} failed)` : ''}. Run again if more remain.`,
        });
      }
      fetchStats();
    } catch (err: unknown) {
      setBackfillStatus({
        status: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }, [fetchStats]);

  // ── Keyboard shortcut ──

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  // ── Tabs config ──

  const tabs: { key: Tab; icon: string; label: string }[] = [
    { key: 'data', icon: '📊', label: 'User Data' },
    { key: 'user-actions', icon: '🔧', label: 'User Actions' },
    { key: 'postcard-actions', icon: '🎴', label: 'Postcard Actions' },
    { key: 'generation', icon: '🌍', label: 'Generation' },
  ];

  // ── Render ───────────────────────────────────────────────────────────

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[10000] flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="w-[95vw] max-w-xl max-h-[85vh] rounded-2xl shadow-2xl border overflow-hidden flex flex-col"
            style={{
              background: 'rgba(15,15,25,0.95)',
              borderColor: 'rgba(99,102,241,0.2)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              className="px-5 py-4 flex items-center justify-between shrink-0 border-b"
              style={{ borderColor: 'rgba(255,255,255,0.06)' }}
            >
              <div className="flex items-center gap-3">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-white text-base font-semibold tracking-wide">
                  Admin Console
                </span>
                {user && (
                  <span className="text-white/30 text-xs font-mono truncate max-w-[180px]">
                    {user.email}
                  </span>
                )}
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-all"
              >
                ✕
              </button>
            </div>

            {/* Tabs */}
            <div
              className="flex gap-1 px-4 py-2 shrink-0 border-b overflow-x-auto"
              style={{ borderColor: 'rgba(255,255,255,0.04)' }}
            >
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => {
                    setActiveTab(tab.key);
                    setActionStatus({ status: 'idle', message: '' });
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 flex items-center gap-1.5"
                  style={{
                    background:
                      activeTab === tab.key ? 'rgba(99,102,241,0.3)' : 'transparent',
                    color: activeTab === tab.key ? 'rgb(165,180,252)' : 'rgba(255,255,255,0.45)',
                  }}
                >
                  <span>{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>

            {/* Content area */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* ── Tab: User Data ── */}
              {activeTab === 'data' && (
                <div className="space-y-4">
                  {statsLoading ? (
                    <div className="flex items-center gap-2 text-white/40 text-sm py-8 justify-center">
                      <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                      Loading stats...
                    </div>
                  ) : stats ? (
                    <>
                      {/* Auth Info */}
                      <div>
                        <h3 className="text-white/70 text-[10px] uppercase tracking-widest font-semibold mb-2">
                          Auth User
                        </h3>
                        <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.03)' }}>
                          <StatRow label="User ID" value={user?.id?.slice(0, 12) + '…' || '—'} />
                          <StatRow label="Email" value={user?.email || '—'} />
                          <StatRow
                            label="Created"
                            value={
                              user?.created_at
                                ? new Date(user.created_at).toLocaleDateString()
                                : '—'
                            }
                          />
                        </div>
                      </div>

                      {/* Claim Limits — deprecated, table removed */}
                      <div>
                        <h3 className="text-white/70 text-[10px] uppercase tracking-widest font-semibold mb-2">
                          Claim Limits
                        </h3>
                        <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.03)' }}>
                          <StatRow label="Status" value={<span style={{ color: 'rgb(148,163,184)' }}>Deprecated — Daily Packs are now the bottleneck</span>} />
                        </div>
                      </div>

                      {/* Collection & Global */}
                      <div>
                        <h3 className="text-white/70 text-[10px] uppercase tracking-widest font-semibold mb-2">
                          Collection & Global
                        </h3>
                        <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.03)' }}>
                          <StatRow
                            label="User's collection"
                            value={`${stats.collectionCount} postcards`}
                          />
                          <StatRow
                            label="Total postcards (global)"
                            value={stats.totalPostcards}
                          />
                          <StatRow
                            label="Unenriched"
                            value={
                              <span
                                style={{
                                  color:
                                    stats.unenrichedCount === 0
                                      ? 'rgb(110,231,183)'
                                      : 'rgb(253,224,71)',
                                }}
                              >
                                {stats.unenrichedCount === 0
                                  ? '✅ All enriched'
                                  : `${stats.unenrichedCount} pending`}
                              </span>
                            }
                          />
                        </div>
                      </div>

                      {/* Daily Pack & Albums */}
                      <div>
                        <h3 className="text-white/70 text-[10px] uppercase tracking-widest font-semibold mb-2">
                          Daily Pack & Albums
                        </h3>
                        <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.03)' }}>
                          <StatRow
                            label="Daily pack opened today"
                            value={stats.dailyPackToday ? '✅ Yes' : '❌ No'}
                          />
                          <StatRow
                            label="Albums"
                            value={`${stats.albumsCompleted} / ${stats.albumsCount} completed`}
                          />
                        </div>
                      </div>

                      <button
                        onClick={fetchStats}
                        className="text-white/30 text-xs hover:text-white/60 transition-colors"
                      >
                        ↻ Refresh stats
                      </button>
                    </>
                  ) : (
                    <p className="text-white/40 text-sm text-center py-8">
                      No stats available
                    </p>
                  )}
                </div>
              )}

              {/* ── Tab: User Actions ── */}
              {activeTab === 'user-actions' && (
                <div className="space-y-3">
                  {!user ? (
                    <p className="text-white/40 text-sm text-center py-8">
                      No user logged in. Actions require a user session.
                    </p>
                  ) : (
                    <>
                      <p className="text-white/40 text-xs mb-4">
                        ⚠️ These actions affect <strong className="text-white/70">{user.email}</strong>
                      </p>

                      <DangerButton onClick={resetClaimLimits} disabled={actionStatus.status === 'loading'}>
                        <span>🔄</span>
                        <span>Reset Claim Limits (daily & monthly → 0)</span>
                      </DangerButton>

                      <DangerButton onClick={unclaimAllPostcards} disabled={actionStatus.status === 'loading'}>
                        <span>📤</span>
                        <span>Unclaim All Postcards</span>
                      </DangerButton>

                      <DangerButton onClick={resetDailyPack} disabled={actionStatus.status === 'loading'}>
                        <span>📦</span>
                        <span>Reset Today's Daily Pack</span>
                      </DangerButton>

                      <StatusBadge status={actionStatus.status} message={actionStatus.message} />
                    </>
                  )}
                </div>
              )}

              {/* ── Tab: Postcard Actions ── */}
              {activeTab === 'postcard-actions' && (
                <div className="space-y-4">
                  {/* Postcard ID input */}
                  <div>
                    <label className="text-white/50 text-xs block mb-1.5">Postcard ID (UUID)</label>
                    <input
                      type="text"
                      value={postcardId}
                      onChange={(e) => setPostcardId(e.target.value)}
                      placeholder="e.g. 3f2504e0-4f89-11d3-9a0c-0305e82c3301"
                      className="w-full px-3 py-2.5 rounded-xl text-sm font-mono transition-all"
                      style={{
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        color: 'white',
                        outline: 'none',
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(99,102,241,0.5)';
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                      }}
                    />
                  </div>

                  <div className="space-y-2">
                    <ActionButton
                      onClick={regenerateIllustration}
                      disabled={!postcardId.trim() || actionStatus.status === 'loading'}
                    >
                      <span>🎨</span>
                      <span>Regenerate Illustration</span>
                    </ActionButton>

                    <ActionButton
                      onClick={regenerateDescriptions}
                      disabled={!postcardId.trim() || actionStatus.status === 'loading'}
                      gradient="linear-gradient(135deg, rgba(16,185,129,0.6), rgba(5,150,105,0.6))"
                    >
                      <span>📝</span>
                      <span>Regenerate Descriptions</span>
                    </ActionButton>

                    <DangerButton
                      onClick={deletePostcard}
                      disabled={!postcardId.trim() || actionStatus.status === 'loading'}
                    >
                      <span>🗑️</span>
                      <span>Delete Postcard</span>
                    </DangerButton>
                  </div>

                  <StatusBadge status={actionStatus.status} message={actionStatus.message} />
                </div>
              )}

              {/* ── Tab: Generation ── */}
              {activeTab === 'generation' && (
                <div className="space-y-4">
                  {/* Generation buttons */}
                  <div className="space-y-2">
                    <ActionButton
                      onClick={triggerWander}
                      disabled={genStatus.status === 'loading'}
                    >
                      <span>🌍</span>
                      <span>Generate Wander Postcard</span>
                    </ActionButton>

                    <ActionButton
                      onClick={triggerTrip}
                      disabled={genStatus.status === 'loading'}
                      gradient="linear-gradient(135deg, rgba(16,185,129,0.6), rgba(5,150,105,0.6))"
                    >
                      <span>✈️</span>
                      <span>Generate Trip Postcard</span>
                    </ActionButton>
                  </div>

                  <StatusBadge status={genStatus.status} message={genStatus.message} />

                  {/* Enrichment */}
                  <div
                    className="pt-4 border-t"
                    style={{ borderColor: 'rgba(255,255,255,0.06)' }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-white/60 text-xs font-medium tracking-wide uppercase">
                        Enrichment
                      </span>
                      {stats && (
                        <span
                          className="text-[10px] px-2 py-0.5 rounded-full font-mono"
                          style={{
                            background:
                              stats.unenrichedCount === 0
                                ? 'rgba(16,185,129,0.2)'
                                : 'rgba(251,191,36,0.2)',
                            color:
                              stats.unenrichedCount === 0
                                ? 'rgb(110,231,183)'
                                : 'rgb(253,224,71)',
                          }}
                        >
                          {stats.unenrichedCount === 0
                            ? '✅ All enriched'
                            : `${stats.unenrichedCount} pending`}
                        </span>
                      )}
                    </div>
                    {stats && stats.unenrichedCount > 0 && (
                      <button
                        onClick={copyEnrichCommand}
                        className="w-full px-3 py-2 rounded-lg text-xs text-white/70 transition-all duration-200 flex items-center gap-2 hover:text-white/90"
                        style={{
                          background: 'rgba(255,255,255,0.05)',
                          border: '1px solid rgba(255,255,255,0.08)',
                        }}
                      >
                        <span>{copied ? '✅' : '📋'}</span>
                        <span className="font-mono truncate">
                          {copied ? 'Copied!' : 'yarn workspace postalpeek enrich:collection'}
                        </span>
                      </button>
                    )}
                  </div>

                  {/* Illustration Tags Backfill */}
                  <div
                    className="pt-4 border-t"
                    style={{ borderColor: 'rgba(255,255,255,0.06)' }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-white/60 text-xs font-medium tracking-wide uppercase">
                        Illustration Tags Backfill
                      </span>
                      {stats && (
                        <span
                          className="text-[10px] px-2 py-0.5 rounded-full font-mono"
                          style={{
                            background:
                              stats.noIllustrationTagsCount === 0
                                ? 'rgba(16,185,129,0.2)'
                                : 'rgba(251,191,36,0.2)',
                            color:
                              stats.noIllustrationTagsCount === 0
                                ? 'rgb(110,231,183)'
                                : 'rgb(253,224,71)',
                          }}
                        >
                          {stats.noIllustrationTagsCount === 0
                            ? '✅ All tagged'
                            : `${stats.noIllustrationTagsCount} pending`}
                        </span>
                      )}
                    </div>
                    <p className="text-white/30 text-[10px] mb-2">
                      Analyzes each illustration with Gemini and saves tags. Runs in batches of 10.
                    </p>
                    <ActionButton
                      onClick={runIllustrationTagsBackfill}
                      disabled={backfillStatus.status === 'loading' || stats?.noIllustrationTagsCount === 0}
                      gradient="linear-gradient(135deg, rgba(139,92,246,0.6), rgba(99,102,241,0.6))"
                    >
                      <span>🏷️</span>
                      <span>
                        {backfillStatus.status === 'loading'
                          ? 'Analyzing…'
                          : 'Backfill Illustration Tags (×10)'}
                      </span>
                    </ActionButton>
                    <StatusBadge status={backfillStatus.status} message={backfillStatus.message} />
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

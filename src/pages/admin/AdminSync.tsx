/**
 * AdminSync.tsx — /admin/sync
 * Compare local ↔ production and push enrichments.
 */

import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Loader, Upload, Search } from 'lucide-react';
import { ActionBtn, StatusMsg } from '../../components/admin/AdminUI';
import type { ActionStatus } from '../../components/admin/AdminUI';

interface SyncPreview {
  localEnrichedTotal: number;
  toSyncCount: number;
  alreadyInSyncCount: number;
  notInProdCount: number;
  sample: { id: string; city: string; country: string; location_name: string | null; tagCount: number; changedColumns: string[] }[];
  changedColumnsSummary: Record<string, number>;
  businessCount: number;
  businessLinkCount: number;
  prodUrl: string;
}

export function AdminSync() {
  const edgeBase = import.meta.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321';
  const edgeKey  = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WO7o6oSc4wYjSnO28-VRLNxMEnOj9aQREp8o';

  const [syncPreview,      setSyncPreview]      = useState<SyncPreview | null>(null);
  const [syncPreviewStatus, setSyncPreviewStatus] = useState<{ status: ActionStatus; message: string }>({ status: 'idle', message: '' });
  const [syncExecStatus,   setSyncExecStatus]   = useState<{ status: ActionStatus; message: string }>({ status: 'idle', message: '' });
  const [syncSkipBiz,      setSyncSkipBiz]      = useState(false);

  const callEdgeFn = useCallback(async (fn: string, body: Record<string, unknown>) => {
    const r = await fetch(`${edgeBase}/functions/v1/${fn}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${edgeKey}` },
      body: JSON.stringify(body),
    });
    const d = await r.json();
    if (!r.ok || d?.error) throw new Error(d?.error || `Failed (${r.status})`);
    return d;
  }, [edgeBase, edgeKey]);

  const fetchSyncPreview = useCallback(async () => {
    setSyncPreviewStatus({ status: 'loading', message: 'Comparing local ↔ prod…' });
    setSyncPreview(null);
    setSyncExecStatus({ status: 'idle', message: '' });
    try {
      const data = await callEdgeFn('postalpeek-sync-to-prod', { mode: 'preview', skipBiz: syncSkipBiz });
      setSyncPreview(data);
      setSyncPreviewStatus({ status: 'success', message: `Preview loaded — ${data.toSyncCount} postcards to sync` });
    } catch (err: unknown) {
      setSyncPreviewStatus({ status: 'error', message: err instanceof Error ? err.message : String(err) });
    }
  }, [callEdgeFn, syncSkipBiz]);

  const executeSyncToProd = useCallback(async () => {
    if (!syncPreview || syncPreview.toSyncCount === 0) return;
    if (!confirm(`Push ${syncPreview.toSyncCount} enrichments to production?\n\nTarget: ${syncPreview.prodUrl}\n\nThis action cannot be undone.`)) return;
    setSyncExecStatus({ status: 'loading', message: 'Syncing to production…' });
    try {
      const data = await callEdgeFn('postalpeek-sync-to-prod', { mode: 'execute', skipBiz: syncSkipBiz });
      const pc   = data.postcards;
      const biz  = data.businesses;
      const links = data.businessLinks;
      const parts = [`📬 ${pc.synced}/${pc.total} postcards synced`];
      if (pc.failed > 0) parts.push(`(${pc.failed} failed)`);
      if (!syncSkipBiz) { parts.push(`· 🏪 ${biz.synced} businesses`); parts.push(`· 🔗 ${links.synced} links`); }
      setSyncExecStatus({ status: 'success', message: parts.join(' ') });
      setTimeout(fetchSyncPreview, 2000);
    } catch (err: unknown) {
      setSyncExecStatus({ status: 'error', message: err instanceof Error ? err.message : String(err) });
    }
  }, [callEdgeFn, syncPreview, syncSkipBiz, fetchSyncPreview]);

  return (
    <div className="max-w-2xl space-y-6">
      <h2 className="text-xl font-semibold">Sync to Production</h2>
      <p className="text-white/40 text-xs leading-relaxed -mt-3">
        Compare locally enriched postcards with production and push updates. This replaces running <code className="text-indigo-300">sync:prod</code> from the terminal.
      </p>

      {/* Options */}
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-white/60 cursor-pointer">
          <input type="checkbox" checked={syncSkipBiz} onChange={(e) => setSyncSkipBiz(e.target.checked)} style={{ accentColor: 'rgba(99,102,241,1)' }} />
          Skip businesses
        </label>
      </div>

      <ActionBtn onClick={fetchSyncPreview} disabled={syncPreviewStatus.status === 'loading'}>
        {syncPreviewStatus.status === 'loading' ? <Loader className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
        <span>Preview Sync</span>
      </ActionBtn>
      <StatusMsg status={syncPreviewStatus.status} message={syncPreviewStatus.message} />

      {syncPreview && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Enriched locally',  value: syncPreview.localEnrichedTotal,  icon: '🃏' },
              { label: 'To sync',           value: syncPreview.toSyncCount,          icon: '📤', highlight: syncPreview.toSyncCount > 0 },
              { label: 'Already in sync',   value: syncPreview.alreadyInSyncCount,   icon: '✅' },
              { label: 'Not found in prod', value: syncPreview.notInProdCount,       icon: '⚠️' },
              ...(!syncSkipBiz ? [
                { label: 'Businesses',      value: syncPreview.businessCount,        icon: '🏪' },
                { label: 'Business links',  value: syncPreview.businessLinkCount,    icon: '🔗' },
              ] : []),
            ].map((stat) => (
              <div key={stat.label} className="rounded-xl p-3 border" style={{
                background:   (stat as { highlight?: boolean }).highlight ? 'rgba(99,102,241,0.08)' : 'rgba(255,255,255,0.03)',
                borderColor:  (stat as { highlight?: boolean }).highlight ? 'rgba(99,102,241,0.3)'  : 'rgba(255,255,255,0.06)',
              }}>
                <p className="text-white/40 text-xs mb-0.5">{stat.icon} {stat.label}</p>
                <p className={`text-lg font-mono font-semibold ${(stat as { highlight?: boolean }).highlight ? 'text-indigo-300' : 'text-white'}`}>{stat.value}</p>
              </div>
            ))}
          </div>

          {syncPreview.changedColumnsSummary && Object.keys(syncPreview.changedColumnsSummary).length > 0 && (
            <div className="rounded-xl border overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.06)' }}>
              <div className="px-3 py-2 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
                <p className="text-white/50 text-[10px] uppercase tracking-widest font-semibold">📊 Outdated columns breakdown</p>
              </div>
              <div className="flex flex-wrap gap-2 p-3">
                {Object.entries(syncPreview.changedColumnsSummary)
                  .sort(([, a], [, b]) => (b as number) - (a as number))
                  .map(([col, count]) => (
                    <span key={col} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono"
                      style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', color: 'rgb(165,180,252)' }}>
                      {col}<span className="text-white/40 font-semibold">{count as number}</span>
                    </span>
                  ))}
              </div>
            </div>
          )}

          {syncPreview.sample.length > 0 && (
            <div className="rounded-xl border overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.06)' }}>
              <div className="px-3 py-2 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
                <p className="text-white/50 text-[10px] uppercase tracking-widest font-semibold">
                  📋 Sample — {Math.min(syncPreview.sample.length, 10)} of {syncPreview.toSyncCount}
                </p>
              </div>
              <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                {syncPreview.sample.map((pc, i) => (
                  <div key={pc.id} className="flex items-center gap-3 px-3 py-2 text-sm" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                    <span className="text-white/20 text-xs font-mono w-5 text-right">{i + 1}</span>
                    <span className="text-white/70 flex-1 truncate">{pc.location_name || pc.city}{pc.country ? `, ${pc.country}` : ''}</span>
                    <span className="text-white/30 text-xs font-mono">{pc.tagCount} tags</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="text-white/20 text-[10px] font-mono">Target: {syncPreview.prodUrl}</p>

          {syncPreview.toSyncCount > 0 && (
            <div className="pt-2">
              <ActionBtn onClick={executeSyncToProd} disabled={syncExecStatus.status === 'loading'} variant="success">
                {syncExecStatus.status === 'loading' ? <Loader className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                <span>Push {syncPreview.toSyncCount} enrichments to prod</span>
              </ActionBtn>
              <StatusMsg status={syncExecStatus.status} message={syncExecStatus.message} />
            </div>
          )}

          {syncPreview.toSyncCount === 0 && (
            <div className="rounded-xl p-4 border text-center" style={{ background: 'rgba(16,185,129,0.05)', borderColor: 'rgba(16,185,129,0.2)' }}>
              <p className="text-emerald-400 text-sm font-medium">✅ Everything is in sync!</p>
              {syncPreview.notInProdCount > 0 && (
                <p className="text-white/30 text-xs mt-1">{syncPreview.notInProdCount} postcards exist locally but not in prod — run the generation pipeline first</p>
              )}
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}

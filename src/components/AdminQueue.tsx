/**
 * AdminQueue.tsx — Queue & Automation admin panel
 *
 * Sections:
 *   1. Cron Controls   — manually trigger the walker cron locally
 *   2. Pending Slots   — list of pending album slots (the queue)
 *   3. Cron Log        — live feed of postalpeek_cron_log table
 */

import React, { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play,
  Square,
  RefreshCw,
  Loader,
  Clock,
  CheckCircle,
  XCircle,
  SkipForward,
  Zap,
  ListOrdered,
  ScrollText,
  Repeat,
  Target,
  Trash2,
} from "lucide-react";
import { supabase } from "@eb-packages/logic/src/supabase";
import { StreetViewInspector } from "./StreetViewInspector";
import { ExplorerRealtimeFeed } from "./ExplorerRealtimeFeed";

const MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

// ── Types ──────────────────────────────────────────────────────────────

type ActionStatus = "idle" | "loading" | "success" | "error";

interface PendingSlot {
  id: string;
  album_id: string;
  slot_label: string;
  slot_order: number;
  lat: number;
  lng: number;
  heading: number;
  stop_description: string | null;
  generation_metadata_override?: {
    landmark_precision?: boolean;
    pipeline_config?: unknown;
  } | null;
  postalpeek_albums: { title: string } | null;
}

interface CronLogEntry {
  id: string;
  created_at: string;
  status: "success" | "error" | "skipped";
  slot_id: string | null;
  album_title: string | null;
  location_name: string | null;
  strategy: string | null;
  postcard_id: string | null;
  duration_ms: number | null;
  error_message: string | null;
  triggered_by: string | null;
}

// ── Helpers ────────────────────────────────────────────────────────────

function timeAgo(isoStr: string): string {
  const diff = Date.now() - new Date(isoStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function durationLabel(ms: number | null): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

// ── Sub-components ─────────────────────────────────────────────────────

function SectionHeader({
  icon,
  title,
  badge,
  onRefresh,
  loading,
}: {
  icon: React.ReactNode;
  title: string;
  badge?: string | number;
  onRefresh?: () => void;
  loading?: boolean;
}) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2.5">
        <span className="text-indigo-400/80">{icon}</span>
        <h3 className="text-sm font-semibold text-white/80">{title}</h3>
        {badge != null && (
          <span
            className="px-2 py-0.5 rounded-full text-[10px] font-mono font-medium text-white/50"
            style={{
              background: "rgba(255,255,255,0.07)",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            {badge}
          </span>
        )}
      </div>
      {onRefresh && (
        <button
          onClick={onRefresh}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-white/40 hover:text-white/70 hover:bg-white/5 transition-all disabled:opacity-40"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      )}
    </div>
  );
}

function StatusChip({ status }: { status: CronLogEntry["status"] }) {
  const config = {
    success: {
      icon: <CheckCircle className="w-3 h-3" />,
      label: "success",
      color: "text-emerald-400 bg-emerald-950/60 border-emerald-700/30",
    },
    error: {
      icon: <XCircle className="w-3 h-3" />,
      label: "error",
      color: "text-red-400 bg-red-950/60 border-red-700/30",
    },
    skipped: {
      icon: <SkipForward className="w-3 h-3" />,
      label: "skipped",
      color: "text-amber-400 bg-amber-950/60 border-amber-700/30",
    },
  };
  const c = config[status];
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${c.color}`}
    >
      {c.icon}
      {c.label}
    </span>
  );
}

function TriggerBadge({ triggeredBy }: { triggeredBy: string | null }) {
  const isAdmin = triggeredBy === "admin";
  return (
    <span
      className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold uppercase tracking-wide ${
        isAdmin
          ? "text-violet-300 bg-violet-950/60 border border-violet-700/30"
          : "text-white/30 bg-white/5 border border-white/10"
      }`}
    >
      {isAdmin ? "👤 admin" : "⏰ cron"}
    </span>
  );
}

function StatusMsg({
  status,
  message,
}: {
  status: ActionStatus;
  message: string;
}) {
  if (status === "idle" || !message) return null;
  const colors = {
    loading: "bg-indigo-950/60 text-indigo-300 border-indigo-700/30",
    success: "bg-emerald-950/60 text-emerald-300 border-emerald-700/30",
    error: "bg-red-950/60 text-red-300 border-red-700/30",
  } as const;
  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className={`mt-2 px-3 py-2 rounded-lg text-xs flex items-center gap-2 border ${colors[status]}`}
    >
      {status === "loading" && (
        <Loader className="w-3 h-3 animate-spin shrink-0" />
      )}
      {status === "success" && "✅"}
      {status === "error" && "❌"}
      <span className="break-all">{message}</span>
    </motion.div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────

export function AdminQueue() {
  const edgeBase =
    import.meta.env.VITE_SUPABASE_URL || "http://127.0.0.1:54321";
  const edgeKey =
    import.meta.env.VITE_SUPABASE_ANON_KEY ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WO7o6oSc4wYjSnO28-VRLNxMEnOj9aQREp8o";

  // ── Active Explorer Scout (for real-time cron monitoring) ──
  const [scoutSession, setScoutSession] = useState<{
    sessionId: string;
    locationName: string;
    slotId?: string;
  } | null>(null);

  // ── Cron status ──
  const [cronStatus, setCronStatus] = useState<{
    status: ActionStatus;
    message: string;
  }>({ status: "idle", message: "" });

  // ── Auto-Run state ──
  const [autoRunning, setAutoRunning] = useState(false);
  const [autoCount, setAutoCount] = useState(0);
  const autoRunRef = useRef(false); // mutable ref so the loop can check it

  // ── Walker Pause state ──
  const [walkerPaused, setWalkerPaused] = useState(false);
  const [pausingLoader, setPausingLoader] = useState(false);

  // ── Pending slots ──
  const [pendingSlots, setPendingSlots] = useState<PendingSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [expandedSlotId, setExpandedSlotId] = useState<string | null>(null);
  const [savingSlotId, setSavingSlotId] = useState<string | null>(null);

  // ── Cron log ──
  const [cronLog, setCronLog] = useState<CronLogEntry[]>([]);
  const [logLoading, setLogLoading] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Fetch walker pause state ──
  const fetchWalkerState = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("postalpeek_system_config")
        .select("value")
        .eq("key", "walker_state")
        .maybeSingle();
      if (!error && data?.value) {
        setWalkerPaused(!!data.value.paused);
      }
    } catch (err) {
      console.warn("[AdminQueue] Failed to load walker state", err);
    }
  }, []);

  const toggleWalkerPause = async () => {
    setPausingLoader(true);
    try {
      const newState = !walkerPaused;
      await supabase
        .from("postalpeek_system_config")
        .upsert({ key: "walker_state", value: { paused: newState } });
      setWalkerPaused(newState);
    } catch (e) {
      console.error(e);
    } finally {
      setPausingLoader(false);
    }
  };

  // ── Fetch pending slots — returns the count so the loop can use it ──
  const fetchPendingSlots = useCallback(async (): Promise<number> => {
    setSlotsLoading(true);
    try {
      const { data, error } = await supabase
        .from("postalpeek_album_slots")
        .select(
          `
          id,
          album_id,
          slot_label,
          slot_order,
          lat,
          lng,
          heading,
          stop_description,
          generation_metadata_override,
          postalpeek_albums ( title )
        `,
        )
        .eq("stop_status", "pending")
        .order("album_id", { ascending: true })
        .order("slot_order", { ascending: true });

      if (error) throw error;
      const slots = (data as unknown as PendingSlot[]) || [];
      setPendingSlots(slots);
      return slots.length;
    } catch (err) {
      console.error("[AdminQueue] Failed to fetch pending slots", err);
      return 0;
    } finally {
      setSlotsLoading(false);
    }
  }, []);

  // ── Fetch cron log ──
  const fetchCronLog = useCallback(async () => {
    setLogLoading(true);
    try {
      const { data, error } = await supabase
        .from("postalpeek_cron_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      setCronLog((data as CronLogEntry[]) || []);
    } catch (err) {
      console.error("[AdminQueue] Failed to fetch cron log", err);
    } finally {
      setLogLoading(false);
    }
  }, []);

  // ── Initial load + poll every 15s ──
  useEffect(() => {
    fetchPendingSlots();
    fetchCronLog();
    fetchWalkerState();

    pollingRef.current = setInterval(() => {
      fetchCronLog();
    }, 15_000);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [fetchPendingSlots, fetchCronLog, fetchWalkerState]);

  // Stop auto-run on unmount
  useEffect(
    () => () => {
      autoRunRef.current = false;
    },
    [],
  );

  // ── Call edge function ──
  const callEdgeFunction = useCallback(
    async (body: Record<string, unknown> = {}) => {
      const res = await fetch(
        `${edgeBase}/functions/v1/postalpeek-cron-walker?force=true`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${edgeKey}`,
          },
          body: JSON.stringify({ triggered_by: "admin", ...body }),
        },
      );
      const data = await res.json();
      if (!res.ok || data?.error)
        throw new Error(data?.error || `Failed (${res.status})`);
      return data;
    },
    [edgeBase, edgeKey],
  );

  // ── Run cron once (next slot or specific slot) ──
  const runCron = useCallback(
    async (slotId?: string) => {
      // For landmark slots, generate a scout session ID for real-time progress
      const targetSlot = slotId ? pendingSlots.find(s => s.id === slotId) : pendingSlots[0];
      const isLandmark = targetSlot?.generation_metadata_override?.landmark_precision === true;
      const sessionId = isLandmark ? crypto.randomUUID() : null;
      const locationName = targetSlot?.slot_label ?? 'Scout…';

      // Show live feed immediately for landmark slots
      if (sessionId) {
        setScoutSession({ sessionId, locationName, slotId });
      } else {
        setScoutSession(null);
      }

      setCronStatus({
        status: "loading",
        message: slotId
          ? `Processing slot ${slotId.slice(0, 8)}…`
          : "Running cron walker…",
      });
      try {
        const data = await callEdgeFunction(
          slotId
            ? { slot_id: slotId, ...(sessionId ? { scout_session_id: sessionId } : {}) }
            : (sessionId ? { scout_session_id: sessionId } : {})
        );
        const loc = data?.data?.location;
        setCronStatus({
          status: "success",
          message: loc ? `✓ Generated: ${loc}` : "Cron ran successfully",
        });
        await new Promise((r) => setTimeout(r, 800));
        const remaining = await fetchPendingSlots();
        fetchCronLog();
        return remaining;
      } catch (err: unknown) {
        setCronStatus({
          status: "error",
          message: err instanceof Error ? err.message : String(err),
        });
        setTimeout(fetchCronLog, 800);
        throw err;
      }
    },
    [callEdgeFunction, fetchPendingSlots, fetchCronLog, pendingSlots],
  );

  // ── Auto-Run loop ──
  const startAutoRun = useCallback(async () => {
    autoRunRef.current = true;
    setAutoRunning(true);
    setAutoCount(0);

    let count = 0;
    while (autoRunRef.current) {
      try {
        const remaining = await runCron();
        count++;
        setAutoCount(count);
        if (remaining === 0) {
          // Queue drained!
          setCronStatus({
            status: "success",
            message: `🎉 Queue drained! Processed ${count} slot${count !== 1 ? "s" : ""}.`,
          });
          break;
        }
        // Small buffer between runs so Supabase/APIs don't get hammered
        await new Promise((r) => setTimeout(r, 1500));
      } catch {
        // Error already shown by runCron; stop auto-run
        break;
      }
    }

    autoRunRef.current = false;
    setAutoRunning(false);
  }, [runCron]);

  const stopAutoRun = useCallback(() => {
    autoRunRef.current = false;
    setAutoRunning(false);
    setCronStatus({ status: "idle", message: "" });
  }, []);

  const toggleSlotPrecision = async (slot: PendingSlot) => {
    try {
      const isCurrentlyPrecise =
        slot.generation_metadata_override?.landmark_precision === true;
      const newOverride = {
        ...slot.generation_metadata_override,
        landmark_precision: !isCurrentlyPrecise,
      };

      const { error } = await supabase
        .from("postalpeek_album_slots")
        .update({ generation_metadata_override: newOverride })
        .eq("id", slot.id);

      if (error) throw error;
      await fetchPendingSlots();
    } catch (e) {
      console.error("[AdminQueue] Failed to toggle precision:", e);
      alert("Failed to toggle precision");
    }
  };

  const deleteSlot = async (slotId: string) => {
    if (!confirm("Are you sure you want to delete this pending slot?")) return;
    try {
      const { error } = await supabase
        .from("postalpeek_album_slots")
        .delete()
        .eq("id", slotId);

      if (error) throw error;
      await fetchPendingSlots();
    } catch (e) {
      console.error("[AdminQueue] Failed to delete slot:", e);
      alert("Failed to delete slot");
    }
  };

  const handleSaveOverride = async (
    slotId: string,
    overrides: { fov: number; pitch: number; heading: number },
  ) => {
    setSavingSlotId(slotId);
    try {
      const slot = pendingSlots.find((s) => s.id === slotId);
      if (!slot) return;
      const newOverride = {
        ...slot.generation_metadata_override,
        camera_override: overrides,
      };
      const { error } = await supabase
        .from("postalpeek_album_slots")
        .update({
          heading: overrides.heading,
          generation_metadata_override: newOverride,
        })
        .eq("id", slotId);

      if (error) throw error;
      await fetchPendingSlots();
      alert("Camera params overridden successfully!");
    } catch (e) {
      console.error("[AdminQueue] Failed to save camera override:", e);
      alert("Failed to save override");
    } finally {
      setSavingSlotId(null);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────

  return (
    <div className="max-w-3xl space-y-10">
      <h2 className="text-xl font-semibold">Queue & Automation</h2>

      {/* ── 1. Cron Controls ── */}
      <section>
        <SectionHeader
          icon={<Zap className="w-4 h-4" />}
          title="Cron Controls"
        />
        <div
          className="rounded-2xl p-5 space-y-4"
          style={{
            background: autoRunning
              ? "rgba(16,185,129,0.06)"
              : "rgba(99,102,241,0.05)",
            border: `1px solid ${autoRunning ? "rgba(16,185,129,0.25)" : "rgba(99,102,241,0.15)"}`,
            transition: "background 0.4s, border-color 0.4s",
          }}
        >
          {/* Auto-Run status banner */}
          <AnimatePresence>
            {autoRunning && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="flex items-center gap-3 px-4 py-2.5 rounded-xl"
                style={{
                  background: "rgba(16,185,129,0.1)",
                  border: "1px solid rgba(16,185,129,0.2)",
                }}
              >
                <span className="relative flex w-2.5 h-2.5 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
                  <span className="relative inline-flex rounded-full w-2.5 h-2.5 bg-emerald-400" />
                </span>
                <span className="text-emerald-300 text-sm font-semibold flex-1">
                  Auto-Run activo — procesando cola…
                </span>
                {autoCount > 0 && (
                  <span className="text-emerald-400/60 text-xs font-mono">
                    {autoCount} generado{autoCount !== 1 ? "s" : ""}
                  </span>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex items-start gap-3">
            <div className="flex-1">
              <p className="text-white/70 text-sm font-medium mb-1">
                Walker Cron
              </p>
              <p className="text-white/30 text-xs">
                Triggers{" "}
                <code className="text-indigo-300/70 font-mono text-[10px]">
                  postalpeek-cron-walker?force=true
                </code>{" "}
                as <span className="text-violet-300">admin</span>. Usa{" "}
                <span className="text-emerald-300/80">Auto-Run</span> para
                procesar todos los slots pendientes en bucle.
              </p>
            </div>

            <div className="flex gap-2 shrink-0">
              {/* Single run */}
              <button
                onClick={() => runCron()}
                disabled={cronStatus.status === "loading" || autoRunning}
                title="Procesar un slot"
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed hover:brightness-110"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(99,102,241,0.7), rgba(139,92,246,0.7))",
                  border: "1px solid rgba(99,102,241,0.3)",
                }}
              >
                {cronStatus.status === "loading" && !autoRunning ? (
                  <Loader className="w-4 h-4 animate-spin" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
                Run
              </button>

              {/* Auto-run toggle */}
              {autoRunning ? (
                <button
                  onClick={stopAutoRun}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all duration-200 hover:brightness-110"
                  style={{
                    background:
                      "linear-gradient(135deg, rgba(239,68,68,0.6), rgba(220,38,38,0.6))",
                    border: "1px solid rgba(239,68,68,0.3)",
                  }}
                >
                  <Square className="w-4 h-4" />
                  Stop
                </button>
              ) : (
                <button
                  onClick={startAutoRun}
                  disabled={
                    cronStatus.status === "loading" ||
                    slotsLoading ||
                    pendingSlots.length === 0
                  }
                  title="Loop until queue is empty"
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed hover:brightness-110"
                  style={{
                    background:
                      "linear-gradient(135deg, rgba(16,185,129,0.5), rgba(5,150,105,0.6))",
                    border: "1px solid rgba(16,185,129,0.3)",
                  }}
                >
                  <Repeat className="w-4 h-4" />
                  Auto-Run ({pendingSlots.length})
                </button>
              )}

              {/* Walker Pause Toggle (Backend DB) */}
              <button
                onClick={toggleWalkerPause}
                disabled={pausingLoader}
                className="ml-4 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed hover:brightness-110"
                title={
                  walkerPaused
                    ? "Resume automated cron walker"
                    : "Pause automated cron walker"
                }
                style={{
                  background: walkerPaused
                    ? "linear-gradient(135deg, rgba(239,68,68,0.1), rgba(220,38,38,0.1))"
                    : "linear-gradient(135deg, rgba(16,185,129,0.1), rgba(5,150,105,0.1))",
                  border: `1px solid ${walkerPaused ? "rgba(239,68,68,0.4)" : "rgba(16,185,129,0.4)"}`,
                }}
              >
                {pausingLoader ? (
                  <Loader className="w-4 h-4 animate-spin text-white/50" />
                ) : walkerPaused ? (
                  <Play className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Square className="w-4 h-4 text-red-400" />
                )}
                {walkerPaused ? "Resume Global Cron" : "Pause Global Cron"}
              </button>
            </div>
          </div>
          <StatusMsg status={cronStatus.status} message={cronStatus.message} />

          {/* ── Explorer Scout Live Feed (appears when running landmark slots) ── */}
          {scoutSession && MAPS_KEY && (
            <div className="mt-3">
              <ExplorerRealtimeFeed
                key={scoutSession.sessionId}
                sessionId={scoutSession.sessionId}
                locationName={scoutSession.locationName}
                mapsApiKey={MAPS_KEY}
                onDone={() => {
                  // Keep feed visible for 30s after completion so user can review
                  setTimeout(() => setScoutSession(null), 30_000);
                }}
              />
            </div>
          )}
        </div>
      </section>

      {/* ── 2. Pending Slots Queue ── */}
      <section>
        <SectionHeader
          icon={<ListOrdered className="w-4 h-4" />}
          title="Pending Slots Queue"
          badge={slotsLoading ? "…" : pendingSlots.length}
          onRefresh={fetchPendingSlots}
          loading={slotsLoading}
        />
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            border: "1px solid rgba(255,255,255,0.07)",
            background: "rgba(0,0,0,0.25)",
          }}
        >
          {slotsLoading && pendingSlots.length === 0 ? (
            <div className="py-10 flex items-center justify-center text-white/30 text-sm">
              <Loader className="w-4 h-4 animate-spin mr-2" /> Loading…
            </div>
          ) : pendingSlots.length === 0 ? (
            <div className="py-10 text-center text-white/25 text-sm">
              🎉 Queue is empty — all slots completed
            </div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead style={{ background: "rgba(255,255,255,0.04)" }}>
                <tr>
                  <th className="px-4 py-2.5 text-xs text-white/40 font-medium uppercase tracking-wider">
                    Order
                  </th>
                  <th className="px-4 py-2.5 text-xs text-white/40 font-medium uppercase tracking-wider">
                    Slot
                  </th>
                  <th className="px-4 py-2.5 text-xs text-white/40 font-medium uppercase tracking-wider">
                    Album
                  </th>
                  <th className="px-4 py-2.5 text-xs text-white/40 font-medium uppercase tracking-wider">
                    Coords
                  </th>
                  <th className="px-4 py-2.5 text-xs text-white/40 font-medium uppercase tracking-wider w-10">
                    Run
                  </th>
                </tr>
              </thead>
              <tbody
                className="divide-y"
                style={{ borderColor: "rgba(255,255,255,0.04)" }}
              >
                {pendingSlots.map((slot, idx) => {
                  const isLandmark =
                    slot.generation_metadata_override?.landmark_precision ===
                    true;
                  const mapsUrl = `https://maps.google.com/?q=${slot.lat},${slot.lng}`;
                  const isExpanded = expandedSlotId === slot.id;
                  return (
                    <React.Fragment key={slot.id}>
                      <tr className="hover:bg-white/[0.03] transition-colors group">
                        {/* Order */}
                        <td className="px-4 py-3 align-top">
                          {idx === 0 ? (
                            <span className="text-indigo-400 font-bold text-xs">
                              ▶ NEXT
                            </span>
                          ) : (
                            <span className="text-white/35 text-xs font-mono">
                              #{slot.slot_order}
                            </span>
                          )}
                        </td>

                        {/* Slot name + description + landmark badge */}
                        <td className="px-4 py-3 align-top">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-white/85 text-sm">
                              {slot.slot_label}
                            </span>
                            {isLandmark && (
                              <span
                                className="text-[9px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wide"
                                style={{
                                  background: "rgba(245,158,11,0.15)",
                                  border: "1px solid rgba(245,158,11,0.3)",
                                  color: "rgb(252,211,77)",
                                }}
                              >
                                🏛️ Precision
                              </span>
                            )}
                          </div>
                          {slot.stop_description && (
                            <p className="text-white/30 text-[10px] mt-0.5 leading-snug max-w-[240px] line-clamp-2">
                              {slot.stop_description}
                            </p>
                          )}
                        </td>

                        {/* Album */}
                        <td className="px-4 py-3 text-white/45 text-xs align-top">
                          {slot.postalpeek_albums?.title || "—"}
                        </td>

                        {/* Coords + heading + Street View toggle */}
                        <td className="px-4 py-3 align-top">
                          <a
                            href={mapsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] font-mono text-white/35 hover:text-indigo-300 transition-colors block leading-relaxed"
                            style={{ textDecoration: "none" }}
                          >
                            {slot.lat.toFixed(4)}, {slot.lng.toFixed(4)}
                          </a>
                          <span className="text-[10px] font-mono text-white/20 block mb-1.5">
                            hdg {slot.heading}°
                          </span>
                          {/* Street View toggle */}
                          <button
                            onClick={() =>
                              setExpandedSlotId(isExpanded ? null : slot.id)
                            }
                            className="flex items-center gap-1 text-[10px] transition-all"
                            style={{
                              color: isExpanded
                                ? "rgb(125,211,252)"
                                : "rgba(255,255,255,0.25)",
                            }}
                          >
                            <span>{isExpanded ? "⮟" : "►"}</span>
                            <span>
                              {isExpanded ? "Hide preview" : "Preview 📷"}
                            </span>
                          </button>
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3 align-top">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => runCron(slot.id)}
                              disabled={cronStatus.status === "loading"}
                              className="p-1.5 rounded-lg transition-all opacity-50 group-hover:opacity-100 hover:bg-indigo-500/20 disabled:opacity-20 disabled:cursor-not-allowed"
                              title="Force-run this slot now"
                            >
                              {cronStatus.status === "loading" ? (
                                <Loader className="w-3.5 h-3.5 text-white/50 animate-spin" />
                              ) : (
                                <Play className="w-3.5 h-3.5 text-indigo-300" />
                              )}
                            </button>

                            <button
                              onClick={() => toggleSlotPrecision(slot)}
                              className={`flex items-center gap-1.5 px-2 py-1 rounded-md transition-all border ${
                                isLandmark
                                  ? "bg-amber-500/20 border-amber-500/40 text-amber-400"
                                  : "bg-white/5 border-white/10 text-white/40 hover:bg-white/10"
                              }`}
                              title="Toggle Landmark Precision"
                            >
                              <Target
                                className={`w-3 h-3 ${isLandmark ? "opacity-100" : "opacity-40"}`}
                              />
                              <span className="text-[9px] font-bold uppercase tracking-wider">
                                {isLandmark ? "ON" : "OFF"}
                              </span>
                            </button>

                            <button
                              onClick={() => deleteSlot(slot.id)}
                              className="p-1.5 rounded-lg transition-all opacity-30 group-hover:opacity-100 hover:bg-red-500/20 disabled:opacity-20 ml-auto"
                              title="Delete Slot"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-red-400" />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expandable Street View Inspector row */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={5} className="px-4 pb-4">
                            <StreetViewInspector
                              lat={slot.lat}
                              lng={slot.lng}
                              heading={slot.heading}
                              isTripStop={true}
                              isLandmarkPrecision={isLandmark}
                              label={slot.slot_label}
                              onSaveOverride={(overrides) =>
                                handleSaveOverride(slot.id, overrides)
                              }
                              isSavingOverride={savingSlotId === slot.id}
                            />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* ── 3. Cron Log ── */}
      <section>
        <SectionHeader
          icon={<ScrollText className="w-4 h-4" />}
          title="Cron Log"
          badge={logLoading ? "…" : `${cronLog.length} entries`}
          onRefresh={fetchCronLog}
          loading={logLoading}
        />
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            border: "1px solid rgba(255,255,255,0.07)",
            background: "rgba(0,0,0,0.25)",
          }}
        >
          {logLoading && cronLog.length === 0 ? (
            <div className="py-10 flex items-center justify-center text-white/30 text-sm">
              <Loader className="w-4 h-4 animate-spin mr-2" /> Loading log…
            </div>
          ) : cronLog.length === 0 ? (
            <div className="py-10 text-center text-white/25 text-sm">
              No log entries yet — run the cron to get started
            </div>
          ) : (
            <AnimatePresence initial={false}>
              <div
                className="divide-y"
                style={{ borderColor: "rgba(255,255,255,0.04)" }}
              >
                {cronLog.map((entry, idx) => (
                  <motion.div
                    key={entry.id}
                    initial={idx === 0 ? { opacity: 0, y: -6 } : false}
                    animate={{ opacity: 1, y: 0 }}
                    className="px-4 py-3 grid grid-cols-[auto_1fr_auto] gap-3 items-start hover:bg-white/[0.02] transition-colors"
                  >
                    {/* Status icon */}
                    <div className="pt-0.5">
                      <StatusChip status={entry.status} />
                    </div>

                    {/* Main info */}
                    <div className="min-w-0">
                      {entry.status === "error" ? (
                        <p className="text-red-300/80 text-xs font-mono break-all leading-snug">
                          {entry.error_message || "Unknown error"}
                        </p>
                      ) : entry.location_name ? (
                        <p className="text-white/75 text-sm font-medium truncate">
                          {entry.location_name}
                        </p>
                      ) : (
                        <p className="text-white/30 text-xs italic">
                          No location
                        </p>
                      )}

                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        {entry.album_title && (
                          <span className="text-white/35 text-[10px] truncate max-w-[180px]">
                            📚 {entry.album_title}
                          </span>
                        )}
                        {entry.strategy && (
                          <span className="text-indigo-300/50 text-[10px] font-mono">
                            {entry.strategy}
                          </span>
                        )}
                        {entry.postcard_id && (
                          <a
                            href={`/p/${entry.postcard_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] font-mono text-white/25 hover:text-indigo-300 transition-colors"
                            style={{ textDecoration: "none" }}
                          >
                            🔍 {entry.postcard_id.slice(0, 8)}
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Right meta */}
                    <div className="text-right space-y-1 shrink-0">
                      <div className="flex items-center gap-1 justify-end">
                        <TriggerBadge triggeredBy={entry.triggered_by} />
                      </div>
                      <div className="flex items-center gap-1 justify-end">
                        <Clock className="w-3 h-3 text-white/20" />
                        <span className="text-white/30 text-[10px] font-mono">
                          {timeAgo(entry.created_at)}
                        </span>
                      </div>
                      {entry.duration_ms != null && (
                        <p className="text-white/20 text-[10px] font-mono">
                          ⏱ {durationLabel(entry.duration_ms)}
                        </p>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </AnimatePresence>
          )}
        </div>
        <p className="text-white/20 text-[10px] mt-2 ml-1">
          Auto-refreshes every 15 seconds
        </p>
      </section>
    </div>
  );
}

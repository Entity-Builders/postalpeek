/**
 * AdminUI.tsx — Shared UI primitives for Admin pages
 */

import React from 'react';
import { motion } from 'framer-motion';
import { Loader } from 'lucide-react';

export type ActionStatus = 'idle' | 'loading' | 'success' | 'error';

export function ActionBtn({
  onClick,
  disabled,
  children,
  variant = 'default',
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'danger' | 'amber';
}) {
  const gradients = {
    default: 'linear-gradient(135deg, rgba(99,102,241,0.6), rgba(139,92,246,0.6))',
    success:  'linear-gradient(135deg, rgba(16,185,129,0.6), rgba(5,150,105,0.6))',
    danger:   'linear-gradient(135deg, rgba(239,68,68,0.5), rgba(220,38,38,0.5))',
    amber:    'linear-gradient(135deg, rgba(245,158,11,0.6), rgba(217,119,6,0.6))',
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full px-4 py-2.5 rounded-xl text-sm font-medium text-white transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 hover:brightness-110 border border-white/5"
      style={{ background: gradients[variant] }}
    >
      {children}
    </button>
  );
}

export function StatusMsg({ status, message }: { status: ActionStatus; message: string }) {
  if (status === 'idle' || !message) return null;
  const colors = {
    loading: 'bg-indigo-950/60 text-indigo-300 border-indigo-700/30',
    success: 'bg-emerald-950/60 text-emerald-300 border-emerald-700/30',
    error:   'bg-red-950/60 text-red-300 border-red-700/30',
  } as const;
  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className={`mt-2 px-3 py-2 rounded-lg text-xs flex items-center gap-2 border ${colors[status]}`}
    >
      {status === 'loading' && <Loader className="w-3 h-3 animate-spin shrink-0" />}
      {status === 'success' && '✅'}
      {status === 'error' && '❌'}
      <span className="break-all">{message}</span>
    </motion.div>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-white/50 text-[10px] uppercase tracking-widest font-semibold mb-3">
      {children}
    </h3>
  );
}

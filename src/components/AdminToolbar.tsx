import React, { useState } from 'react';
import { motion } from 'framer-motion';
import type { User } from '@supabase/supabase-js';
import { AdminPanelModal } from './AdminPanelModal';

interface AdminToolbarProps {
  isAdmin: boolean;
  user?: User | null;
  onPostcardGenerated?: () => void;
}

export function AdminToolbar({
  isAdmin,
  user = null,
  onPostcardGenerated,
}: AdminToolbarProps) {
  const [isOpen, setIsOpen] = useState(false);

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

      {/* Fullscreen Admin Panel Modal */}
      <AdminPanelModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        user={user}
        onPostcardGenerated={onPostcardGenerated}
      />
    </>
  );
}

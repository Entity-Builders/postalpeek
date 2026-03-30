import React, { useState } from 'react';
import { User as UserIcon, LogOut, Settings } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@eb-packages/logic/src/hooks/useAuth';
import { useLang, t } from '../utils/i18n';
import { analytics } from '../lib/analytics';

interface ProfileWidgetProps {
  handleAuthRequiredAction: (action: () => void) => void;
  isIdle?: boolean;
}

export function ProfileWidget({ handleAuthRequiredAction, isIdle }: ProfileWidgetProps) {
  const { user, signOut } = useAuth();
  const lang = useLang();
  const [isOpen, setIsOpen] = useState(false);

  const toggleModal = () => {
    handleAuthRequiredAction(() => {
      setIsOpen((prev) => !prev);
    });
  };

  const handleSignOut = async () => {
    analytics.track('user_signed_out');
    setIsOpen(false);
    await signOut();
  };

  if (!user && !isOpen) {
    // Si no hay usuario y el modal no esta abierto, mostramos el icono igual,
    // pero al tocarlo llamará a handleAuthRequiredAction, mostrando el AuthGateModal.
    return (
      <div className={`absolute top-3 right-4 z-[70] transition-opacity duration-1000 ${isIdle ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
        <button
          onClick={toggleModal}
          className="flex items-center justify-center w-10 h-10 rounded-full bg-black/40 backdrop-blur-md border border-white/15 shadow-lg hover:bg-white/10 hover:border-white/30 transition-all duration-300"
          title={t({ es: 'Perfil', en: 'Profile' }, lang)}
        >
          <UserIcon className="w-5 h-5 text-stone-300" />
        </button>
      </div>
    );
  }

  return (
    <div className={`absolute top-3 right-4 z-[70] transition-opacity duration-1000 ${isIdle && !isOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
      <button
        onClick={toggleModal}
        className="flex items-center justify-center w-10 h-10 rounded-full bg-black/40 backdrop-blur-md border border-white/15 shadow-lg hover:bg-white/10 hover:border-white/30 transition-all duration-300 relative z-10"
        title={t({ es: 'Perfil', en: 'Profile' }, lang)}
      >
        <UserIcon className="w-5 h-5 text-stone-300" />
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 z-0 bg-black/20"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className="absolute top-12 right-0 mt-2 w-64 bg-stone-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-20 origin-top-right"
            >
              <div className="p-4 border-b border-white/10 flex flex-col items-center">
                <div className="w-12 h-12 bg-purple-500/20 rounded-full flex items-center justify-center mb-2 text-purple-400">
                  <UserIcon className="w-6 h-6" />
                </div>
                <p className="text-sm text-stone-200 font-medium truncate w-full text-center">
                  {user?.email || 'User'}
                </p>
              </div>

              <div className="p-2 flex flex-col gap-1">
                {/* Placeholder para futuras settings */}
                <button
                  className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-left text-sm text-stone-300 hover:bg-white/5 transition-colors"
                  onClick={() => setIsOpen(false)}
                >
                  <Settings className="w-4 h-4 text-stone-400" />
                  {t({ es: 'Configuración', en: 'Settings' }, lang)}
                </button>
                <div className="h-px bg-white/10 my-1 mx-2" />
                <button
                  onClick={handleSignOut}
                  className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-left text-sm text-rose-400 hover:bg-rose-500/10 transition-colors"
                >
                  <LogOut className="w-4 h-4 text-rose-500" />
                  {t({ es: 'Cerrar Sesión', en: 'Sign Out' }, lang)}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

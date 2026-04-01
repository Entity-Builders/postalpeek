import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User as UserIcon, LogOut, ChevronLeft, Globe } from 'lucide-react';
import { useAuth } from '@eb-packages/logic/src/hooks/useAuth';
import { useStampContext } from '../../contexts/StampContext';
import { useLang, t, toggleLang } from '../../utils/i18n';
import { analytics } from '../../lib/analytics';
import { PostalPeekStampSVG } from '../../components/ui/PostalPeekStampSVG';

export function ProfilePage() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { stampBalances } = useStampContext();
  const lang = useLang();
  
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    analytics.track('user_signed_out');
    await signOut();
    navigate('/feed');
  };

  return (
    <div className='w-full h-full flex flex-col relative bg-[#e6e2da] overflow-hidden overflow-y-auto pb-safe'>
      {/* Header */}
      <div className='sticky top-0 z-50 flex items-center justify-between px-4 py-4 bg-[#e6e2da]/90 backdrop-blur-md border-b border-black/5'>
        <button
          onClick={() => navigate(-1)}
          className='flex items-center gap-1.5 px-3 py-2 rounded-full bg-black/5 text-stone-700 text-xs font-semibold hover:bg-black/10 transition-all cursor-pointer'
        >
          <ChevronLeft className="w-4 h-4" />
          {t({ es: 'Volver', en: 'Back' }, lang)}
        </button>
        <span className='font-medium text-stone-800 tracking-wide'>
          {t({ es: 'Mi Perfil', en: 'My Profile' }, lang)}
        </span>
        <div className='w-16' /> {/* Spacer for centering */}
      </div>

      <div className='flex flex-col flex-1 px-4 py-8 items-center max-w-md mx-auto w-full'>
        {/* Avatar Section */}
        <div className='flex flex-col items-center mb-8'>
          <div className='w-24 h-24 bg-purple-500/10 rounded-full flex items-center justify-center mb-4 text-purple-600 shadow-inner border border-purple-500/20'>
            <UserIcon className='w-12 h-12' />
          </div>
          <h2 className='text-xl sm:text-2xl font-bold text-stone-800 text-center truncate w-full px-4'>
            {user?.email || 'Guest'}
          </h2>
          <span className='px-3 py-1 mt-3 rounded-full bg-green-500/10 text-green-700 text-xs font-semibold border border-green-500/20 flex items-center gap-1.5'>
            <span className='w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse' />
            {t({ es: 'Sesión Activa', en: 'Active Session' }, lang)}
          </span>
        </div>

        {/* Stats Section */}
        <div className='w-full grid grid-cols-1 gap-3 mb-8'>
          <div className='bg-white/40 border border-white/60 p-4 rounded-3xl flex flex-col justify-between shadow-sm'>
            <div className='flex items-center justify-between mb-4 px-2'>
              <div className='flex flex-col'>
                <span className='text-[10px] sm:text-xs font-bold uppercase tracking-widest text-stone-500'>
                  {t({ es: 'Mis Sellos', en: 'My Stamps' }, lang)}
                </span>
                <span className='text-lg font-bold text-stone-800 leading-tight flex items-baseline gap-1.5'>
                  {stampBalances?.balance ?? 0}
                  <span className='text-[10px] text-stone-500 font-semibold uppercase tracking-wider'>
                    {t({ es: 'Disponibles', en: 'Available' }, lang)}
                  </span>
                </span>
              </div>
              
              <div className='flex items-center gap-4 text-right'>
                 <div className='flex flex-col items-end'>
                    <span className='text-[9px] font-bold uppercase tracking-widest text-emerald-600/70'>
                      {t({ es: 'Ganados', en: 'Earned' }, lang)}
                    </span>
                    <span className='text-sm font-bold text-emerald-700 leading-tight'>
                      {stampBalances?.total_earned ?? 0}
                    </span>
                 </div>
                 <div className='flex flex-col items-end'>
                    <span className='text-[9px] font-bold uppercase tracking-widest text-rose-500/70'>
                      {t({ es: 'En Álbumes', en: 'In Albums' }, lang)}
                    </span>
                    <span className='text-sm font-bold text-rose-600 leading-tight'>
                      {stampBalances?.total_spent ?? 0}
                    </span>
                 </div>
              </div>
            </div>

            <div className="flex justify-between items-center bg-white/50 p-3 rounded-2xl border border-white/40">
              <div className="flex flex-col items-center gap-1.5 flex-1">
                <PostalPeekStampSVG rarity="common" className='w-6 h-6 text-stone-300 drop-shadow-sm' />
                <div className='flex flex-col items-center leading-none'>
                  <span className='text-[11px] font-bold text-stone-700'>{stampBalances?.common ?? 0}</span>
                  <span className='text-[8px] font-extrabold uppercase tracking-widest text-stone-400'>{t({ es: 'Común', en: 'Common' }, lang)}</span>
                </div>
              </div>
              <div className="w-px h-8 bg-stone-200/50" />
              <div className="flex flex-col items-center gap-1.5 flex-1">
                <PostalPeekStampSVG rarity="rare" className='w-6 h-6 text-blue-400 drop-shadow-sm' />
                <div className='flex flex-col items-center leading-none'>
                  <span className='text-[11px] font-bold text-stone-700'>{stampBalances?.rare ?? 0}</span>
                  <span className='text-[8px] font-extrabold uppercase tracking-widest text-stone-400'>{t({ es: 'Raro', en: 'Rare' }, lang)}</span>
                </div>
              </div>
              <div className="w-px h-8 bg-stone-200/50" />
              <div className="flex flex-col items-center gap-1.5 flex-1">
                <PostalPeekStampSVG rarity="epic" className='w-6 h-6 text-purple-400 drop-shadow-sm' />
                <div className='flex flex-col items-center leading-none'>
                  <span className='text-[11px] font-bold text-stone-700'>{stampBalances?.epic ?? 0}</span>
                  <span className='text-[8px] font-extrabold uppercase tracking-widest text-stone-400'>{t({ es: 'Épico', en: 'Epic' }, lang)}</span>
                </div>
              </div>
              <div className="w-px h-8 bg-stone-200/50" />
              <div className="flex flex-col items-center gap-1.5 flex-1">
                <PostalPeekStampSVG rarity="legendary" className='w-6 h-6 text-amber-400 drop-shadow-sm' />
                <div className='flex flex-col items-center leading-none'>
                  <span className='text-[11px] font-bold text-stone-700'>{stampBalances?.legendary ?? 0}</span>
                  <span className='text-[8px] font-extrabold uppercase tracking-widest text-stone-400'>{t({ es: 'Leyenda', en: 'Legend' }, lang)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Actions Section */}
        <div className='w-full flex flex-col gap-3'>
          <button
            onClick={() => toggleLang()}
            className='bg-white/40 border border-white/60 p-4 rounded-3xl flex items-center justify-between hover:bg-white/60 transition-colors shadow-sm'
          >
            <div className='flex items-center gap-3'>
              <div className='w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center'>
                <Globe className='w-5 h-5 text-blue-600' />
              </div>
              <span className='text-sm font-semibold text-stone-700'>
                {t({ es: 'Idioma', en: 'Language' }, lang)}
              </span>
            </div>
            <div className='flex flex-col items-end gap-0.5 justify-center'>
               <span className='text-[10px] font-bold tracking-widest text-stone-400'>ACTUAL</span>
               <span className='text-xs font-bold text-blue-600 pr-1'>
                 {lang === 'es' ? 'ESPAÑOL' : 'ENGLISH'}
               </span>
            </div>
          </button>
          
          <button
            onClick={handleSignOut}
            disabled={isSigningOut}
            className='bg-rose-500/10 border border-rose-500/20 p-4 rounded-3xl flex items-center gap-3 hover:bg-rose-500/20 transition-colors shadow-sm mt-4'
          >
            <div className='w-10 h-10 rounded-full bg-rose-500/10 flex items-center justify-center'>
              {isSigningOut ? (
                <div className='w-5 h-5 border-2 border-rose-500/30 border-t-rose-600 rounded-full animate-spin' />
              ) : (
                <LogOut className='w-5 h-5 text-rose-600' />
              )}
            </div>
            <span className='text-sm font-semibold text-rose-700'>
              {t({ es: 'Cerrar Sesión', en: 'Sign Out' }, lang)}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

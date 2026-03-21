import { useLang, toggleLang } from '../../utils/i18n';

interface LanguageToggleProps {
  isIdle?: boolean;
  isOnWelcome: boolean;
}

export function LanguageToggle({ isIdle, isOnWelcome }: LanguageToggleProps) {
  const lang = useLang();
  return (
    <button
      className={`absolute bottom-6 left-4 z-50 flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest backdrop-blur-md border transition-all duration-700 cursor-pointer
        bg-black/30 text-white/80 border-white/15 hover:bg-black/50 hover:text-white shadow-lg
        ${isIdle || isOnWelcome ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
      onClick={() => toggleLang()}
      title={lang === 'es' ? 'Switch to English' : 'Cambiar a Español'}
    >
      <span className={lang === 'es' ? 'text-white' : 'text-white/40'}>ES</span>
      <span className='text-white/30'>|</span>
      <span className={lang === 'en' ? 'text-white' : 'text-white/40'}>EN</span>
    </button>
  );
}

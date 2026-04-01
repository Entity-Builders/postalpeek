import React from 'react';
import { User as UserIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLang, t } from '../utils/i18n';

interface ProfileWidgetProps {
  handleAuthRequiredAction: (action: () => void) => void;
  isIdle?: boolean;
  className?: string;
}

export function ProfileWidget({ handleAuthRequiredAction, isIdle, className }: ProfileWidgetProps) {
  const lang = useLang();
  const navigate = useNavigate();

  const handleProfileClick = () => {
    handleAuthRequiredAction(() => {
      navigate('/feed/profile');
    });
  };

  return (
    <div className={`relative z-[70] ${className || ''} ${isIdle ? 'opacity-0 pointer-events-none transition-opacity duration-1000' : 'opacity-100 transition-opacity duration-1000'}`}>
      <button
        onClick={handleProfileClick}
        className="flex items-center justify-center w-10 h-10 rounded-full bg-black/40 backdrop-blur-md border border-white/15 shadow-lg hover:bg-white/10 hover:border-white/30 transition-all duration-300 relative z-10"
        title={t({ es: 'Perfil', en: 'Profile' }, lang)}
      >
        <UserIcon className="w-5 h-5 text-stone-300" />
      </button>
    </div>
  );
}

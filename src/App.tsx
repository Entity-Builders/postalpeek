import React, { useState, useRef, useCallback } from 'react';
import './index.css';
import { WalkerFeed } from './components/WalkerFeed';
import { useMouseIdle } from './hooks/useMouseIdle';
import { useAuth } from '@eb-packages/logic/src/hooks/useAuth';
import { AdminLoginModal } from './components/AdminLoginModal';

function App() {
  const isIdle = useMouseIdle(5000);
  const { user, isAdmin, signIn, signOut } = useAuth();
  const [showLogin, setShowLogin] = useState(false);

  // --- Secret triple-click login trigger ---
  const clickCount = useRef(0);
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleFooterClick = useCallback(() => {
    clickCount.current += 1;

    if (clickTimer.current) clearTimeout(clickTimer.current);

    if (clickCount.current >= 3) {
      clickCount.current = 0;
      if (user) {
        // Already logged in → sign out
        signOut();
      } else {
        setShowLogin(true);
      }
      return;
    }

    clickTimer.current = setTimeout(() => {
      clickCount.current = 0;
    }, 600); // 600ms window for triple-click
  }, [user, signOut]);

  return (
    <div className='w-screen h-[100dvh] relative overflow-hidden flex flex-col'>
      {/* Walker Feed Fullscreen */}
      <div className='flex-1 w-full h-full relative'>
        <WalkerFeed isIdle={isIdle} isAdmin={isAdmin} user={user} />
      </div>

      {/* Footer - Absolute overlay */}
      <footer
        className={`absolute bottom-4 left-0 right-0 text-center z-50 text-white/30 text-[10px] md:text-xs font-light tracking-widest uppercase transition-all duration-1000 ${isIdle ? 'opacity-0 translate-y-4 pointer-events-none' : 'opacity-100 translate-y-0'}`}
      >
        <span
          onClick={handleFooterClick}
          className='cursor-default select-none inline-flex items-center gap-1.5'
        >
          Powered by{' '}
          <strong className='text-white/60 font-medium'>Entity Builders</strong>
          {isAdmin && (
            <span className='inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse' />
          )}
        </span>
      </footer>

      {/* Secret Admin Login Modal */}
      {showLogin && (
        <AdminLoginModal
          onLogin={async (email: string, password: string) => {
            await signIn(email, password);
            setShowLogin(false);
          }}
          onClose={() => setShowLogin(false)}
        />
      )}
    </div>
  );
}

export default App;

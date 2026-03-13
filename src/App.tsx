import React from 'react';
import './index.css';
import { WalkerFeed } from './components/WalkerFeed';
import { useMouseIdle } from './hooks/useMouseIdle';

function App() {
  const isIdle = useMouseIdle(5000);

  return (
    <div className='w-screen h-[100dvh] relative overflow-hidden flex flex-col'>
      {/* Walker Feed Fullscreen */}
      <div className='flex-1 w-full h-full relative'>
        <WalkerFeed isIdle={isIdle} />
      </div>

      {/* Footer - Absolute overlay */}
      <footer
        className={`absolute bottom-4 left-0 right-0 text-center z-50 text-white/30 text-[10px] md:text-xs font-light tracking-widest uppercase transition-all duration-1000 ${isIdle ? 'opacity-0 translate-y-4 pointer-events-none' : 'opacity-100 translate-y-0'}`}
      >
        Powered by{' '}
        <strong className='text-white/60 font-medium'>Entity Builders</strong>
      </footer>
    </div>
  );
}

export default App;

import React from 'react';
import './index.css';
import { WalkerFeed } from './components/WalkerFeed';
import { useMouseIdle } from './hooks/useMouseIdle';

function App() {
  const isIdle = useMouseIdle(5000);

  return (
    <div className='w-screen h-screen bg-black relative overflow-hidden flex flex-col'>
      {/* Header section - Absolute overlay */}
      <header className={`absolute top-0 left-0 right-0 z-50 p-6 md:p-10 flex flex-col items-center gap-3 transition-all duration-1000 ${isIdle ? 'opacity-0 -translate-y-8 pointer-events-none' : 'opacity-100 translate-y-0'}`}>
        <div className='inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-black/40 border border-white/10 text-sm mx-auto text-indigo-300 font-medium shadow-lg backdrop-blur-md'>
          <span className='relative flex h-2 w-2'>
            <span className='animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75'></span>
            <span className='relative inline-flex rounded-full h-2 w-2 bg-indigo-500'></span>
          </span>
          Entity Builders Showcase
        </div>
        <h1 className='text-3xl md:text-4xl font-extrabold tracking-tight drop-shadow-2xl px-4 text-white text-center'>
          The World, <span className='text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-pink-500'>Reimagined.</span>
        </h1>
      </header>

      {/* Walker Feed Fullscreen */}
      <div className='flex-1 w-full h-full relative'>
        <WalkerFeed isIdle={isIdle} />
      </div>

      {/* Footer - Absolute overlay */}
      <footer className={`absolute bottom-4 left-0 right-0 text-center z-50 text-white/30 text-[10px] md:text-xs font-light tracking-widest uppercase transition-all duration-1000 ${isIdle ? 'opacity-0 translate-y-4 pointer-events-none' : 'opacity-100 translate-y-0'}`}>
        Powered by <strong className='text-white/60 font-medium'>Entity Builders</strong>
      </footer>
    </div>
  );
}

export default App;

import React from 'react';
import './index.css';
import { WalkerFeed } from './components/WalkerFeed';

function App() {
  return (
    <div className='min-h-screen flex flex-col items-center justify-start p-6 pt-12 md:pt-20 relative overflow-x-hidden'>
      {/* Background decoration */}
      <div className='fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-500 rounded-full blur-[120px] opacity-20 pointer-events-none' />
      <div className='fixed top-[20%] right-[-10%] w-[30%] h-[50%] bg-pink-500 rounded-full blur-[120px] opacity-10 pointer-events-none' />

      {/* Main Content Container */}
      <main className='w-full max-w-5xl z-10 flex flex-col items-center gap-8 text-center animate-fade-in relative'>
        {/* Header section */}
        <header className='flex flex-col gap-4'>
          <div className='inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-sm mx-auto text-indigo-300 font-medium mb-4 shadow-lg backdrop-blur-sm'>
            <span className='relative flex h-2 w-2'>
              <span className='animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75'></span>
              <span className='relative inline-flex rounded-full h-2 w-2 bg-indigo-500'></span>
            </span>
            Entity Builders Showcase
          </div>
          <h1 className='text-4xl md:text-6xl font-extrabold tracking-tight drop-shadow-sm px-4'>
            The World,
            <br className='hidden md:block' />
            <span className='text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-pink-500 drop-shadow-lg leading-tight md:leading-normal py-1 inline-block'>
              Reimagined.
            </span>
          </h1>
          <p className='text-base md:text-lg text-slate-400 max-w-xl mx-auto font-light mt-2 mb-4 px-4 text-balance'>
            An autonomous agent wandering the globe, capturing street photography, and painting its impressions in real-time.
          </p>
        </header>

        {/* Walker Feed */}
        <div className='w-full px-2'>
          <WalkerFeed />
        </div>
      </main>

      {/* Footer */}
      <footer className='mt-auto pt-16 pb-8 z-10 text-slate-500 text-sm font-light tracking-wide'>
        Crafted with precision by{' '}
        <strong className='text-slate-300 font-medium'>Entity Builders</strong>
      </footer>
    </div>
  );
}

export default App;

import React, { useState } from 'react';
import { Search, MapPin } from 'lucide-react';
import { cn } from '../utils/cn';
export { cn };

interface SearchBarProps {
  onSearch: (query: string) => void;
  isLoading?: boolean;
}

export function SearchBar({ onSearch, isLoading }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query.trim());
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        'relative w-full max-w-2xl mx-auto transition-all duration-300 transform',
        isFocused ? 'scale-[1.02]' : 'scale-100',
      )}
    >
      <div
        className={cn(
          'relative flex items-center w-full bg-white/5 backdrop-blur-xl border rounded-2xl overflow-hidden transition-all duration-300',
          isFocused
            ? 'border-indigo-500/50 shadow-[0_0_30px_rgba(99,102,241,0.2)] bg-white/10'
            : 'border-white/10 shadow-lg hover:bg-white/10',
        )}
      >
        <div className='pl-6 flex items-center justify-center text-slate-400'>
          <MapPin className='w-6 h-6' />
        </div>

        <input
          type='text'
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder='Enter any address (e.g. 1600 Amphitheatre Parkway)'
          className='w-full py-5 px-4 bg-transparent text-white placeholder:text-slate-500 focus:outline-none text-lg font-light'
          disabled={isLoading}
        />

        <div className='pr-3'>
          <button
            type='submit'
            disabled={!query.trim() || isLoading}
            className={cn(
              'flex items-center justify-center p-3 rounded-xl transition-all duration-200',
              query.trim() && !isLoading
                ? 'bg-indigo-500 text-white hover:bg-indigo-400 hover:shadow-[0_0_15px_rgba(99,102,241,0.5)] cursor-pointer'
                : 'bg-white/5 text-slate-500 cursor-not-allowed',
            )}
          >
            {isLoading ? (
              <div className='w-6 h-6 border-2 border-indigo-200 border-t-indigo-500 rounded-full animate-spin' />
            ) : (
              <Search className='w-6 h-6' />
            )}
          </button>
        </div>
      </div>
    </form>
  );
}

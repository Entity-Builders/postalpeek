import React from 'react';
import { Search, X } from 'lucide-react';

interface CollectionFilterBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  activeFilters: string[];
  onToggleFilter: (filter: string) => void;
  suggestedTags: string[];
}

export function CollectionFilterBar({
  searchQuery,
  onSearchChange,
  activeFilters,
  onToggleFilter,
  suggestedTags,
}: CollectionFilterBarProps) {
  return (
    <div className="px-4 pb-4">
      {/* Search Input */}
      <div className="relative mb-3">
        <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
          <Search className="w-4 h-4 text-stone-400" />
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Buscar destino, etiqueta, color..."
          className="w-full bg-white border border-stone-200 rounded-full py-2 pl-9 pr-10 text-sm text-stone-700 placeholder-stone-400 outline-none focus:border-stone-400 focus:ring-1 focus:ring-stone-400 transition-shadow shadow-sm"
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange('')}
            className="absolute inset-y-0 right-3 flex items-center"
          >
            <X className="w-4 h-4 text-stone-400 hover:text-stone-600" />
          </button>
        )}
      </div>

      {/* Suggested Tags (Chips) */}
      <div className="flex overflow-x-auto hide-scrollbar gap-2 pb-1">
        {suggestedTags.map((tag) => {
          const isActive = activeFilters.includes(tag);
          return (
            <button
              key={tag}
              onClick={() => onToggleFilter(tag)}
              className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                isActive
                  ? 'bg-stone-800 text-white border-stone-800'
                  : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-100 hover:text-stone-800'
              }`}
            >
              {tag}
            </button>
          );
        })}
      </div>
    </div>
  );
}

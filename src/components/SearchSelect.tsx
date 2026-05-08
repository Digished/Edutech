'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ChevronDownIcon, SearchIcon, XIcon } from './icons';

export interface SearchSelectOption {
  value: string;
  label: string;
  hint?: string;
}

interface SearchSelectProps {
  options: SearchSelectOption[];
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  emptyText?: string;
  className?: string;
  allowClear?: boolean;
}

export default function SearchSelect({
  options,
  value,
  onChange,
  placeholder = 'Search…',
  emptyText = 'No matches',
  className,
  allowClear = true,
}: SearchSelectProps) {
  const id = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selected = options.find((o) => o.value === value) ?? null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options.slice(0, 100);
    return options
      .filter((o) =>
        o.label.toLowerCase().includes(q) ||
        (o.hint?.toLowerCase().includes(q) ?? false),
      )
      .slice(0, 100);
  }, [options, query]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  return (
    <div ref={wrapRef} className={`relative ${className ?? ''}`}>
      <button
        type="button"
        id={id}
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
      >
        <span className={`truncate text-left ${selected ? '' : 'text-zinc-400'}`}>
          {selected ? selected.label : placeholder}
        </span>
        <span className="flex items-center gap-1 shrink-0 text-zinc-400">
          {allowClear && selected && (
            <span
              role="button"
              tabIndex={-1}
              onClick={(e) => { e.stopPropagation(); onChange(''); setQuery(''); }}
              className="p-0.5 rounded hover:text-zinc-700 dark:hover:text-zinc-200"
              aria-label="Clear"
            >
              <XIcon size={14} />
            </span>
          )}
          <ChevronDownIcon size={16} className={open ? 'rotate-180 transition-transform' : 'transition-transform'} />
        </span>
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-zinc-100 dark:border-zinc-800">
            <SearchIcon size={14} className="text-zinc-400" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={placeholder}
              className="flex-1 bg-transparent text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none"
            />
          </div>
          <div className="max-h-64 overflow-auto py-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-3 text-xs text-zinc-400">{emptyText}</div>
            ) : (
              filtered.map((o) => {
                const active = o.value === value;
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => { onChange(o.value); setOpen(false); setQuery(''); }}
                    className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-3 ${
                      active
                        ? 'bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-400'
                        : 'text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                    }`}
                  >
                    <span className="truncate">{o.label}</span>
                    {o.hint && <span className="text-xs text-zinc-400 shrink-0">{o.hint}</span>}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

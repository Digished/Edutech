'use client';

import { useRef, useState } from 'react';
import { PlusIcon, TrashIcon, AlertTriangleIcon } from './icons';

interface Props {
  value: string[];
  onChange: (next: string[]) => void;
  // 0 = unlimited (capped at 8 internally).
  max?: number;
  label?: string;
  hint?: string;
}

const HARD_CAP = 8;

export default function ImageUploader({ value, onChange, max = HARD_CAP, label, hint }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const cap = Math.min(max || HARD_CAP, HARD_CAP);
  const canAddMore = value.length < cap;

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError('');
    setUploading(true);
    try {
      const next = [...value];
      for (const file of Array.from(files)) {
        if (next.length >= cap) break;
        const fd = new FormData();
        fd.append('file', file);
        const res = await fetch('/api/uploads/image', { method: 'POST', body: fd });
        const json = await res.json();
        if (!res.ok || !json.data?.url) {
          setError(json.error ?? 'Upload failed');
          continue;
        }
        next.push(json.data.url as string);
      }
      onChange(next);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  function removeAt(idx: number) {
    onChange(value.filter((_, i) => i !== idx));
  }

  return (
    <div>
      {label && (
        <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
          {label}
        </label>
      )}
      {hint && (
        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mb-2">{hint}</p>
      )}
      <div className="flex flex-wrap gap-2">
        {value.map((url, i) => (
          <div
            key={`${url}-${i}`}
            className="relative w-24 h-24 rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 group"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={() => removeAt(i)}
              title="Remove image"
              className="absolute top-1 right-1 w-6 h-6 rounded-md bg-black/60 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center"
            >
              <TrashIcon size={12} />
            </button>
          </div>
        ))}
        {canAddMore && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="w-24 h-24 rounded-lg border-2 border-dashed border-zinc-300 dark:border-zinc-700 hover:border-green-400 dark:hover:border-green-700 text-zinc-500 dark:text-zinc-400 hover:text-green-600 dark:hover:text-green-400 flex flex-col items-center justify-center gap-1 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <PlusIcon size={16} />
            <span className="text-[11px] font-medium">{uploading ? 'Uploading…' : 'Add image'}</span>
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      {error && (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400 inline-flex items-center gap-1.5">
          <AlertTriangleIcon size={12} /> {error}
        </p>
      )}
    </div>
  );
}

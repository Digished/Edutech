'use client';

import { useId, useState } from 'react';
import { EyeIcon, EyeOffIcon } from './icons';

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  inputClassName?: string;
};

export default function PasswordInput({
  inputClassName,
  className,
  ...rest
}: Props) {
  const [visible, setVisible] = useState(false);
  const reactId = useId();
  const id = rest.id ?? reactId;
  const baseInputClass =
    inputClassName ??
    'w-full pr-10 pl-3 py-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent';

  return (
    <div className={`relative ${className ?? ''}`}>
      <input {...rest} id={id} type={visible ? 'text' : 'password'} className={baseInputClass} />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
        aria-controls={id}
        className="absolute inset-y-0 right-0 flex items-center pr-3 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
      >
        {visible ? <EyeOffIcon size={16} /> : <EyeIcon size={16} />}
      </button>
    </div>
  );
}

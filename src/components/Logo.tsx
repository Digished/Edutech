import type { SVGProps } from 'react';

type LogoProps = SVGProps<SVGSVGElement> & {
  size?: number;
};

export function LogoMark({ size = 32, className, ...rest }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Examspace"
      className={className}
      {...rest}
    >
      <rect width="32" height="32" rx="8" fill="#16a34a" />
      <rect x="8.5" y="8.5" width="15" height="3" rx="1.5" fill="white" />
      <rect x="8.5" y="14.5" width="10" height="3" rx="1.5" fill="white" />
      <rect x="8.5" y="20.5" width="15" height="3" rx="1.5" fill="white" />
    </svg>
  );
}

type BrandProps = {
  size?: 'sm' | 'md' | 'lg';
  href?: string | null;
  className?: string;
  showWordmark?: boolean;
};

const SIZE_MAP = {
  sm: { mark: 24, text: 'text-sm' },
  md: { mark: 32, text: 'text-lg' },
  lg: { mark: 40, text: 'text-xl' },
} as const;

export function Brand({ size = 'md', href = '/', className = '', showWordmark = true }: BrandProps) {
  const { mark, text } = SIZE_MAP[size];
  const inner = (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <LogoMark size={mark} />
      {showWordmark ? (
        <span className={`font-semibold tracking-tight text-zinc-900 dark:text-white ${text}`}>
          Examspace
        </span>
      ) : null}
    </span>
  );
  if (!href) return inner;
  return (
    <a href={href} className="inline-flex items-center hover:opacity-90 transition-opacity">
      {inner}
    </a>
  );
}

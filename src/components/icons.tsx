import * as React from 'react';

type IconProps = Omit<React.SVGProps<SVGSVGElement>, 'strokeWidth'> & {
  size?: number;
  strokeWidth?: number;
};

function base({ size = 16, strokeWidth = 1.75, ...rest }: IconProps): React.SVGProps<SVGSVGElement> {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
    ...rest,
  };
}

export function BookIcon(p: IconProps) { return (
  <svg {...base(p)}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></svg>
); }

export function FlaskIcon(p: IconProps) { return (
  <svg {...base(p)}><path d="M9 3h6" /><path d="M10 3v6.5L4.5 19a2 2 0 0 0 1.7 3h11.6a2 2 0 0 0 1.7-3L14 9.5V3" /><path d="M6.5 14h11" /></svg>
); }

export function UploadIcon(p: IconProps) { return (
  <svg {...base(p)}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M17 8l-5-5-5 5" /><path d="M12 3v12" /></svg>
); }

export function WalletIcon(p: IconProps) { return (
  <svg {...base(p)}><path d="M21 12V7a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h16v4" /><path d="M3 9v10a2 2 0 0 0 2 2h16v-6" /><circle cx="17" cy="14" r="1.25" /></svg>
); }

export function PenIcon(p: IconProps) { return (
  <svg {...base(p)}><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" /></svg>
); }

export function SearchIcon(p: IconProps) { return (
  <svg {...base(p)}><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
); }

export function FlagIcon(p: IconProps) { return (
  <svg {...base(p)}><path d="M4 22V4" /><path d="M4 4h13l-2 4 2 4H4" /></svg>
); }

export function PinIcon(p: IconProps) { return (
  <svg {...base(p)}><path d="M12 17v5" /><path d="M9 9V4h6v5l3 4H6l3-4z" /></svg>
); }

export function CheckIcon(p: IconProps) { return (
  <svg {...base(p)}><path d="M20 6 9 17l-5-5" /></svg>
); }

export function XIcon(p: IconProps) { return (
  <svg {...base(p)}><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
); }

export function ArrowRightIcon(p: IconProps) { return (
  <svg {...base(p)}><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
); }

export function ArrowLeftIcon(p: IconProps) { return (
  <svg {...base(p)}><path d="M19 12H5" /><path d="m12 19-7-7 7-7" /></svg>
); }

export function ChevronDownIcon(p: IconProps) { return (
  <svg {...base(p)}><path d="m6 9 6 6 6-6" /></svg>
); }

export function PlayIcon(p: IconProps) { return (
  <svg {...base({ ...p, strokeWidth: 2 })}><path d="M7 4v16l13-8z" /></svg>
); }

export function PauseIcon(p: IconProps) { return (
  <svg {...base(p)}><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
); }

export function InboxIcon(p: IconProps) { return (
  <svg {...base(p)}><path d="M22 12h-6l-2 3h-4l-2-3H2" /><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" /></svg>
); }

export function AlertTriangleIcon(p: IconProps) { return (
  <svg {...base(p)}><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>
); }

export function TrophyIcon(p: IconProps) { return (
  <svg {...base(p)}><path d="M8 21h8" /><path d="M12 17v4" /><path d="M7 4h10v6a5 5 0 0 1-10 0V4z" /><path d="M17 5h3v3a3 3 0 0 1-3 3" /><path d="M7 5H4v3a3 3 0 0 0 3 3" /></svg>
); }

export function GraduationIcon(p: IconProps) { return (
  <svg {...base(p)}><path d="M22 10 12 5 2 10l10 5 10-5z" /><path d="M6 12v5c0 1.66 2.69 3 6 3s6-1.34 6-3v-5" /></svg>
); }

export function LogOutIcon(p: IconProps) { return (
  <svg {...base(p)}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5" /><path d="M21 12H9" /></svg>
); }

export function TrashIcon(p: IconProps) { return (
  <svg {...base(p)}><path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
); }

export function ChevronUpIcon(p: IconProps) { return (
  <svg {...base(p)}><path d="m18 15-6-6-6 6" /></svg>
); }

export function CoinIcon(p: IconProps) { return (
  <svg {...base(p)}><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5h4a2 2 0 1 1 0 4H10a2 2 0 1 0 0 4h4.5" /></svg>
); }

export function SparklesIcon(p: IconProps) { return (
  <svg {...base(p)}><path d="M12 3l1.5 4 4 1.5-4 1.5L12 14l-1.5-4-4-1.5 4-1.5L12 3z" /><path d="M19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8L19 14z" /></svg>
); }

export function ClockIcon(p: IconProps) { return (
  <svg {...base(p)}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
); }

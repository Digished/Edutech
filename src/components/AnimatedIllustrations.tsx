// Self-contained animated SVGs using SMIL <animate> tags — no extra CSS needed.
// Each illustration is square-ish, scales to its container, and uses the
// brand green palette so it sits cleanly on light or dark backgrounds.

type IllustrationProps = {
  className?: string;
  title?: string;
};

const G = {
  brand: '#16a34a',
  brandSoft: '#bbf7d0',
  brandHover: '#15803d',
  ink: '#0f172a',
  inkSoft: '#94a3b8',
  card: '#ffffff',
  cardDark: '#18181b',
  border: '#e4e4e7',
  borderDark: '#27272a',
};

function Frame({
  children,
  className,
  title,
}: {
  children: React.ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <svg
      viewBox="0 0 240 180"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={title}
      className={className}
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <linearGradient id="bgGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f0fdf4" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="240" height="180" rx="16" fill="url(#bgGrad)" />
      {children}
    </svg>
  );
}

/* ---------- AI grading ---------- */
export function AIIllustration({ className, title = 'AI explanations and grading' }: IllustrationProps) {
  return (
    <Frame className={className} title={title}>
      {/* AI card */}
      <rect x="40" y="40" width="160" height="100" rx="14" fill={G.card} stroke={G.border} />
      <rect x="40" y="40" width="160" height="100" rx="14" className="dark-card" fill="transparent" />
      {/* prompt lines */}
      <rect x="56" y="58" width="80" height="6" rx="3" fill={G.inkSoft} opacity="0.45" />
      <rect x="56" y="72" width="120" height="6" rx="3" fill={G.inkSoft} opacity="0.3" />
      <rect x="56" y="86" width="60" height="6" rx="3" fill={G.inkSoft} opacity="0.3" />

      {/* output bar growing */}
      <rect x="56" y="108" width="0" height="8" rx="4" fill={G.brand}>
        <animate attributeName="width" values="0;130;130;0" keyTimes="0;0.5;0.85;1" dur="3.6s" repeatCount="indefinite" />
      </rect>

      {/* sparkle cluster */}
      <g>
        <path
          d="M180 30 L184 40 L194 44 L184 48 L180 58 L176 48 L166 44 L176 40 Z"
          fill={G.brand}
        >
          <animate attributeName="opacity" values="0.5;1;0.5" dur="2.4s" repeatCount="indefinite" />
          <animateTransform
            attributeName="transform"
            type="rotate"
            from="0 180 44"
            to="360 180 44"
            dur="14s"
            repeatCount="indefinite"
          />
        </path>
        <circle cx="206" cy="58" r="3" fill={G.brand}>
          <animate attributeName="opacity" values="0;1;0" dur="2s" begin="0.3s" repeatCount="indefinite" />
        </circle>
        <circle cx="160" cy="22" r="2.5" fill={G.brand}>
          <animate attributeName="opacity" values="0;1;0" dur="2s" begin="0.9s" repeatCount="indefinite" />
        </circle>
        <circle cx="216" cy="32" r="2" fill={G.brand}>
          <animate attributeName="opacity" values="0;1;0" dur="2s" begin="1.4s" repeatCount="indefinite" />
        </circle>
      </g>
    </Frame>
  );
}

/* ---------- Question bank (cards stack) ---------- */
export function QuestionBankIllustration({ className, title = 'Curated question bank' }: IllustrationProps) {
  return (
    <Frame className={className} title={title}>
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <rect
            x={50 + i * 6}
            y={50 + i * 8}
            width="140"
            height="22"
            rx="6"
            fill={G.card}
            stroke={G.border}
          >
            <animate
              attributeName="y"
              values={`${50 + i * 8};${46 + i * 8};${50 + i * 8}`}
              dur="3.6s"
              begin={`${i * 0.4}s`}
              repeatCount="indefinite"
            />
          </rect>
          <rect x={62 + i * 6} y={58 + i * 8} width="60" height="6" rx="3" fill={G.inkSoft} opacity="0.45" />
          <rect x={62 + i * 6} y={62 + i * 8} width="0" height="0" />
          <circle cx={176 + i * 6} cy={61 + i * 8} r="3" fill={G.brand} opacity={0.6 + i * 0.15} />
        </g>
      ))}
      {/* highlight band */}
      <rect x="50" y="120" width="140" height="22" rx="6" fill={G.brand} opacity="0.12" />
      <rect x="62" y="128" width="80" height="6" rx="3" fill={G.brand} />
      <circle cx="176" cy="131" r="3" fill={G.brand} />
    </Frame>
  );
}

/* ---------- Practice (timer + ticks) ---------- */
export function PracticeIllustration({ className, title = 'Timed practice exams' }: IllustrationProps) {
  return (
    <Frame className={className} title={title}>
      {/* Clock */}
      <circle cx="120" cy="92" r="44" fill={G.card} stroke={G.border} strokeWidth="2" />
      <circle cx="120" cy="92" r="44" fill="none" stroke={G.brand} strokeWidth="3" strokeDasharray="276" strokeDashoffset="69" strokeLinecap="round" transform="rotate(-90 120 92)">
        <animate attributeName="stroke-dashoffset" values="276;0;0" keyTimes="0;0.85;1" dur="4s" repeatCount="indefinite" />
      </circle>
      <circle cx="120" cy="92" r="3" fill={G.ink} />
      {/* hour hand */}
      <line x1="120" y1="92" x2="120" y2="68" stroke={G.ink} strokeWidth="3" strokeLinecap="round">
        <animateTransform
          attributeName="transform"
          type="rotate"
          from="0 120 92"
          to="360 120 92"
          dur="6s"
          repeatCount="indefinite"
        />
      </line>
      {/* check marks orbiting */}
      <g>
        <circle cx="60" cy="50" r="10" fill={G.brand} opacity="0.15">
          <animate attributeName="opacity" values="0;0.25;0" dur="2.4s" repeatCount="indefinite" />
        </circle>
        <path d="M55 50 l4 4 l8 -8" fill="none" stroke={G.brand} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <animate attributeName="opacity" values="0;1;0" dur="2.4s" repeatCount="indefinite" />
        </path>
      </g>
      <g>
        <circle cx="186" cy="138" r="10" fill={G.brand} opacity="0.15">
          <animate attributeName="opacity" values="0;0.25;0" dur="2.4s" begin="1.2s" repeatCount="indefinite" />
        </circle>
        <path d="M181 138 l4 4 l8 -8" fill="none" stroke={G.brand} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <animate attributeName="opacity" values="0;1;0" dur="2.4s" begin="1.2s" repeatCount="indefinite" />
        </path>
      </g>
    </Frame>
  );
}

/* ---------- Search ---------- */
export function SearchIllustration({ className, title = 'Search across thousands of questions' }: IllustrationProps) {
  return (
    <Frame className={className} title={title}>
      <rect x="36" y="58" width="168" height="64" rx="12" fill={G.card} stroke={G.border} />
      <rect x="52" y="74" width="100" height="6" rx="3" fill={G.inkSoft} opacity="0.4" />
      <rect x="52" y="86" width="60" height="6" rx="3" fill={G.inkSoft} opacity="0.3" />
      <rect x="52" y="98" width="80" height="6" rx="3" fill={G.inkSoft} opacity="0.3" />
      {/* magnifier */}
      <g>
        <circle cx="170" cy="92" r="20" fill="none" stroke={G.brand} strokeWidth="4">
          <animate attributeName="cx" values="170;90;170" dur="4s" repeatCount="indefinite" />
          <animate attributeName="cy" values="92;82;92" dur="4s" repeatCount="indefinite" />
        </circle>
        <line x1="184" y1="106" x2="200" y2="122" stroke={G.brand} strokeWidth="5" strokeLinecap="round">
          <animate attributeName="x1" values="184;104;184" dur="4s" repeatCount="indefinite" />
          <animate attributeName="x2" values="200;120;200" dur="4s" repeatCount="indefinite" />
          <animate attributeName="y1" values="106;96;106" dur="4s" repeatCount="indefinite" />
          <animate attributeName="y2" values="122;112;122" dur="4s" repeatCount="indefinite" />
        </line>
      </g>
    </Frame>
  );
}

/* ---------- Upload ---------- */
export function UploadIllustration({ className, title = 'Upload past papers' }: IllustrationProps) {
  return (
    <Frame className={className} title={title}>
      {/* tray */}
      <path d="M50 130 H190 V146 H50 Z" fill={G.brandSoft} opacity="0.5" />
      <path d="M50 130 H190" stroke={G.brand} strokeWidth="2" strokeLinecap="round" />
      {/* file */}
      <g>
        <rect x="98" y="62" width="44" height="58" rx="6" fill={G.card} stroke={G.border}>
          <animate attributeName="y" values="80;46;80" dur="3.6s" repeatCount="indefinite" />
        </rect>
        <rect x="106" y="76" width="28" height="4" rx="2" fill={G.inkSoft} opacity="0.45">
          <animate attributeName="y" values="94;60;94" dur="3.6s" repeatCount="indefinite" />
        </rect>
        <rect x="106" y="86" width="22" height="4" rx="2" fill={G.inkSoft} opacity="0.35">
          <animate attributeName="y" values="104;70;104" dur="3.6s" repeatCount="indefinite" />
        </rect>
        <rect x="106" y="96" width="26" height="4" rx="2" fill={G.inkSoft} opacity="0.35">
          <animate attributeName="y" values="114;80;114" dur="3.6s" repeatCount="indefinite" />
        </rect>
      </g>
      {/* arrow */}
      <g stroke={G.brand} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d="M120 36 V20">
          <animate attributeName="opacity" values="0.3;1;0.3" dur="3.6s" repeatCount="indefinite" />
        </path>
        <path d="M112 28 L120 20 L128 28">
          <animate attributeName="opacity" values="0.3;1;0.3" dur="3.6s" repeatCount="indefinite" />
        </path>
      </g>
    </Frame>
  );
}

/* ---------- Earn (coin growing stack) ---------- */
export function EarnIllustration({ className, title = 'Earn from contributions' }: IllustrationProps) {
  return (
    <Frame className={className} title={title}>
      {/* stacks */}
      {[
        { x: 70, h: 20, delay: '0s' },
        { x: 110, h: 36, delay: '0.4s' },
        { x: 150, h: 56, delay: '0.8s' },
      ].map((s) => (
        <rect
          key={s.x}
          x={s.x}
          y={140 - s.h}
          width="28"
          height={s.h}
          rx="4"
          fill={G.brand}
          opacity="0.85"
        >
          <animate attributeName="height" values={`0;${s.h};${s.h}`} keyTimes="0;0.6;1" dur="3.6s" repeatCount="indefinite" begin={s.delay} />
          <animate attributeName="y" values={`140;${140 - s.h};${140 - s.h}`} keyTimes="0;0.6;1" dur="3.6s" repeatCount="indefinite" begin={s.delay} />
        </rect>
      ))}
      {/* floating coin */}
      <g>
        <circle cx="170" cy="50" r="14" fill={G.brand} stroke={G.brandHover} strokeWidth="2">
          <animate attributeName="cy" values="50;42;50" dur="2.4s" repeatCount="indefinite" />
        </circle>
        <text x="170" y="55" textAnchor="middle" fontSize="14" fontWeight="700" fill="white" fontFamily="system-ui">
          ₦
          <animate attributeName="y" values="55;47;55" dur="2.4s" repeatCount="indefinite" />
        </text>
      </g>
      {/* baseline */}
      <line x1="50" y1="140" x2="200" y2="140" stroke={G.border} strokeWidth="1.5" />
    </Frame>
  );
}

/* ---------- Quality / moderation shield ---------- */
export function ModerationIllustration({ className, title = 'Quality moderation' }: IllustrationProps) {
  return (
    <Frame className={className} title={title}>
      <path
        d="M120 36 L168 56 V96 C168 122 144 138 120 146 C96 138 72 122 72 96 V56 Z"
        fill={G.card}
        stroke={G.brand}
        strokeWidth="3"
      >
        <animate attributeName="opacity" values="0.95;1;0.95" dur="2.4s" repeatCount="indefinite" />
      </path>
      <path d="M100 92 L116 108 L142 78" fill="none" stroke={G.brand} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
        <animate attributeName="stroke-dasharray" values="0 80;80 0;80 0" keyTimes="0;0.5;1" dur="3s" repeatCount="indefinite" />
      </path>
    </Frame>
  );
}

/* ---------- Withdrawals ---------- */
export function WithdrawalsIllustration({ className, title = 'Withdraw to your bank' }: IllustrationProps) {
  return (
    <Frame className={className} title={title}>
      <rect x="40" y="60" width="76" height="56" rx="8" fill={G.card} stroke={G.border} />
      <rect x="50" y="70" width="40" height="6" rx="3" fill={G.inkSoft} opacity="0.4" />
      <rect x="50" y="82" width="56" height="6" rx="3" fill={G.brand} />
      <rect x="50" y="94" width="30" height="6" rx="3" fill={G.inkSoft} opacity="0.3" />
      {/* arrow flow */}
      <g stroke={G.brand} strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d="M120 90 H160">
          <animate attributeName="stroke-dasharray" values="0 50;50 0" dur="2s" repeatCount="indefinite" />
        </path>
        <path d="M152 82 L160 90 L152 98" />
      </g>
      {/* bank */}
      <g fill={G.brand}>
        <rect x="170" y="86" width="36" height="4" />
        <rect x="172" y="92" width="4" height="20" />
        <rect x="184" y="92" width="4" height="20" />
        <rect x="196" y="92" width="4" height="20" />
        <rect x="170" y="114" width="36" height="4" />
        <path d="M168 86 L188 72 L208 86 Z" />
      </g>
    </Frame>
  );
}

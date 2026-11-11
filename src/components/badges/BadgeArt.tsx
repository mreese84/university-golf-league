import { useId, type ReactNode } from 'react';
import { badgeDef, type BadgeId } from '../../history/badges';

// Each badge is a medallion: a colored face with a light top-left glow, a ring, and a white icon
// drawn in a 24×24 box in the middle. The edge says how rare it is: a gold starburst behind the
// legendary ones, a silver milled coin edge on the rare ones, a plain ring on the rest.

interface Look {
  face: [string, string]; // light, dark
  ring?: string; // the rare ones are silver
  // Given the face's dark color, for details cut into the icon, and how many times it was earned,
  // for the badges that carry the number (Cup Winner, Fireball King)
  icon: (dark: string, count: number) => ReactNode;
}

const GOLD = '#f5c542';
const GOLD_DARK = '#b7861b';
const WHITE = '#ffffff';
const SILVER = '#e5e9f0';
const RED = '#dc2626';
const YELLOW = '#fde047';
const FONT = 'Inter, system-ui, sans-serif';

const Count = ({ n, x, y, size, color }: { n: number; x: number; y: number; size: number; color: string }) =>
  n > 1 ? (
    <text x={x} y={y} textAnchor="middle" fontFamily={FONT} fontWeight="800" fontSize={n > 9 ? size * 0.75 : size} fill={color}>
      {n}
    </text>
  ) : null;

const LOOKS: Record<BadgeId, Look> = {
  // A gold crown on black: the one nobody else can earn
  commissioner: {
    face: ['#3b3b3b', '#0b0b0b'],
    ring: GOLD,
    icon: () => (
      <g fill={GOLD} stroke={GOLD} strokeLinejoin="round">
        <path d="M3 17.5 L4.5 7.5 L9 12 L12 4.5 L15 12 L19.5 7.5 L21 17.5 Z" strokeWidth="1.2" />
        <rect x="3" y="19" width="18" height="2.4" rx="0.8" stroke="none" />
        <circle cx="4.5" cy="7" r="1.4" stroke="none" />
        <circle cx="12" cy="4" r="1.4" stroke="none" />
        <circle cx="19.5" cy="7" r="1.4" stroke="none" />
        <circle cx="12" cy="14" r="1.6" fill="#0b0b0b" stroke="none" />
      </g>
    ),
  },
  // A pennant planted on a mound, marked I: the first trip
  founder: {
    face: ['#22a355', '#14532d'],
    ring: '#f3ecd2',
    icon: (dark) => (
      <g>
        <path d="M7 20.5 V3.5" stroke={WHITE} strokeWidth="2" strokeLinecap="round" />
        <path d="M7.8 4 H19 L16.2 7.75 L19 11.5 H7.8 Z" fill={WHITE} />
        <path d="M11.6 5.6 V9.9" stroke={dark} strokeWidth="1.7" strokeLinecap="round" />
        <path d="M2.5 21.5 Q7 17.5 11.5 21.5" fill="none" stroke={WHITE} strokeWidth="2" strokeLinecap="round" />
      </g>
    ),
  },
  // A checkered flag: the last match, the last hole, the cup
  'walk-off': {
    face: ['#06b6d4', '#164e63'],
    ring: '#e0f6fa',
    icon: () => (
      <g>
        <path d="M5 21.5 V3" stroke={WHITE} strokeWidth="2" strokeLinecap="round" />
        <rect x="6" y="3.5" width="13" height="9" fill={WHITE} opacity="0.25" />
        {[0, 1, 2].flatMap((r) =>
          [0, 1, 2, 3]
            .filter((c) => (r + c) % 2 === 0)
            .map((c) => <rect key={`${r}${c}`} x={6 + c * 3.25} y={3.5 + r * 3} width="3.25" height="3" fill={WHITE} />),
        )}
      </g>
    ),
  },
  // A flagstick with a lightning bolt: won it at the death
  clutch: {
    face: ['#ef4444', '#7f1d1d'],
    icon: () => (
      <g>
        <path d="M6 20.5 V3.5" stroke={WHITE} strokeWidth="2" strokeLinecap="round" />
        <path d="M6.8 3.8 L13.5 6.8 L6.8 9.8 Z" fill={WHITE} />
        <ellipse cx="6" cy="21" rx="3.2" ry="1.1" fill={WHITE} opacity="0.55" />
        <path d="M16.8 5 L12.6 13.6 H16 L14.4 21.5 L21 11.4 H17.6 L19.6 5 Z" fill={YELLOW} stroke={YELLOW} strokeWidth="0.6" strokeLinejoin="round" />
      </g>
    ),
  },
  // A line that sinks below all square and climbs out above it
  'captain-comeback': {
    face: ['#3b82f6', '#1e3a8a'],
    icon: () => (
      <g fill="none" stroke={WHITE} strokeLinecap="round" strokeLinejoin="round">
        <path d="M2.5 11.5 H21.5" strokeWidth="1.2" strokeDasharray="1.4 2.2" opacity="0.55" />
        <path d="M2.5 6 C6 6 6.5 18.5 10.5 18.5 S15.5 9 20.5 4.5" strokeWidth="2.4" />
        <path d="M15.2 3.8 H21 V9.6" strokeWidth="2.4" />
      </g>
    ),
  },
  // A burst
  blowout: {
    face: ['#f97316', '#7c2d12'],
    icon: (dark) => (
      <g>
        <path
          d="M12 1.8 L13.9 7.2 L19.2 4.8 L16.8 10.1 L22.2 12 L16.8 13.9 L19.2 19.2 L13.9 16.8 L12 22.2 L10.1 16.8 L4.8 19.2 L7.2 13.9 L1.8 12 L7.2 10.1 L4.8 4.8 L10.1 7.2 Z"
          fill={WHITE}
        />
        <circle cx="12" cy="12" r="3.6" fill={dark} />
        <circle cx="12" cy="12" r="1.6" fill={WHITE} />
      </g>
    ),
  },
  // Three balls
  'hat-trick': {
    face: ['#ec4899', '#831843'],
    icon: (dark) => (
      <g>
        {[
          [7, 16.5],
          [17, 16.5],
          [12, 7.5],
        ].map(([x, y]) => (
          <g key={`${x}${y}`}>
            <circle cx={x} cy={y} r="4.3" fill={WHITE} />
            <circle cx={x - 1.3} cy={y - 0.8} r="0.65" fill={dark} opacity="0.45" />
            <circle cx={x + 1.2} cy={y - 1} r="0.65" fill={dark} opacity="0.45" />
            <circle cx={x} cy={y + 1.3} r="0.65" fill={dark} opacity="0.45" />
          </g>
        ))}
      </g>
    ),
  },
  // A burlap sandbag, tied off, with a little sand spilling from the top
  sandbagger: {
    face: ['#d8b57a', '#7a5523'],
    icon: () => (
      <g>
        <path d="M6.2 9.6 C4.3 12.6 4.5 18.3 6.6 20.5 C8.6 22.1 15.4 22.1 17.4 20.5 C19.5 18.3 19.7 12.6 17.8 9.6 Z" fill="#f7e9cc" />
        <path d="M8.7 9.8 C9.5 8.1 9.6 6.5 8.8 4.8 L15.2 4.8 C14.4 6.5 14.5 8.1 15.3 9.8 Z" fill="#f7e9cc" />
        <path d="M7.8 4.9 Q12 3.4 16.2 4.9" fill="none" stroke="#f7e9cc" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M7.6 9.5 Q12 11.4 16.4 9.5" fill="none" stroke="#6b4a1a" strokeWidth="1.7" strokeLinecap="round" />
        <path d="M16.1 10.1 L18.3 12.8" stroke="#6b4a1a" strokeWidth="1.3" strokeLinecap="round" />
        <path d="M7.3 14.6 Q12 16.1 16.7 14.6 M7.1 18.1 Q12 19.5 16.9 18.1" fill="none" stroke="#b08a52" strokeWidth="0.9" strokeDasharray="1 1.2" />
        <circle cx="10.4" cy="2.9" r="0.55" fill="#f7e9cc" />
        <circle cx="12.3" cy="2.1" r="0.5" fill="#f7e9cc" />
        <circle cx="13.9" cy="2.8" r="0.55" fill="#f7e9cc" />
      </g>
    ),
  },
  // A gold cup, with how many on it
  'cup-winner': {
    face: ['#1e3a8a', '#0b1437'],
    ring: '#e3e9f7',
    icon: (dark, count) => (
      <g>
        <g fill="none" stroke={GOLD} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M7 3.5 H17 V8.5 A5 5 0 0 1 7 8.5 Z" fill={GOLD} />
          <path d="M7 5.5 H4 V7.5 A3.5 3.5 0 0 0 7.6 11 M17 5.5 H20 V7.5 A3.5 3.5 0 0 1 16.4 11" />
          <path d="M12 13.5 V17.5 M8.5 21 H15.5 M9.5 17.5 H14.5 V21 H9.5 Z" />
        </g>
        <Count n={count} x={12} y={11.1} size={8.4} color={dark} />
      </g>
    ),
  },
  // A ball dropping into the cup, a gold 1 above it
  ace: {
    face: ['#8b5cf6', '#3b0764'],
    ring: '#efe7fb',
    icon: () => (
      <g>
        <path d="M4 4.5 Q10 1.5 12 13" fill="none" stroke={WHITE} strokeWidth="1.6" strokeLinecap="round" strokeDasharray="1.6 2.2" opacity="0.8" />
        <ellipse cx="12" cy="19.5" rx="7" ry="2.3" fill={WHITE} opacity="0.5" />
        <circle cx="12" cy="16.6" r="3.2" fill={WHITE} />
        <path d="M16.6 5.2 L18.4 3.9 V10.6" fill="none" stroke={GOLD} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    ),
  },
  // A leaderboard with a red number under par
  'tour-pro': {
    face: ['#9f1239', '#4c0519'],
    ring: '#f3ecd2',
    icon: () => (
      <g>
        <path d="M7 16 V21 M17 16 V21" stroke={WHITE} strokeWidth="2" strokeLinecap="round" />
        <rect x="3" y="4" width="18" height="12.5" rx="1.5" fill={WHITE} />
        <path d="M5.5 7.5 H11 M5.5 10.25 H10 M5.5 13 H11" stroke="#9ca3af" strokeWidth="1.3" strokeLinecap="round" />
        <path d="M13.4 10.25 H15.6" stroke={RED} strokeWidth="1.7" strokeLinecap="round" />
        <path d="M17.2 8.6 L18.6 7.4 V13.2" fill="none" stroke={RED} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    ),
  },
  // Wings spread
  eagle: {
    face: ['#d97706', '#78350f'],
    icon: (dark) => (
      <g>
        <path d="M1.5 8.5 C6 8 9.5 10.5 12 13.5 C14.5 10.5 18 8 22.5 8.5 C19.5 11.5 16.5 13.8 14 15 L12 20.5 L10 15 C7.5 13.8 4.5 11.5 1.5 8.5 Z" fill={WHITE} />
        <path d="M5 10.6 L8 11 M16 11 L19 10.6" stroke={dark} strokeWidth="0.9" strokeLinecap="round" opacity="0.5" />
        <circle cx="12" cy="11" r="2" fill={WHITE} />
        <path d="M11.2 12.6 L12 14.4 L12.8 12.6 Z" fill="#fbbf24" />
      </g>
    ),
  },
  // A little locomotive: pars in a row
  'par-train': {
    face: ['#78716c', '#292524'],
    icon: (dark) => (
      <g>
        <rect x="3" y="9.5" width="11" height="7" rx="1" fill={WHITE} />
        <rect x="13" y="5" width="7" height="11.5" rx="1" fill={WHITE} />
        <rect x="14.6" y="6.8" width="3.8" height="3.2" rx="0.4" fill={dark} opacity="0.6" />
        <rect x="5" y="5.5" width="3" height="4.5" fill={WHITE} />
        <path d="M2 19.8 H22" stroke={WHITE} strokeWidth="1.4" strokeLinecap="round" opacity="0.6" />
        <circle cx="7" cy="17.4" r="2.2" fill={dark} stroke={WHITE} strokeWidth="1.4" />
        <circle cx="16.5" cy="17.4" r="2.2" fill={dark} stroke={WHITE} strokeWidth="1.4" />
      </g>
    ),
  },
  // A bird
  'birdie-machine': {
    face: ['#38bdf8', '#075985'],
    icon: (dark) => (
      <g>
        <path d="M3.5 14 C3.5 9.2 8.5 7 12.5 9 L17.5 5.5 L16.8 9.8 C19 12 18.2 17.2 13 18.2 C8 19.2 3.5 17.3 3.5 14 Z" fill={WHITE} />
        <circle cx="14.6" cy="11" r="1" fill={dark} />
        <path d="M17.6 11.2 L21 12 L17.8 13 Z" fill="#fbbf24" />
        <path d="M7 15 Q9.5 13.5 12 15" fill="none" stroke={dark} strokeWidth="0.9" opacity="0.4" />
      </g>
    ),
  },
  // An 8 on the card: a snowman, on ice
  snowman: {
    face: ['#f8fcff', '#bfe3f7'],
    ring: WHITE,
    icon: () => (
      <g>
        <g fill="none" stroke="#0c4a6e" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="16" r="5" />
          <circle cx="12" cy="8.3" r="3.3" />
          <path d="M8 4.7 H16 M9.8 4.7 V1.8 H14.2 V4.7" />
        </g>
        <circle cx="12" cy="14.6" r="0.9" fill="#0c4a6e" />
        <circle cx="12" cy="17.4" r="0.9" fill="#0c4a6e" />
        <path d="M12 8.6 L14.6 9.2 L12 9.8 Z" fill="#f97316" />
      </g>
    ),
  },
  // A flame, with how many trips in it once there's more than one
  'fireball-king': {
    face: ['#f43f5e', '#881337'],
    icon: (dark, count) => (
      <g>
        <path
          d="M12 1.8 C14.3 6 18.5 8.2 18.5 13.8 A6.5 6.5 0 0 1 5.5 13.8 C5.5 10.2 7.8 8.5 9 6.3 C10 8.6 10.6 9.6 12 10.2 C12.2 7.2 11.4 4.6 12 1.8 Z"
          fill={WHITE}
        />
        {count > 1 ? (
          <Count n={count} x={12} y={19.2} size={9.6} color={dark} />
        ) : (
          <path d="M12 20.8 A3.1 3.1 0 0 1 8.9 17.7 C8.9 15.7 10.6 14.6 12 12.6 C13.4 14.6 15.1 15.7 15.1 17.7 A3.1 3.1 0 0 1 12 20.8 Z" fill="#fbbf24" />
        )}
      </g>
    ),
  },
  // A four-leaf clover
  'lucky-draw': {
    face: ['#10b981', '#064e3b'],
    ring: '#e1f6ee',
    icon: (dark) => (
      <g>
        <g fill={WHITE}>
          <circle cx="8.8" cy="8.8" r="3.6" />
          <circle cx="15.2" cy="8.8" r="3.6" />
          <circle cx="8.8" cy="15.2" r="3.6" />
          <circle cx="15.2" cy="15.2" r="3.6" />
        </g>
        <path d="M14 15 Q17 19.5 20.5 21" fill="none" stroke={WHITE} strokeWidth="2" strokeLinecap="round" />
        <circle cx="12" cy="12" r="1.4" fill={dark} />
      </g>
    ),
  },
};

// A 16-point starburst around the medallion, for the legendary ones
const BURST = (() => {
  const points: string[] = [];
  for (let i = 0; i < 32; i++) {
    const r = i % 2 === 0 ? 31.5 : 27.5;
    const a = (Math.PI * i) / 16 - Math.PI / 2;
    points.push(`${(32 + r * Math.cos(a)).toFixed(2)},${(32 + r * Math.sin(a)).toFixed(2)}`);
  }
  return points.join(' ');
})();

// The badge's medallion. `earned` false shows it grayed out, for badges nobody has yet. `count` is
// drawn on the badges that carry it (Cup Winner, Fireball King) from 2 up.
export default function BadgeArt({
  id,
  className = 'w-16 h-16',
  earned = true,
  count = 1,
  title,
}: {
  id: BadgeId;
  className?: string;
  earned?: boolean;
  count?: number;
  title?: string;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const { face, icon } = LOOKS[id];
  const tier = badgeDef(id).tier;
  const ring = LOOKS[id].ring ?? (tier === 'rare' ? SILVER : WHITE);
  const faceId = `badge-face-${uid}`;
  const shineId = `badge-shine-${uid}`;
  const legendary = tier === 'legendary';
  return (
    <svg
      viewBox="0 0 64 64"
      className={`${className} shrink-0 ${earned ? '' : 'grayscale opacity-35'}`}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {title && <title>{title}</title>}
      <defs>
        <radialGradient id={faceId} cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor={face[0]} />
          <stop offset="100%" stopColor={face[1]} />
        </radialGradient>
        <linearGradient id={shineId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      {legendary && <polygon points={BURST} fill={GOLD} stroke={GOLD_DARK} strokeWidth="0.8" strokeLinejoin="round" />}
      <circle cx="32" cy="32" r={legendary ? 26.5 : 30} fill={ring} stroke="#000" strokeOpacity="0.12" strokeWidth="0.6" />
      {tier === 'rare' && <circle cx="32" cy="32" r="28.4" fill="none" stroke="#8a94a6" strokeWidth="1.8" strokeDasharray="0.9 1.5" />}
      <circle cx="32" cy="32" r={legendary ? 23 : 25} fill={`url(#${faceId})`} />
      <circle cx="32" cy="32" r={legendary ? 21.2 : 23.2} fill="none" stroke="#fff" strokeOpacity="0.22" strokeWidth="0.8" />
      <g transform={legendary ? 'translate(19.4 19.4) scale(1.05)' : 'translate(18 18) scale(1.1667)'}>{icon(face[1], count)}</g>
      <path d={legendary ? 'M10 30 A22 22 0 0 1 54 30 Q32 22 10 30 Z' : 'M8 30 A24 24 0 0 1 56 30 Q32 21 8 30 Z'} fill={`url(#${shineId})`} />
    </svg>
  );
}

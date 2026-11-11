import { useId, type ReactNode } from 'react';
import { badgeDef, type BadgeId } from '../../history/badges';

// Each badge is a medallion: a colored face with a light top-left glow, a ring, and a white icon
// drawn in a 24×24 box in the middle. The edge says how rare it is: a gold starburst behind the
// legendary ones (Commissioner, Founder), a silver milled coin edge on the rare ones, a plain ring
// on the rest.

interface Look {
  face: [string, string]; // light, dark
  ring: string;
  icon: (dark: string) => ReactNode; // given the face's dark color, for details cut into the icon
}

const GOLD = '#f5c542';
const GOLD_DARK = '#b7861b';
const WHITE = '#ffffff';
const SILVER = '#e5e9f0';

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
  // A flagstick with a lightning bolt: won it at the death
  clutch: {
    face: ['#ef4444', '#7f1d1d'],
    ring: SILVER,
    icon: () => (
      <g>
        <path d="M6 20.5 V3.5" stroke={WHITE} strokeWidth="2" strokeLinecap="round" />
        <path d="M6.8 3.8 L13.5 6.8 L6.8 9.8 Z" fill={WHITE} />
        <ellipse cx="6" cy="21" rx="3.2" ry="1.1" fill={WHITE} opacity="0.55" />
        <path d="M16.8 5 L12.6 13.6 H16 L14.4 21.5 L21 11.4 H17.6 L19.6 5 Z" fill="#fde047" stroke="#fde047" strokeWidth="0.6" strokeLinejoin="round" />
      </g>
    ),
  },
  // A line that sinks below all square and climbs out above it
  'captain-comeback': {
    face: ['#3b82f6', '#1e3a8a'],
    ring: SILVER,
    icon: () => (
      <g fill="none" stroke={WHITE} strokeLinecap="round" strokeLinejoin="round">
        <path d="M2.5 11.5 H21.5" strokeWidth="1.2" strokeDasharray="1.4 2.2" opacity="0.55" />
        <path d="M2.5 6 C6 6 6.5 18.5 10.5 18.5 S15.5 9 20.5 4.5" strokeWidth="2.4" />
        <path d="M15.2 3.8 H21 V9.6" strokeWidth="2.4" />
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

// The badge's medallion. `earned` false shows it grayed out, for badges nobody has yet.
export default function BadgeArt({ id, className = 'w-16 h-16', earned = true, title }: { id: BadgeId; className?: string; earned?: boolean; title?: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const { face, ring, icon } = LOOKS[id];
  const tier = badgeDef(id).tier;
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
      <g transform={legendary ? 'translate(19.4 19.4) scale(1.05)' : 'translate(18 18) scale(1.1667)'}>{icon(face[1])}</g>
      <path d={legendary ? 'M10 30 A22 22 0 0 1 54 30 Q32 22 10 30 Z' : 'M8 30 A24 24 0 0 1 56 30 Q32 21 8 30 Z'} fill={`url(#${shineId})`} />
    </svg>
  );
}

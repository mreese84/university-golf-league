import type { EarnedBadge } from '../../history/badges';
import { badgeDef } from '../../history/badges';
import { followLink } from '../../routes';
import BadgeArt from './BadgeArt';

// A person's badges as a shelf of medallions, each named underneath with how many times when more
// than once (on the medallion itself for Cup Winner and Fireball King, big enough here to read).
// Each links to the chapter's Badges page, where it says how they're earned.
export default function BadgeShelf({ badges, href }: { badges: EarnedBadge[]; href: string }) {
  if (badges.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-x-2 gap-y-3" aria-label="Badges">
      {badges.map((b) => {
        const def = badgeDef(b.id);
        const times = b.moments.length;
        return (
          <li key={b.id}>
            <a href={href} onClick={(e) => followLink(e, href)} title={def.how} className="flex w-20 flex-col items-center text-center group">
              <BadgeArt id={b.id} className="w-14 h-14 transition-transform group-hover:scale-105" count={times} />
              <span className="mt-1 text-[11px] font-semibold leading-tight text-gray-700">{def.name}</span>
              {times > 1 && def.repeat === 'count' && <span className="text-[11px] text-gray-500">×{times}</span>}
              {times > 1 && def.repeat === 'onBadge' && <span className="sr-only">×{times}</span>}
            </a>
          </li>
        );
      })}
    </ul>
  );
}

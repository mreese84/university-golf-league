import type { EarnedBadge } from '../../history/badges';
import { badgeDef } from '../../history/badges';
import { followLink } from '../../routes';
import BadgeArt from './BadgeArt';

// A person's badges as a row of chips: the medallion, its name, and how many times when more than
// once. Each links to the chapter's Badges page, where it says how they're earned.
export default function BadgeChips({ badges, href }: { badges: EarnedBadge[]; href: string }) {
  if (badges.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-2" aria-label="Badges">
      {badges.map((b) => {
        const def = badgeDef(b.id);
        const times = b.moments.length;
        return (
          <li key={b.id}>
            <a
              href={href}
              onClick={(e) => followLink(e, href)}
              title={def.how}
              className="inline-flex items-center gap-1.5 rounded-full bg-white border border-gray-200 py-0.5 pl-0.5 pr-3 text-xs font-semibold text-gray-800 hover:border-gray-300 transition-colors"
            >
              <BadgeArt id={b.id} className="w-7 h-7" />
              {def.name}
              {times > 1 && <span className="font-normal text-gray-500">×{times}</span>}
            </a>
          </li>
        );
      })}
    </ul>
  );
}

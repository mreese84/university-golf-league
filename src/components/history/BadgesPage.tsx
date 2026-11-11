import { useHistory } from '../../history/historyContext';
import { BADGES, holdersOf, momentText, type BadgeDef, type BadgeGroup, type BadgeMoment, type BadgeTier } from '../../history/badges';
import BadgeArt from '../badges/BadgeArt';
import { Card } from '../guide/parts';
import { Link, PlayerAvatar, SectionTitle } from './parts';

// Only the harder badges carry a label; common ones go without
const TIER: Partial<Record<BadgeTier, [string, string]>> = {
  legendary: ['Legendary', 'bg-amber-100 text-amber-800'],
  rare: ['Rare', 'bg-slate-100 text-slate-600'],
};

// Where it was earned: a link to the match ("UGL2 · Rd 1 · 2&1 on 17") or the trip ("UGL2 · 6
// birdies"), or a note ("UGL1 · Lubbock 2025")
function Moment({ moment }: { moment: BadgeMoment }) {
  const { links } = useHistory();
  const { event, match } = moment;
  const text = momentText(moment);
  const to = event && (match ? links.match(event.id, match.id) : links.event(event.id));
  if (to) {
    return (
      <Link to={to} className="font-medium text-green-700 hover:underline">
        {text}
      </Link>
    );
  }
  return text ? <span>{text}</span> : null;
}

function BadgeCard({ def }: { def: BadgeDef }) {
  const { badges, nameOf, stats, links } = useHistory();
  const holders = holdersOf(badges, def.id, nameOf);
  const tier = TIER[def.tier];
  return (
    <Card>
      <div className="flex items-center gap-4">
        <BadgeArt id={def.id} className="w-16 h-16" earned={holders.length > 0} />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="font-semibold text-gray-800">{def.name}</h4>
            {tier && <span className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${tier[1]}`}>{tier[0]}</span>}
          </div>
          <p className="text-sm text-gray-500 mt-0.5">{def.how}</p>
        </div>
      </div>
      {holders.length > 0 ? (
        <ul className="mt-3 divide-y divide-gray-100">
          {holders.map((h) => {
            const shown = h.moments.filter((m) => momentText(m));
            return (
              <li key={h.personId} className="flex items-start gap-3 py-2.5">
                <PlayerAvatar id={h.personId} className="w-8 h-8" />
                <div className="flex-1 min-w-0 text-sm">
                  <p className="font-semibold text-gray-800">
                    {stats.has(h.personId) ? (
                      <Link to={links.player(h.personId)} className="hover:underline">
                        {nameOf(h.personId)}
                      </Link>
                    ) : (
                      nameOf(h.personId)
                    )}
                  </p>
                  {shown.length > 0 && (
                    <p className="text-xs text-gray-500 mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                      {shown.map((m, i) => (
                        <Moment key={i} moment={m} />
                      ))}
                    </p>
                  )}
                </div>
                {h.moments.length > 1 && <span className="text-sm font-bold text-gray-900 tabular-nums shrink-0">×{h.moments.length}</span>}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-gray-400 italic mt-3">Nobody yet</p>
      )}
    </Card>
  );
}

const GROUPS: [BadgeGroup, string][] = [
  ['league', 'The league'],
  ['matches', 'Match play'],
  ['scorecards', 'Scorecards'],
  ['trips', 'On the trip'],
];

// Every badge, how it's earned, and who has it
export default function BadgesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Badges</h2>
        <p className="text-sm text-gray-500 mt-1">Earned on the course and on the trips. Worked out from the record, so they update as results come in.</p>
      </div>
      {GROUPS.map(([group, title]) => (
        <section key={group} className="space-y-3">
          <SectionTitle>{title}</SectionTitle>
          {BADGES.filter((b) => b.group === group).map((b) => (
            <BadgeCard key={b.id} def={b} />
          ))}
        </section>
      ))}
    </div>
  );
}

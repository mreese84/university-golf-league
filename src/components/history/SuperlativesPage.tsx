import { useHistory } from '../../history/historyContext';
import { eventLabel } from '../../history/format';
import type { Award, AwardEntry } from '../../history/stats';
import { Card } from '../guide/parts';
import { Link, Names, PlayerAvatar, SectionTitle } from './parts';

// Individual honors, so the first player's photo rather than a team logo
function Entry({ entry }: { entry: AwardEntry }) {
  const { links } = useHistory();
  const { players, opponents, event, match, value, note } = entry;
  const where = [event && `${eventLabel(event)} · ${event.year}`, note].filter(Boolean).join(' · ');
  return (
    <li className="flex items-start gap-3 py-3">
      {players[0] ? <PlayerAvatar id={players[0]} className="w-8 h-8 mt-0.5" /> : <span className="w-8 shrink-0" />}
      <div className="flex-1 min-w-0 text-sm">
        <p className="font-semibold text-gray-800">
          <Names ids={players} link />
        </p>
        {opponents && opponents.length > 0 && (
          <p className="text-gray-500">
            vs <Names ids={opponents} link />
          </p>
        )}
        <p className="text-xs text-gray-400 mt-0.5">
          {where}
          {match && event && (
            <>
              {where && ' · '}
              <Link to={links.match(event.id, match.id)} className="font-medium text-green-700 hover:underline">
                Scorecard
              </Link>
            </>
          )}
        </p>
      </div>
      <p className="text-base font-bold text-gray-900 tabular-nums text-right shrink-0">{value}</p>
    </li>
  );
}

function AwardCard({ award }: { award: Award }) {
  return (
    <Card>
      <h4 className="font-semibold text-gray-800">{award.title}</h4>
      <p className="text-xs text-gray-500 mt-0.5">{award.description}</p>
      {award.entries.length > 0 ? (
        <ul className="mt-1 divide-y divide-gray-100">
          {award.entries.map((entry, i) => (
            <Entry key={i} entry={entry} />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-gray-400 italic mt-3">Nobody yet</p>
      )}
    </Card>
  );
}

export default function SuperlativesPage() {
  const { awards } = useHistory();
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Superlatives</h2>
        <p className="text-sm text-gray-500 mt-1">Worked out from every match, so they update as results come in.</p>
      </div>

      <section className="space-y-3">
        <SectionTitle>From match results</SectionTitle>
        {awards.results.map((a) => (
          <AwardCard key={a.id} award={a} />
        ))}
      </section>

      <section className="space-y-3">
        <SectionTitle>From scorecards</SectionTitle>
        {awards.scorecards ? (
          awards.scorecards.map((a) => <AwardCard key={a.id} award={a} />)
        ) : (
          <Card className="text-sm text-gray-500">
            Best net round, net birdies, holes won, comebacks and clutch finishes appear once matches have hole-by-hole
            scores.
          </Card>
        )}
      </section>
    </div>
  );
}

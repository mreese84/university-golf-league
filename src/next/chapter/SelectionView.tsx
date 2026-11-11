import { useCallback, useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import SpinnerAnimation from '../../components/SpinnerAnimation';
import { pathsFor } from '../../data/paths';
import { dataEnv } from '../../dataEnv';
import { db } from '../../firebase';
import { byDate, drawFrom, drawPool, pendingDraw, type ChapterTrip } from '../chapterTrips';
import { nameOf, photoUrl, tripDate, type ChapterData } from './data';

const P = pathsFor(dataEnv);

// The winner's profile photo, or the trophy for anyone without one yet
function WinnerPhoto({ data, personId, size }: { data: ChapterData; personId: string; size: 'large' | 'small' }) {
  const photo = photoUrl(data.people[personId]);
  if (!photo) return <p className={size === 'large' ? 'text-3xl mb-2' : 'text-2xl mb-1'}>🏆</p>;
  return (
    <img
      src={photo}
      alt={nameOf(data, personId)}
      className={`mx-auto object-cover object-[50%_25%] rounded-2xl shadow-lg ring-4 ring-white animate-reveal motion-reduce:animate-none
                  ${size === 'large' ? 'w-48 h-64 mb-4' : 'w-24 h-32 mb-3'}`}
    />
  );
}

const STATUS_WORDS: Record<string, string> = { guest: 'guest', alumni: 'alumni', active: 'active', invitee: 'invited' };

export default function SelectionView({ data }: { data: ChapterData }) {
  const [drawing, setDrawing] = useState<{ trip: ChapterTrip; winner: string } | null>(null);
  const [shown, setShown] = useState<{ trip: ChapterTrip; winner: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Drafts haven't happened, so they play no part in the draw
  const trips = data.trips.filter((t) => !t.draft);
  const pending = pendingDraw(trips);
  const { pool, left } = pending ? drawPool(trips, pending.id, data.rosterById) : { pool: [], left: [] };
  const total = pool.reduce((sum, p) => sum + p.entries, 0);

  const save = async (trip: ChapterTrip, winner: string | null) => {
    setError(null);
    try {
      await updateDoc(doc(db, P.trip(data.chapterId, trip.id)), { nextSelectorId: winner });
    } catch (err) {
      console.error(err);
      setError("The result didn't save. Check your connection and try again.");
    }
  };

  const draw = () => {
    if (!pending) return;
    const winner = drawFrom(pool);
    // Load the winner's photo while the names spin, so it's ready when the name lands
    const photo = photoUrl(data.people[winner]);
    if (photo) new Image().src = photo;
    setShown(null);
    setDrawing({ trip: pending, winner });
  };

  const landed = useCallback(() => {
    if (!drawing) return;
    setShown(drawing);
    setDrawing(null);
    void save(drawing.trip, drawing.winner);
    // save is stable enough: it reads only the chapter ID
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawing]);

  const redraw = () => {
    if (!shown) return;
    void save(shown.trip, null);
    setShown(null);
  };

  if (data.tripsStatus === 'loading') return <p className="text-gray-400 text-center py-8">Loading…</p>;
  if (trips.length === 0) return <p className="text-gray-400 text-center py-12">Add a trip first, on the Trips tab.</p>;

  if (shown) {
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-semibold text-gray-800">
          Draw: {shown.trip.location} ({tripDate(shown.trip)})
        </h2>
        <div className="text-center space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-2xl p-6 max-w-md mx-auto">
            <WinnerPhoto data={data} personId={shown.winner} size="large" />
            <p className="text-2xl font-bold text-green-700">{nameOf(data, shown.winner)}</p>
            <p className="text-green-600 mt-1">picks the next trip location!</p>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          {data.canManage && (
            <button onClick={redraw} className="text-sm text-gray-400 hover:text-red-500 transition-colors cursor-pointer">
              Re-draw (undo and pick again)
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!pending) {
    const last = [...trips].sort(byDate).at(-1)!;
    return (
      <div className="space-y-6 text-center py-8">
        <h2 className="text-xl font-semibold text-gray-800">All draws complete</h2>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 max-w-md mx-auto">
          {last.nextSelectorId && <WinnerPhoto data={data} personId={last.nextSelectorId} size="small" />}
          <p className="text-gray-500 text-sm mb-2">
            {last.location} ({tripDate(last)})
          </p>
          <p className="text-2xl font-bold text-green-700">🎯 {nameOf(data, last.nextSelectorId)} picks the next location</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-gray-800">
        Draw: {pending.location} ({tripDate(pending)})
      </h2>
      <p className="text-sm text-gray-500">
        Who picks the next trip's location? Each active member who came gets one entry for every trip in a row they've attended
        without choosing the location.
      </p>
      {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-2">{error}</p>}

      <div className="flex flex-col-reverse md:flex-row md:gap-6 gap-6">
        <div className="md:flex-1">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-5 py-3 font-medium text-gray-500">Member</th>
                  <th className="text-center px-5 py-3 font-medium text-gray-500">Entries</th>
                  <th className="text-right px-5 py-3 font-medium text-gray-500">Chance</th>
                </tr>
              </thead>
              <tbody>
                {[...pool].sort((a, b) => b.entries - a.entries).map(({ personId, entries }) => (
                  <tr key={personId} className="border-b border-gray-50 last:border-0">
                    <td className="px-5 py-3 font-medium text-gray-800">{nameOf(data, personId)}</td>
                    <td className="px-5 py-3 text-center">
                      <span className="inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-semibold">
                        {entries}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right text-gray-500">{total > 0 ? ((entries / total) * 100).toFixed(1) : 0}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 text-xs text-gray-400 space-y-1">
              <p>
                {pool.length} in the draw · {total} entries ·{' '}
                <span className="text-amber-600 font-medium">{nameOf(data, pending.selectedById)} chose this location</span>
              </p>
              {left.length > 0 && (
                <p>
                  Not in the draw:{' '}
                  {left.map((id) => `${nameOf(data, id)} (${STATUS_WORDS[data.rosterById[id]?.status ?? ''] ?? 'not on the roster'})`).join(', ')}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="md:w-64 shrink-0 flex flex-col items-center justify-start gap-4">
          {!drawing && data.canManage && pool.length > 0 && (
            <button
              onClick={draw}
              className="px-8 py-4 bg-green-600 text-white rounded-2xl font-semibold text-lg hover:bg-green-700 hover:shadow-lg
                         hover:shadow-green-200/50 active:scale-95 transition-all cursor-pointer w-full md:w-auto"
            >
              🎲 Draw a name
            </button>
          )}
          {drawing && (
            <SpinnerAnimation
              names={pool.map((p) => nameOf(data, p.personId))}
              winnerId={drawing.winner}
              winnerName={nameOf(data, drawing.winner)}
              onComplete={landed}
            />
          )}
        </div>
      </div>
    </div>
  );
}

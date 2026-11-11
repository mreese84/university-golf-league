import { useState } from 'react';
import { useLiveCollection } from '../data/hooks';
import { pathsFor } from '../data/paths';
import type { ChapterRequest } from '../data/types';
import { requestChapter } from '../data/writes';
import { dataEnv } from '../dataEnv';
import { db } from '../firebase';
import { chapterPath, followLink, requestChapterPath } from '../routes';
import { SessionError, SessionWaiting } from './HomePage';
import Landing from './Landing';
import { buttonClass, inputClass } from './parts';
import { useSession } from './sessionContext';

const P = pathsFor(dataEnv);

// When it was asked, newest first; one just sent (no server time yet) goes on top
const seconds = (t: ChapterRequest['createdAt']) => (t && 'seconds' in t ? (t as { seconds: number }).seconds : Infinity);

const STATUS: Record<ChapterRequest['status'], [string, string]> = {
  pending: ['Waiting for an admin', 'bg-amber-50 text-amber-700'],
  approved: ['Approved', 'bg-green-50 text-green-700'],
  declined: ['Declined', 'bg-gray-100 text-gray-500'],
};

function RequestForm() {
  const { user, person } = useSession();
  const uid = user!.uid;
  const { items: mine } = useLiveCollection<ChapterRequest>(P.chapterRequests, `requests:${uid}`, [['requestedBy.uid', '==', uid]]);
  const [name, setName] = useState('');
  const [yourName, setYourName] = useState(user?.displayName ?? '');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const canSend = name.trim().length > 0 && name.trim().length <= 80 && note.length <= 1000 && (!!person || yourName.trim().length > 0);

  // The form clears as it sends (the request shows in the list straight away), and gets its text
  // back if the send fails
  const send = async () => {
    const asked = { name, note };
    setBusy(true);
    setError(null);
    setName('');
    setNote('');
    try {
      await requestChapter(db, dataEnv, { uid, email: user!.email!, name: person?.name ?? yourName.trim() }, asked.name, asked.note || null);
      setSent(true);
    } catch (err) {
      console.error(err);
      setName(asked.name);
      setNote(asked.note);
      setError("That didn't send. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  const sorted = [...mine].sort((a, b) => seconds(b.createdAt) - seconds(a.createdAt));
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Start a chapter</h2>
        <p className="text-sm text-gray-500 mt-1">
          A chapter is its own group: its own trips, members, guides and history. Ask for one here, and once an admin approves it you'll be
          its organizer.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
        <label className="block text-sm font-medium text-gray-700">
          Chapter name
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="The Austin Crew" className={`${inputClass} mt-1`} />
        </label>
        {!person && (
          <label className="block text-sm font-medium text-gray-700">
            Your name
            <input value={yourName} onChange={(e) => setYourName(e.target.value)} placeholder="First Last" className={`${inputClass} mt-1`} />
          </label>
        )}
        <label className="block text-sm font-medium text-gray-700">
          Anything the admins should know <span className="font-normal text-gray-400">(optional)</span>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} rows={3} placeholder="Who's in it, how often you travel…" className={`${inputClass} mt-1`} />
        </label>
        <p className="text-xs text-gray-400">You'll sign in as {user?.email}, as its organizer.</p>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {sent && <p className="text-sm text-green-700">Sent. An admin will look at it soon.</p>}
        <button onClick={() => void send()} disabled={busy || !canSend} className={buttonClass}>
          {busy ? 'Sending…' : 'Ask for the chapter'}
        </button>
      </div>

      {sorted.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Your requests</h3>
          {sorted.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-3 bg-white rounded-xl border border-gray-100 px-4 py-3">
              <span className="font-medium text-gray-800">{r.name}</span>
              {r.status === 'approved' && r.chapterId ? (
                <a href={chapterPath(r.chapterId)} onClick={(e) => followLink(e, chapterPath(r.chapterId!))} className="text-sm font-medium text-green-700">
                  Open it →
                </a>
              ) : (
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS[r.status][1]}`}>{STATUS[r.status][0]}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Asking for a new chapter: anyone signed in, whether or not they're in one yet
export default function RequestChapterPage() {
  const { status } = useSession();
  if (status === 'signedOut') return <Landing continuePath={requestChapterPath()} />;
  if (status === 'loading' || status === 'joining') return <SessionWaiting />;
  if (status === 'error') return <SessionError />;
  return <RequestForm />;
}

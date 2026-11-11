import { useState, type FormEvent } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { useLiveDocs } from '../../data/hooks';
import { personIdFor } from '../../data/ids';
import { normalizeEmail, pathsFor } from '../../data/paths';
import type { Contact, JoinedStatus, Person, RosterEntry } from '../../data/types';
import {
  addEmail,
  addPersonToChapter,
  completeJoin,
  createPersonInChapter,
  removeEmail,
  removeFromChapter,
  setRole,
  setStatus,
  updateProfile,
  type Joining,
} from '../../data/writes';
import { dataEnv } from '../../dataEnv';
import { db } from '../../firebase';
import { buttonClass, inputClass } from '../parts';
import { photoUrl, type ChapterData } from './data';
import PhotoEditor from '../PhotoEditor';
import ProfileForm from './ProfileForm';

const P = pathsFor(dataEnv);

const SECTIONS: { status: RosterEntry['status']; title: string; managersOnly?: boolean }[] = [
  { status: 'active', title: 'Members' },
  { status: 'guest', title: 'Guests' },
  { status: 'alumni', title: 'Alumni' },
  { status: 'invitee', title: 'Invited', managersOnly: true },
];

const JOIN_OPTIONS: { value: string; label: string; joining: Joining }[] = [
  { value: 'active', label: 'Active member, now', joining: { status: 'active' } },
  { value: 'guest', label: 'Guest, now', joining: { status: 'guest' } },
  { value: 'alumni', label: 'Alumni, now', joining: { status: 'alumni' } },
  { value: 'invite-active', label: 'Invite as a member (hidden until they sign in)', joining: { invite: 'active' } },
  { value: 'invite-guest', label: 'Invite as a guest (hidden until they sign in)', joining: { invite: 'guest' } },
];

const selectClass = `${inputClass} w-auto py-2 text-sm`;

function Avatar({ person }: { person: Person | undefined }) {
  const photo = photoUrl(person);
  if (photo) return <img src={photo} alt="" className="w-10 h-10 rounded-full object-cover object-[50%_25%] shrink-0" />;
  const initials = (person?.name ?? '?').split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  return <span className="w-10 h-10 rounded-full bg-green-100 text-green-800 text-sm font-semibold flex items-center justify-center shrink-0">{initials}</span>;
}

const problem = (err: unknown) => {
  console.error(err);
  return (err as { code?: string })?.code === 'permission-denied'
    ? "That isn't allowed for your role."
    : "That didn't save. Check your connection and try again.";
};

// An organizer's or admin's controls for one person
function ManagePerson({ data, id, entry, person, emails, onClose }: {
  data: ChapterData;
  id: string;
  entry: RosterEntry;
  person: Person;
  emails: string[];
  onClose: () => void;
}) {
  const [newEmail, setNewEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const c = data.chapterId;
  const isOrganizer = entry.role === 'organizer';
  const act = async (work: () => Promise<unknown>) => {
    setError(null);
    try {
      await work();
    } catch (err) {
      setError(problem(err));
    }
  };

  return (
    <div className="mt-3 p-4 bg-gray-50 rounded-xl space-y-5">
      <PhotoEditor personId={id} person={person} />
      <ProfileForm
        person={person}
        allowName
        onSave={(changes) => updateProfile(db, dataEnv, id, changes)}
        onCancel={onClose}
      />

      <div className="space-y-2">
        <p className="text-sm font-medium text-gray-600">Status</p>
        {entry.status === 'invitee' ? (
          <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
            Invited as {entry.joinsAs === 'guest' ? 'a guest' : 'a member'}; they join when they first sign in. Or confirm them now as:
            {(['active', 'guest'] as JoinedStatus[]).map((s) => (
              <button key={s} onClick={() => act(() => completeJoin(db, dataEnv, c, id, s))} className="text-green-700 font-medium underline cursor-pointer">
                {s === 'active' ? 'active member' : 'guest'}
              </button>
            ))}
          </div>
        ) : (
          <select value={entry.status} onChange={(e) => act(() => setStatus(db, dataEnv, c, id, e.target.value as JoinedStatus))} className={selectClass}>
            <option value="active">Active member</option>
            <option value="guest">Guest</option>
            <option value="alumni">Alumni</option>
          </select>
        )}
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-gray-600">Sign-in emails</p>
        {emails.length === 0 && <p className="text-sm text-gray-400">None yet, so they can't sign in.</p>}
        <ul className="space-y-1">
          {emails.map((email) => (
            <li key={email} className="flex items-center justify-between gap-2 text-sm text-gray-700">
              <span className="truncate">{email}</span>
              <button onClick={() => act(() => removeEmail(db, dataEnv, id, email))} className="text-xs text-gray-400 hover:text-red-500 cursor-pointer">
                Remove
              </button>
            </li>
          ))}
        </ul>
        <form
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            if (!newEmail.trim()) return;
            void act(async () => {
              await addEmail(db, dataEnv, id, newEmail);
              setNewEmail('');
            });
          }}
          className="flex gap-2"
        >
          <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="Another email they sign in with" className={`${inputClass} py-2 text-sm`} />
          <button type="submit" className={buttonClass}>Add</button>
        </form>
      </div>

      <div className="flex flex-wrap items-center gap-4 pt-1">
        {data.isAdmin && (
          <button onClick={() => act(() => setRole(db, dataEnv, c, id, isOrganizer ? 'member' : 'organizer'))} className="text-sm text-green-700 font-medium cursor-pointer">
            {isOrganizer ? 'Make a member (not an organizer)' : 'Make an organizer'}
          </button>
        )}
        {(data.isAdmin || !isOrganizer) && id !== data.personId && (
          <button
            onClick={() => confirm(`Take ${person.name} off this chapter's roster?`) && act(() => removeFromChapter(db, dataEnv, c, id))}
            className="text-sm text-gray-400 hover:text-red-500 cursor-pointer"
          >
            Remove from the chapter
          </button>
        )}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

// Organizers add someone: straight onto the roster, or invited (hidden from members until their first sign-in)
function AddPerson({ data }: { data: ChapterData }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [how, setHow] = useState('active');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const add = async (e: FormEvent) => {
    e.preventDefault();
    const address = email.trim() ? normalizeEmail(email) : null;
    if (!name.trim() && !address) return;
    const joining = JOIN_OPTIONS.find((o) => o.value === how)!.joining;
    setBusy(true);
    setMessage(null);
    try {
      // Someone who already has this email in the league keeps their one record
      const login = address ? await getDoc(doc(db, P.login(address))) : null;
      const existing = login?.exists() ? (login.data() as { personId: string }).personId : null;
      if (existing && data.rosterById[existing]) {
        setMessage({ ok: false, text: `${address} already belongs to someone on this roster.` });
        return;
      }
      if (existing) {
        await addPersonToChapter(db, dataEnv, data.chapterId, existing, joining);
      } else {
        if (!name.trim()) {
          setMessage({ ok: false, text: 'Enter their full name.' });
          return;
        }
        // IDs are permanent and readable. One already used in another chapter can't be overwritten
        // (the rules refuse it), so on a refusal the next number is tried.
        const taken = new Set(data.roster.map((r) => r.id));
        let added = false;
        for (let attempt = 0; attempt < 5 && !added; attempt++) {
          const personId = personIdFor(name, taken);
          try {
            await createPersonInChapter(db, dataEnv, data.chapterId, { personId, name, emails: address ? [address] : [] }, joining);
            added = true;
          } catch (err) {
            if ((err as { code?: string })?.code !== 'permission-denied' || attempt === 4) throw err;
            taken.add(personId);
          }
        }
      }
      const who = name.trim() || address;
      setMessage({
        ok: true,
        text: address
          ? `${who} is added. They sign in with ${address}${'invite' in joining ? ', and join on their first sign-in' : ''}.`
          : `${who} is added. Add an email for them to be able to sign in.`,
      });
      setName('');
      setEmail('');
    } catch (err) {
      setMessage({ ok: false, text: problem(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={add} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
      <h3 className="text-sm font-semibold text-gray-800">Add someone</h3>
      <div className="grid sm:grid-cols-2 gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" aria-label="Full name" className={inputClass} />
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email they sign in with" aria-label="Email" className={inputClass} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <select value={how} onChange={(e) => setHow(e.target.value)} aria-label="Add as" className={selectClass}>
          {JOIN_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <button type="submit" disabled={busy} className={buttonClass}>
          {busy ? 'Adding…' : 'Add'}
        </button>
      </div>
      <p className="text-xs text-gray-400">
        No email is sent: tell them to sign in with that address. If someone already in the league has this email, they're added
        with their existing profile.
      </p>
      {message && <p className={`text-sm ${message.ok ? 'text-green-700' : 'text-red-600'}`}>{message.text}</p>}
    </form>
  );
}

export default function MembersView({ data }: { data: ChapterData }) {
  const [open, setOpen] = useState<string | null>(null);
  const contacts = useLiveDocs<Contact>(data.canManage ? data.roster.map((e) => P.contact(e.id)) : [], data.canManage ? `contacts:${data.uid}` : null);
  const byName = (a: { id: string }, b: { id: string }) => (data.people[a.id]?.name ?? a.id).localeCompare(data.people[b.id]?.name ?? b.id);

  return (
    <div className="space-y-6">
      {data.canManage && <AddPerson data={data} />}
      {SECTIONS.filter((s) => !s.managersOnly || data.canManage).map((section) => {
        const entries = data.roster.filter((e) => e.status === section.status).sort(byName);
        if (entries.length === 0) return null;
        return (
          <section key={section.status} className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              {section.title} ({entries.length})
            </h3>
            <ul className="space-y-2">
              {entries.map((entry) => {
                const person = data.people[entry.id];
                const emails = contacts[P.contact(entry.id)]?.emails ?? [];
                return (
                  <li key={entry.id} className="px-4 py-3 bg-white rounded-xl border border-gray-100 shadow-sm">
                    <div className="flex items-center gap-3">
                      <Avatar person={person} />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-800 truncate">
                          {person?.name ?? '…'}
                          {entry.role === 'organizer' && <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Organizer</span>}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {[person?.college, data.canManage ? emails.join(', ') : null].filter(Boolean).join(' · ') || ' '}
                        </p>
                      </div>
                      {data.canManage && person && (
                        <button onClick={() => setOpen(open === entry.id ? null : entry.id)} className="text-sm text-gray-400 hover:text-green-700 cursor-pointer shrink-0">
                          {open === entry.id ? 'Close' : 'Manage'}
                        </button>
                      )}
                    </div>
                    {open === entry.id && person && (
                      <ManagePerson data={data} id={entry.id} entry={entry} person={person} emails={emails} onClose={() => setOpen(null)} />
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
      <p className="text-sm text-gray-400">
        {data.roster.filter((e) => e.status === 'active').length} active members
        {!data.canManage && " · People who've been invited show here once they join."}
      </p>
    </div>
  );
}

import { useState, type FormEvent } from 'react';
import type { Person } from '../../data/types';
import { buttonClass, inputClass } from '../parts';

// GHIN's lookup can't link straight to a golfer; it searches by number, entered without dashes
export const GHIN_LOOKUP = 'https://www.ghin.com/golfer-lookup';

export interface ProfileChanges {
  name?: string;
  college: string | null;
  ghin: string | null;
  bio: string | null;
}

// A person's profile: their own (bio, college, GHIN number), or anyone's for organizers and
// admins, who can also fix the name
export default function ProfileForm({
  person,
  allowName,
  onSave,
  onCancel,
}: {
  person: Person;
  allowName: boolean;
  onSave: (changes: ProfileChanges) => Promise<void>;
  onCancel?: () => void;
}) {
  const [name, setName] = useState(person.name);
  const [college, setCollege] = useState(person.college ?? '');
  const [ghin, setGhin] = useState(person.ghin ?? '');
  const [bio, setBio] = useState(person.bio ?? '');
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [error, setError] = useState<string | null>(null);

  const ghinDigits = ghin.replace(/\D/g, '');
  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (allowName && !name.trim()) return setError('A name is needed.');
    setState('saving');
    setError(null);
    try {
      await onSave({
        ...(allowName ? { name: name.trim() } : {}),
        college: college.trim() || null,
        ghin: ghinDigits || null,
        bio: bio.trim() || null,
      });
      setState('saved');
    } catch (err) {
      console.error(err);
      setError("That didn't save. Check your connection and try again.");
      setState('idle');
    }
  };

  const label = 'block text-sm font-medium text-gray-600 mb-1';
  return (
    <form onSubmit={save} className="space-y-4" onChange={() => state === 'saved' && setState('idle')}>
      {allowName && (
        <div>
          <label className={label} htmlFor="profile-name">Name</label>
          <input id="profile-name" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </div>
      )}
      <div>
        <label className={label} htmlFor="profile-college">College</label>
        <input id="profile-college" value={college} onChange={(e) => setCollege(e.target.value)} placeholder="e.g. Texas Tech" className={inputClass} />
      </div>
      <div>
        <label className={label} htmlFor="profile-ghin">GHIN number</label>
        <input id="profile-ghin" value={ghin} onChange={(e) => setGhin(e.target.value)} inputMode="numeric" placeholder="e.g. 1234567" className={inputClass} />
        <p className="text-xs text-gray-400 mt-1">
          {ghinDigits ? (
            <>
              Check it on{' '}
              <a href={GHIN_LOOKUP} target="_blank" rel="noreferrer" className="text-green-700 underline">
                GHIN's Golfer Lookup
              </a>{' '}
              by searching {ghinDigits}.
            </>
          ) : (
            'Used to check pre-trip handicaps against GHIN.'
          )}
        </p>
      </div>
      <div>
        <label className={label} htmlFor="profile-bio">Bio</label>
        <textarea id="profile-bio" value={bio} onChange={(e) => setBio(e.target.value)} rows={4} placeholder="A few lines for the Player's Guide" className={inputClass} />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex items-center gap-3">
        <button type="submit" disabled={state === 'saving'} className={buttonClass}>
          {state === 'saving' ? 'Saving…' : 'Save'}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="text-sm text-gray-500 hover:text-gray-700 font-medium cursor-pointer">
            Close
          </button>
        )}
        {state === 'saved' && <span className="text-sm text-green-700">Saved</span>}
      </div>
    </form>
  );
}

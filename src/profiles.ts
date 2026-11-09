import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { useLiveDoc } from './guides';
import { history } from './history/data';
import type { HistoryPlayer } from './history/types';

// Player bios, written by the admin in the guide and readable by members only (see
// firestore.rules), at profiles/{playerId}. Local dev uses profiles-dev. The rest of a profile comes
// from elsewhere: photo from the repo's history/players.json, college from the member list (Members
// page), record and superlatives from the match data.
const PROFILES = import.meta.env.DEV ? 'profiles-dev' : 'profiles';

interface ProfileDoc {
  bio?: string;
}

// The history player for a guide member: "Mark R" -> Mark Reese (first name and last initial),
// or undefined when there's no single match
export function findPlayer(memberName: string): HistoryPlayer | undefined {
  const [first, ...rest] = memberName.trim().toLowerCase().split(/\s+/);
  const initial = rest.at(-1)?.[0];
  const matches = history.players.filter((p) => {
    const parts = p.name.toLowerCase().split(/\s+/);
    return parts[0] === first && (!initial || parts.at(-1)?.[0] === initial);
  });
  return matches.length === 1 ? matches[0] : undefined;
}

// A member's profile photo URL ("Mark R" -> /profiles/mark-reese.jpg), or null
export function photoFor(memberName: string) {
  const photo = findPlayer(memberName)?.photo;
  return photo ? `${import.meta.env.BASE_URL}${photo}` : null;
}

// A player's bio, live. Pass uid so the listener restarts after sign-in.
export function useBio(playerKey: string, uid: string | null) {
  const { status, data } = useLiveDoc<ProfileDoc>(PROFILES, playerKey, uid ? `${playerKey}:${uid}` : null);
  return { status, bio: data?.bio?.trim() || null };
}

export function saveBio(playerKey: string, bio: string) {
  return setDoc(doc(db, PROFILES, playerKey), { bio: bio.trim(), updatedAt: serverTimestamp() }, { merge: true });
}

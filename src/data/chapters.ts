// Chapters and their requests (Phase 1, step 13): what an admin needs to approve one

import { doc, getDoc, type Firestore } from 'firebase/firestore';
import { personIdFor } from './ids';
import { normalizeEmail, pathsFor } from './paths';
import type { ChapterRequest, DataEnv, Login, Person } from './types';

export interface RequestOrganizer {
  personId: string;
  isNew: boolean; // not in the league yet: approving gives them a person record and a sign-in
  name: string;
  email: string;
}

// Who'll organize a requested chapter: the person their email already signs in as, or someone new,
// with an ID from their name that nobody has. Admins only (it reads sign-ins and people).
export async function organizerFor(db: Firestore, env: DataEnv, request: ChapterRequest): Promise<RequestOrganizer> {
  const p = pathsFor(env);
  const email = normalizeEmail(request.requestedBy.email);
  const login = await getDoc(doc(db, p.login(email)));
  if (login.exists()) {
    const personId = (login.data() as Login).personId;
    const person = await getDoc(doc(db, p.person(personId)));
    return { personId, isNew: false, name: (person.data() as Person | undefined)?.name ?? personId, email };
  }
  const name = request.requestedBy.name?.trim() || email.split('@')[0];
  const taken: string[] = [];
  for (;;) {
    const id = personIdFor(name, taken);
    if (!(await getDoc(doc(db, p.person(id)))).exists()) return { personId: id, isNew: true, name, email };
    taken.push(id);
  }
}

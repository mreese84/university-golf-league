import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { isDevData } from './dataEnv';
import { db } from './firebase';
import type { Member, Trip } from './types';

interface AppState {
  members: Member[];
  trips: Trip[];
  loading: boolean;
  setMembers: (members: Member[]) => void;
  setTrips: (trips: Trip[]) => void;
  addMember: (name: string) => Member;
  updateMember: (id: string, name: string) => void;
  setMemberCollege: (id: string, college: string) => void;
  removeMember: (id: string) => void;
  addTrip: (trip: Omit<Trip, 'id'>) => Trip;
  updateTrip: (trip: Trip) => void;
  removeTrip: (id: string) => void;
  exportData: () => string;
  importData: (json: string) => void;
}

// Trips and members: app/data in the live data, app/data-dev in the dev data
const DOC_REF = doc(db, 'app', isDevData ? 'data-dev' : 'data');

function generateId(): string {
  return crypto.randomUUID();
}

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [members, setMembersState] = useState<Member[]>([]);
  const [trips, setTripsState] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const skipSync = useRef(false);

  // Real-time listener for Firestore
  useEffect(() => {
    const unsub = onSnapshot(DOC_REF, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        skipSync.current = true;
        setMembersState(data.members ?? []);
        setTripsState(data.trips ?? []);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  // Write to Firestore when local state changes (only after initial load)
  useEffect(() => {
    if (loading) return;
    if (skipSync.current) {
      skipSync.current = false;
      return;
    }
    setDoc(DOC_REF, { members, trips });
  }, [members, trips, loading]);

  const setMembers = (m: Member[]) => setMembersState(m);
  const setTrips = (t: Trip[]) => setTripsState(t);

  const addMember = (name: string): Member => {
    const member: Member = { id: generateId(), name };
    setMembersState((prev) => [...prev, member]);
    return member;
  };

  const updateMember = (id: string, name: string) => {
    setMembersState((prev) =>
      prev.map((m) => (m.id === id ? { ...m, name } : m))
    );
  };

  // Blank clears it (the field is left out, since Firestore rejects undefined values)
  const setMemberCollege = (id: string, college: string) => {
    setMembersState((prev) =>
      prev.map((m) => {
        if (m.id !== id) return m;
        const next = { ...m };
        if (college.trim()) next.college = college.trim();
        else delete next.college;
        return next;
      })
    );
  };

  const removeMember = (id: string) => {
    setMembersState((prev) => prev.filter((m) => m.id !== id));
  };

  const addTrip = (tripData: Omit<Trip, 'id'>): Trip => {
    const trip: Trip = { ...tripData, id: generateId() };
    setTripsState((prev) => [...prev, trip]);
    return trip;
  };

  const updateTrip = (trip: Trip) => {
    setTripsState((prev) => prev.map((t) => (t.id === trip.id ? trip : t)));
  };

  const removeTrip = (id: string) => {
    setTripsState((prev) => prev.filter((t) => t.id !== id));
  };

  const exportData = (): string => {
    return JSON.stringify({ members, trips }, null, 2);
  };

  const importData = (json: string) => {
    const data = JSON.parse(json);
    if (data.members && data.trips) {
      setMembersState(data.members);
      setTripsState(data.trips);
    }
  };

  return (
    <AppContext.Provider
      value={{
        members,
        trips,
        loading,
        setMembers,
        setTrips,
        addMember,
        updateMember,
        setMemberCollege,
        removeMember,
        addTrip,
        updateTrip,
        removeTrip,
        exportData,
        importData,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useAppState() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppState must be inside AppProvider');
  return ctx;
}

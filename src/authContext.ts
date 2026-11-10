import { createContext, useContext } from 'react';
import type { User } from 'firebase/auth';

// Who's signed in with Firebase (see AuthProvider in auth.tsx). Who they are in the league, and
// whether they're an admin, comes from the session (src/next/session.tsx).
export interface AuthState {
  user: User | null;
  loading: boolean;
  logOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthState | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}

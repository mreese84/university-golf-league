import { createContext, useContext } from 'react';
import type { User } from 'firebase/auth';

// Who's signed in with Firebase (see AuthProvider in auth.tsx)
export interface AuthState {
  user: User | null;
  isAdmin: boolean; // the commissioner
  loading: boolean;
  logOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthState | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}

import { useEffect, useState, type ReactNode } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { AuthContext } from './authContext';
import { COMMISSIONER_EMAIL } from './data/commissioner';
import { auth } from './firebase';
import { forgetGoogleSignIn } from './googleSignIn';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  // Signing in happens through <GoogleSignInButton />
  const logOut = async () => {
    forgetGoogleSignIn();
    await signOut(auth);
  };

  // The commissioner, for the Move-over page; the app's pages use the session's isAdmin, which
  // also counts co-admins
  const isAdmin = !!user?.emailVerified && user.email?.toLowerCase() === COMMISSIONER_EMAIL;

  return (
    <AuthContext.Provider value={{ user, isAdmin, loading, logOut }}>
      {children}
    </AuthContext.Provider>
  );
}

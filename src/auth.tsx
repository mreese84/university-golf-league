import { useEffect, useState, type ReactNode } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { clearIndexedDbPersistence, terminate } from 'firebase/firestore';
import { AuthContext } from './authContext';
import { auth, db } from './firebase';
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

  // Signing in happens through <GoogleSignInButton />. Signing out also clears the database's
  // local copy, so a shared phone keeps nothing of the chapter, and starts the app afresh.
  const logOut = async () => {
    forgetGoogleSignIn();
    await signOut(auth);
    try {
      await terminate(db);
      await clearIndexedDbPersistence(db);
    } catch (err) {
      console.error(err);
    }
    window.location.assign('/');
  };


  return (
    <AuthContext.Provider value={{ user, loading, logOut }}>
      {children}
    </AuthContext.Provider>
  );
}

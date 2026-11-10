import { useEffect, useState, type ReactNode } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { AuthContext } from './authContext';
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


  return (
    <AuthContext.Provider value={{ user, loading, logOut }}>
      {children}
    </AuthContext.Provider>
  );
}

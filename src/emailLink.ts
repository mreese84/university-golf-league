// Signing in with a link sent by email, for people without a Google account (or who'd rather not
// use it). Firebase sends the email; the link comes back to /finish-sign-in on this site.
// Needs the Email/Password provider with "Email link (passwordless sign-in)" turned on in the
// Firebase console (Authentication → Sign-in method).

import { isSignInWithEmailLink, sendSignInLinkToEmail, signInWithEmailLink } from 'firebase/auth';
import { normalizeEmail } from './data/paths';
import { auth } from './firebase';
import { finishSignInPath } from './routes';

// The email the link went to, so opening it on the same device doesn't ask again
const KEY = 'ugl-sign-in-email';

export function rememberedEmail() {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null; // storage can be unavailable; the finish page then asks for the email
  }
}

function remember(email: string | null) {
  try {
    if (email) localStorage.setItem(KEY, email);
    else localStorage.removeItem(KEY);
  } catch {
    // fine: the finish page asks for the email instead
  }
}

export async function sendSignInLink(email: string, continuePath: string) {
  const url = new URL(finishSignInPath(), window.location.origin);
  url.searchParams.set('continue', continuePath);
  const address = normalizeEmail(email);
  await sendSignInLinkToEmail(auth, address, { url: url.toString(), handleCodeInApp: true });
  remember(address);
}

export const isSignInLink = (href = window.location.href) => isSignInWithEmailLink(auth, href);

// A link's code works once, so a second try with the same link and email (React runs effects twice
// in development) shares the first attempt; after a failure, trying again starts fresh
const finishing = new Map<string, Promise<void>>();

export function finishSignIn(email: string, href = window.location.href) {
  const key = `${normalizeEmail(email)} ${href}`;
  if (!finishing.has(key)) {
    const attempt = signInWithEmailLink(auth, normalizeEmail(email), href).then(
      () => remember(null),
      (err: unknown) => {
        finishing.delete(key);
        throw err;
      },
    );
    finishing.set(key, attempt);
  }
  return finishing.get(key)!;
}

// A plain-language reason for a failed send or sign-in
export function emailLinkError(err: unknown): string {
  const code = (err as { code?: string })?.code ?? '';
  switch (code) {
    case 'auth/invalid-email':
    case 'auth/missing-email':
      return "That email doesn't match the one the link was sent to, or isn't a valid address.";
    case 'auth/operation-not-allowed':
      return "Email sign-in isn't turned on yet. Sign in with Google for now.";
    case 'auth/quota-exceeded':
    case 'auth/too-many-requests':
      return 'Too many sign-in emails just now. Try again in a little while, or sign in with Google.';
    case 'auth/invalid-action-code':
    case 'auth/expired-action-code':
      return 'That sign-in link has expired or was already used. Ask for a new one.';
    case 'auth/network-request-failed':
      return "Couldn't reach the sign-in service. Check your connection and try again.";
    default:
      return "Sign-in didn't work. Please try again.";
  }
}

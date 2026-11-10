import { useState, type FormEvent } from 'react';
import GoogleSignInButton from '../components/GoogleSignInButton';
import { emailLinkError, sendSignInLink } from '../emailLink';
import { Badge, buttonClass, inputClass } from './parts';

// Sign in with a link sent by email
function EmailLinkForm({ continuePath }: { continuePath: string }) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);

  const send = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setState('sending');
    setError(null);
    try {
      await sendSignInLink(email, continuePath);
      setState('sent');
    } catch (err) {
      setError(emailLinkError(err));
      setState('idle');
    }
  };

  if (state === 'sent') {
    return (
      <div className="text-sm text-green-800 bg-green-50 rounded-xl px-4 py-3 space-y-2 text-left">
        <p>
          Check your email: a sign-in link is on its way to <span className="font-semibold">{email.trim()}</span>. Open it on this
          phone or computer to sign straight in.
        </p>
        <button onClick={() => setState('idle')} className="text-xs text-green-700 underline cursor-pointer">
          Use a different email
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={send} className="space-y-2">
      <input
        type="email"
        required
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        aria-label="Email"
        className={inputClass}
      />
      <button type="submit" disabled={state === 'sending'} className={`${buttonClass} w-full py-2.5`}>
        {state === 'sending' ? 'Sending…' : 'Email me a sign-in link'}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </form>
  );
}

// What signed-out visitors see: the logo and tagline, and ways to sign in. Nothing else.
export default function Landing({ continuePath }: { continuePath: string }) {
  return (
    <div className="min-h-[75vh] flex flex-col items-center justify-center text-center">
      <Badge size="large" />
      <h1 className="mt-6 text-3xl font-bold text-gray-900 tracking-tight">University Golf League</h1>
      <p className="mt-2 text-green-600 font-medium tracking-wide">College Football. Average Golf. Unlimited Fireball.</p>

      <div className="mt-10 w-full max-w-xs space-y-5">
        <GoogleSignInButton size="large" text="signin_with" shape="pill" theme="outline" width={300} />
        <div className="flex items-center gap-3 text-xs text-gray-400">
          <span className="h-px flex-1 bg-gray-200" />
          or
          <span className="h-px flex-1 bg-gray-200" />
        </div>
        <EmailLinkForm continuePath={continuePath} />
      </div>

      <p className="mt-10 text-xs text-gray-400 max-w-xs">Members only. Sign in with the email your chapter's organizer has on file.</p>
    </div>
  );
}

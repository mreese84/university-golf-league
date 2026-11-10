import { useEffect, useState, type FormEvent } from 'react';
import { emailLinkError, finishSignIn, isSignInLink, rememberedEmail } from '../emailLink';
import { followLink, navigate, homePath } from '../routes';
import { safeContinuePath } from './continuePath';
import { Notice, Waiting, buttonClass, inputClass } from './parts';

type State = { kind: 'notALink' } | { kind: 'askEmail'; error: string | null } | { kind: 'working' };

// Where an email sign-in link lands. On the device that asked for the link, it signs straight in;
// anywhere else it first asks which email the link went to.
export default function FinishSignIn() {
  const [{ link, remembered, continuePath }] = useState(() => ({
    link: isSignInLink(),
    remembered: rememberedEmail(),
    continuePath: safeContinuePath(new URLSearchParams(window.location.search).get('continue'), homePath()),
  }));
  const [state, setState] = useState<State>(() => (!link ? { kind: 'notALink' } : remembered ? { kind: 'working' } : { kind: 'askEmail', error: null }));
  const [email, setEmail] = useState('');

  // Signs straight in with the email this device asked with
  useEffect(() => {
    if (!link || !remembered) return;
    let cancelled = false;
    finishSignIn(remembered).then(
      () => {
        if (!cancelled) navigate(continuePath, { replace: true });
      },
      (err: unknown) => {
        if (!cancelled) setState({ kind: 'askEmail', error: emailLinkError(err) });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [link, remembered, continuePath]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setState({ kind: 'working' });
    try {
      await finishSignIn(email);
      navigate(continuePath, { replace: true });
    } catch (err) {
      setState({ kind: 'askEmail', error: emailLinkError(err) });
    }
  };

  if (state.kind === 'working') return <Waiting>Signing you in…</Waiting>;
  if (state.kind === 'notALink') {
    return (
      <Notice title="Nothing to sign in with here">
        <p>This page finishes signing in from an email link, and this address isn't one.</p>
        <a href={homePath()} onClick={(e) => followLink(e, homePath())} className="text-green-700 font-medium">
          Go to sign-in
        </a>
      </Notice>
    );
  }
  return (
    <Notice title="Which email was the link for?">
      <p>You opened the link on a different phone or browser than the one that asked for it, so confirm the email first.</p>
      <form onSubmit={submit} className="space-y-2 max-w-xs mx-auto">
        <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" aria-label="Email" className={inputClass} />
        <button type="submit" className={`${buttonClass} w-full py-2.5`}>
          Sign in
        </button>
      </form>
      {state.error && <p className="text-xs text-red-600">{state.error}</p>}
    </Notice>
  );
}

import type { ReactNode } from 'react';
import { isDevData } from '../dataEnv';
import { followLink, nextHomePath } from '../routes';
import UserAvatar from '../components/UserAvatar';
import { useSession } from './sessionContext';

export const buttonClass =
  'px-4 py-2 bg-green-600 text-white rounded-xl font-medium text-sm hover:bg-green-700 ' +
  'disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer';

export const inputClass =
  'w-full min-w-0 px-4 py-2.5 border border-gray-200 rounded-xl bg-white text-gray-900 placeholder:text-gray-400 ' +
  'focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500';

export function Notice({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center space-y-3">
      <p className="text-lg font-semibold text-gray-800">{title}</p>
      {children && <div className="text-sm text-gray-500 space-y-3">{children}</div>}
    </div>
  );
}

export const Waiting = ({ children }: { children: ReactNode }) => <p className="text-gray-400 text-center py-12">{children}</p>;

// The UGL flag, turned white on a black circle
export function Badge({ size }: { size: 'small' | 'large' }) {
  return (
    <span className={`shrink-0 rounded-full bg-black flex items-center justify-center ${size === 'large' ? 'w-24 h-24' : 'w-10 h-10'}`}>
      <img src={`${import.meta.env.BASE_URL}ugl-logo-v2.png`} alt="UGL" className={`object-contain invert ${size === 'large' ? 'w-20' : 'w-8'}`} />
    </span>
  );
}

// The frame around every Phase 1 page: the dev-data banner, and a header once someone is signed in
export function NextLayout({ children }: { children: ReactNode }) {
  const { user, logOut } = useSession();
  return (
    <div className="min-h-screen bg-gray-50">
      {isDevData && (
        <p className="bg-amber-100 text-amber-900 text-xs text-center px-4 py-1.5">
          <span className="font-semibold">Dev data.</span> Changes here don't affect the live site.
        </p>
      )}
      {user && (
        <header className="bg-white border-b border-gray-100 shadow-sm">
          <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
            <a href={nextHomePath()} onClick={(e) => followLink(e, nextHomePath())} className="flex items-center gap-3 min-w-0 flex-1">
              <Badge size="small" />
              <span className="font-bold text-gray-900 tracking-tight truncate">University Golf League</span>
            </a>
            <UserAvatar key={user.uid} user={user} />
            <button onClick={logOut} className="text-xs text-gray-400 hover:text-gray-600 transition-colors cursor-pointer">
              Sign out
            </button>
          </div>
        </header>
      )}
      <main className="max-w-2xl mx-auto px-4 py-8">{children}</main>
    </div>
  );
}

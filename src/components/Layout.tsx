import type { ReactNode } from 'react';
import { useAuth } from '../auth';
import { isDevData } from '../dataEnv';
import GoogleSignInButton from './GoogleSignInButton';
import UserAvatar from './UserAvatar';

type Tab = 'members' | 'trips' | 'selection' | 'history';

interface LayoutProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  showHistory: boolean;
  children: ReactNode;
}

const allTabs: { key: Tab; label: string }[] = [
  { key: 'trips', label: 'Trips' },
  { key: 'selection', label: 'Selection' },
  { key: 'members', label: 'Members' },
  { key: 'history', label: 'History' },
];

export default function Layout({ activeTab, onTabChange, showHistory, children }: LayoutProps) {
  const { user, isAdmin, logOut } = useAuth();
  const tabs = allTabs.filter((tab) => tab.key !== 'history' || showHistory);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* On the dev server and preview links, so they're never mistaken for the live site */}
      {isDevData && (
        <p className="bg-amber-100 text-amber-900 text-xs text-center px-4 py-1.5">
          <span className="font-semibold">Dev data.</span> Changes here don't affect the live site.
        </p>
      )}

      {/* Header */}
      <header className="bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-5 flex items-center gap-4">
          {/* Badge: the black flag logo turned white on a black circle */}
          <div className="w-14 h-14 shrink-0 rounded-full bg-black flex items-center justify-center">
            <img
              src={`${import.meta.env.BASE_URL}ugl-logo-v2.png`}
              alt="UGL Logo"
              className="w-12 object-contain invert"
            />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
              University Golf League
            </h1>
            <p className="text-sm text-green-600 font-medium tracking-wide mt-0.5">
              College Football. Average Golf. Unlimited Fireball.
            </p>
          </div>
          <div className="shrink-0">
            {user ? (
              <div className="flex flex-col items-end gap-1">
                <UserAvatar key={user.uid} user={user} />
                <div className="flex items-center gap-2">
                  {isAdmin && (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                      Admin
                    </span>
                  )}
                  <button
                    onClick={logOut}
                    className="text-xs text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                  >
                    Sign out
                  </button>
                </div>
              </div>
            ) : (
              <GoogleSignInButton size="medium" text="signin" shape="pill" theme="outline" />
            )}
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <nav className="bg-white border-b border-gray-100">
        <div className="max-w-2xl mx-auto px-4">
          <div className="flex gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => onTabChange(tab.key)}
                className={`px-3 sm:px-5 py-3 text-sm font-medium transition-colors relative cursor-pointer
                  ${activeTab === tab.key
                    ? 'text-green-700'
                    : 'text-gray-500 hover:text-gray-700'
                  }`}
              >
                {tab.label}
                {activeTab === tab.key && (
                  <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-green-600 rounded-full" />
                )}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className={`mx-auto px-4 py-8 ${activeTab === 'selection' ? 'max-w-4xl' : 'max-w-2xl'}`}>{children}</main>
    </div>
  );
}

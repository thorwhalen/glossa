import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { AudioStatusToast } from './AudioStatusToast';

const THEME_KEY = 'glossa-theme';

function readInitialTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  const stored = window.localStorage.getItem(THEME_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

export function AppShell({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<'light' | 'dark'>(readInitialTheme);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
    window.localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  return (
    <>
      <button
        type="button"
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        aria-label={`switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        className="fixed right-4 top-4 z-30 rounded-full border border-neutral-200 bg-white p-2 text-neutral-600 shadow-sm transition hover:border-accent hover:text-accent dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300"
      >
        {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
      </button>
      <AudioStatusToast />
      {children}
    </>
  );
}

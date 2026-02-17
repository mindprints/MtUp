import { useState, FormEvent } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useTheme } from '@/lib/ThemeContext';
import { isSupabaseMode } from '@/lib/runtimeConfig';

export function Login() {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login } = useAuth();
  const { isDarkMode, toggleTheme } = useTheme();

  const usingSupabase = isSupabaseMode();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    setIsSubmitting(true);
    const uiFailSafe = setTimeout(() => {
      setIsSubmitting(false);
      setError('Sign-in timed out. Please try again.');
    }, 15000);
    let success = false;
    try {
      success = await login(name, password);
    } finally {
      clearTimeout(uiFailSafe);
      setIsSubmitting(false);
    }

    if (!success) {
      setError(
        usingSupabase
          ? 'Sign-in failed. Check email/password and Supabase settings.'
          : 'Invalid username or password'
      );
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-950">
      <div className="absolute top-4 right-4 flex flex-col items-end gap-1">
        <label className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md dark:bg-slate-800 dark:text-slate-200 dark:border-slate-600">
          <span>{isDarkMode ? 'Dark' : 'Light'}</span>
          <span className="relative inline-flex items-center">
            <input
              type="checkbox"
              checked={isDarkMode}
              onChange={toggleTheme}
              className="sr-only peer"
              aria-label="Toggle dark mode"
            />
            <span className="h-5 w-9 rounded-full bg-gray-300 dark:bg-slate-600 peer-checked:bg-blue-600 transition-colors" />
            <span className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white peer-checked:translate-x-4 transition-transform" />
          </span>
        </label>
        <span className="text-[11px] text-gray-500 dark:text-slate-400">
          Applies app-wide
        </span>
      </div>
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow-md dark:bg-slate-900 dark:border dark:border-slate-800">
        <div>
          <h2 className="text-center text-3xl font-bold text-gray-900 dark:text-slate-100">
            Schedule App
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600 dark:text-slate-300">
            Sign in to continue
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-slate-200">
                {usingSupabase ? 'Email' : 'Username'}
              </label>
              <input
                id="name"
                name="name"
                type={usingSupabase ? 'email' : 'text'}
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100"
                placeholder={usingSupabase ? 'Enter your email' : 'Enter your username'}
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-slate-200">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100"
                placeholder="Enter your password"
              />
            </div>
          </div>

          {error && (
            <div className="text-red-600 text-sm text-center">{error}</div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            {isSubmitting ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        {!usingSupabase && (
          <div className="mt-4 text-xs text-gray-500 dark:text-slate-400 text-center">
            <p className="font-semibold mb-2">Test Users:</p>
            <p>Alice (admin), Bob, Charlie, Diana, Eve</p>
            <p className="mt-1">Password: <span className="font-mono">password</span></p>
          </div>
        )}
      </div>
    </div>
  );
}

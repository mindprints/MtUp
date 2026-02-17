import { useAuth } from '@/lib/AuthContext';
import { useTheme } from '@/lib/ThemeContext';

type DashboardProps = {
  children: React.ReactNode;
};

export function Dashboard({ children }: DashboardProps) {
  const { user, logout } = useAuth();
  const { isDarkMode, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950">
      <header className="bg-white shadow-sm dark:bg-slate-900 dark:shadow-none dark:border-b dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Schedule App</h1>
              <p className="text-sm text-gray-600 mt-1 dark:text-slate-300">
                Welcome, {user ? 'Me' : ''}
                {user?.isAdmin && ' (Admin)'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <details className="relative">
                <summary className="list-none cursor-pointer px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-600 dark:hover:bg-slate-700">
                  Instructions
                </summary>
                <div className="absolute right-0 mt-2 w-80 z-20 rounded-md border border-gray-200 bg-white p-3 text-sm text-gray-700 shadow-lg dark:bg-slate-900 dark:border-slate-700 dark:text-slate-200">
                  <p>
                    Calendar: select a proposal, then click or drag on dates to mark availability.
                  </p>
                  <p className="mt-2">
                    On an activity lane: click to mark, Ctrl/Cmd+click to remove, and click again (once marked) to open details.
                  </p>
                  <p className="mt-2">
                    Filters: use Display All, My Proposals, or Selected to control what appears on the calendar.
                  </p>
                  <p className="mt-2">
                    Sejour tip: in Time, use <strong>Generate Overlap Windows</strong> to create candidate ranges from shared availability.
                  </p>
                </div>
              </details>
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
              <button
                onClick={logout}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-600 dark:hover:bg-slate-700 dark:focus:ring-offset-slate-900"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}

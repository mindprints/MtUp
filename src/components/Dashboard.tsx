import { useAuth } from '@/lib/AuthContext';
import { useTheme } from '@/lib/ThemeContext';

type DashboardProps = {
  children: React.ReactNode;
};

export function Dashboard({ children }: DashboardProps) {
  const { user, logout } = useAuth();
  const { isDarkMode, toggleTheme } = useTheme();
  const containerWidthClass = 'max-w-[430px]';

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-gray-50 dark:bg-slate-950">
      <header className="bg-white shadow-sm dark:bg-slate-900 dark:shadow-none dark:border-b dark:border-slate-800">
        <div className={`${containerWidthClass} mx-auto px-3 py-3 transition-all`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">
                Snookey&apos;s Here to Help.
              </h1>
              <p className="text-xs text-gray-600 mt-0.5 dark:text-slate-300">
                Welcome, {user?.name || ''}
                {user?.isAdmin && ' (Admin)'}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <details className="relative">
                <summary className="list-none cursor-pointer px-2.5 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-600 dark:hover:bg-slate-700">
                  Instructions
                </summary>
                <div className="absolute right-0 mt-2 w-80 z-20 rounded-md border border-gray-200 bg-white p-3 text-sm text-gray-700 shadow-lg dark:bg-slate-900 dark:border-slate-700 dark:text-slate-200">
                  <p>
                    Create with + Event or + Sejour, then select a proposal and click or drag dates to mark availability.
                  </p>
                  <p className="mt-2">
                    On an activity lane: click to mark, Ctrl/Cmd+click to remove, and click again (once marked) to open details.
                  </p>
                  <p className="mt-2">
                    Filters: use Display All, My Proposals, My Choices, or Selected to control what appears on the calendar.
                  </p>
                  <p className="mt-2">
                    Sejour tip: in Time, use <strong>Generate Overlap Windows</strong> to create candidate ranges from shared availability.
                  </p>
                </div>
              </details>
              <label className="inline-flex items-center gap-2 px-2.5 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md dark:bg-slate-800 dark:text-slate-200 dark:border-slate-600">
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
                className="px-2.5 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-600 dark:hover:bg-slate-700 dark:focus:ring-offset-slate-900"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </header>
      <main className={`${containerWidthClass} mx-auto min-h-0 flex-1 px-2 py-2 transition-all`}>
        <div
          className="mx-auto h-full max-h-[845px] aspect-[9/19.5] overflow-hidden rounded-[2rem] border border-gray-900 bg-white p-1 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
        >
          <div
            className="flex h-full flex-col overflow-hidden rounded-[1.5rem] border border-gray-200 bg-gray-50 dark:border-slate-700 dark:bg-slate-950"
          >
            <div className="flex items-center justify-between border-b border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
              <span>09:41</span>
              <div className="flex items-center gap-1" aria-hidden="true">
                <span className="h-1.5 w-1.5 rounded-full bg-gray-400 dark:bg-slate-500" />
                <span className="h-1.5 w-1.5 rounded-full bg-gray-400 dark:bg-slate-500" />
                <span className="h-1.5 w-4 rounded-sm bg-gray-400 dark:bg-slate-500" />
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-hidden px-1 pb-1">{children}</div>
          </div>
        </div>
      </main>
    </div>
  );
}

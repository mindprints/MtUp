import { useAuth } from '@/lib/AuthContext';
import { useTheme } from '@/lib/ThemeContext';

export function SettingsScreen() {
  const { logout } = useAuth();
  const { isDarkMode, toggleTheme } = useTheme();

  return (
    <div className="min-h-0 flex-1 overflow-hidden rounded-lg bg-white p-3 dark:border dark:border-slate-800 dark:bg-slate-900">
      <div
        data-screen-scroll-root="true"
        className="hide-scrollbar flex h-full min-h-0 flex-col gap-4 overflow-y-auto"
      >
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
            Settings
          </p>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Controls</h2>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Theme, guidance, and session controls live here now.
          </p>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950/60">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Appearance</h3>
              <p className="text-xs text-slate-600 dark:text-slate-300">Switch between light and dark mode.</p>
            </div>
            <label className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">
              <span>{isDarkMode ? 'Dark' : 'Light'}</span>
              <span className="relative inline-flex items-center">
                <input
                  type="checkbox"
                  checked={isDarkMode}
                  onChange={toggleTheme}
                  className="sr-only peer"
                  aria-label="Toggle dark mode"
                />
                <span className="h-5 w-9 rounded-full bg-slate-300 transition-colors peer-checked:bg-blue-600 dark:bg-slate-600" />
                <span className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform peer-checked:translate-x-4" />
              </span>
            </label>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-950/80">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Instructions</h3>
          <div className="mt-3 space-y-3 text-sm text-slate-600 dark:text-slate-300">
            <p>
              Create with + Event or + Sejour, then select a proposal and click or drag dates to mark availability.
            </p>
            <p>
              On an activity lane: click to mark, Ctrl/Cmd+click to remove, and click again once marked to open details.
            </p>
            <p>
              Filters let you switch between Display All, My Proposals, My Choices, or Selected.
            </p>
            <p>
              Use the left and right arrow keys to snap between phone screens.
            </p>
            <p>
              Sejour tip: in Time, use <strong>Generate Overlap Windows</strong> to create candidate ranges from shared
              availability.
            </p>
          </div>
        </section>

        <section className="mt-auto rounded-2xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-900/70 dark:bg-rose-950/30">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Session</h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">End the current session on this device.</p>
          <button
            onClick={logout}
            className="mt-4 w-full rounded-xl border border-rose-300 bg-white px-4 py-3 text-sm font-semibold text-rose-700 hover:bg-rose-100 dark:border-rose-800 dark:bg-slate-900 dark:text-rose-300 dark:hover:bg-rose-950/40"
          >
            Sign out
          </button>
        </section>
      </div>
    </div>
  );
}

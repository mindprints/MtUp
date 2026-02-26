import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useTheme } from '@/lib/ThemeContext';

type DashboardProps = {
  children: React.ReactNode;
};

type PreviewMode = 'phone' | 'tablet' | 'desktop';

const PREVIEW_MODE_STORAGE_KEY = 'mtup-preview-mode';

function readInitialPreviewMode(): PreviewMode {
  const stored = localStorage.getItem(PREVIEW_MODE_STORAGE_KEY);
  if (stored === 'phone' || stored === 'tablet' || stored === 'desktop') {
    return stored;
  }
  return 'desktop';
}

export function Dashboard({ children }: DashboardProps) {
  const { user, logout } = useAuth();
  const { isDarkMode, toggleTheme } = useTheme();
  const [previewMode, setPreviewMode] = useState<PreviewMode>(readInitialPreviewMode);

  useEffect(() => {
    localStorage.setItem(PREVIEW_MODE_STORAGE_KEY, previewMode);
  }, [previewMode]);

  const containerWidthClass =
    previewMode === 'phone'
      ? 'max-w-[430px]'
      : previewMode === 'tablet'
        ? 'max-w-3xl'
        : 'max-w-7xl';
  const isDevicePreview = previewMode !== 'desktop';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950">
      <header className="bg-white shadow-sm dark:bg-slate-900 dark:shadow-none dark:border-b dark:border-slate-800">
        <div className={`${containerWidthClass} mx-auto px-4 py-4 sm:px-6 lg:px-8 transition-all`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">
                Snookey&apos;s Here to Help.
              </h1>
              <p className="text-sm text-gray-600 mt-1 dark:text-slate-300">
                Welcome, {user?.name || ''}
                {user?.isAdmin && ' (Admin)'}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <div className="inline-flex rounded-md border border-gray-300 overflow-hidden dark:border-slate-600">
                {([
                  { key: 'phone', label: 'Phone' },
                  { key: 'tablet', label: 'Tablet' },
                  { key: 'desktop', label: 'Desktop' },
                ] as const).map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setPreviewMode(option.key)}
                    className={`px-2.5 py-1.5 text-xs font-medium ${
                      previewMode === option.key
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-gray-700 hover:bg-gray-50 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
                    }`}
                    aria-pressed={previewMode === option.key}
                    title={`${option.label} preview`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <details className="relative">
                <summary className="list-none cursor-pointer px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-600 dark:hover:bg-slate-700">
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
      <main className={`${containerWidthClass} mx-auto px-4 py-8 sm:px-6 lg:px-8 transition-all`}>
        {isDevicePreview ? (
          <div
            className={`mx-auto overflow-hidden border bg-white shadow-2xl transition-all dark:bg-slate-900 ${
              previewMode === 'phone'
                ? 'max-w-[390px] rounded-[2rem] border-gray-900 p-2 dark:border-slate-600'
                : 'max-w-3xl rounded-[1.25rem] border-gray-300 p-3 dark:border-slate-700'
            }`}
          >
            <div
              className={`overflow-hidden bg-gray-50 dark:bg-slate-950 ${
                previewMode === 'phone'
                  ? 'rounded-[1.5rem] border border-gray-200 dark:border-slate-700'
                  : 'rounded-xl border border-gray-200 dark:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-2 text-xs text-gray-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                <span>{previewMode === 'phone' ? '9:41' : 'Tablet Preview'}</span>
                <div className="flex items-center gap-1" aria-hidden="true">
                  <span className="h-1.5 w-1.5 rounded-full bg-gray-400 dark:bg-slate-500" />
                  <span className="h-1.5 w-1.5 rounded-full bg-gray-400 dark:bg-slate-500" />
                  <span className="h-1.5 w-4 rounded-sm bg-gray-400 dark:bg-slate-500" />
                </div>
              </div>
              {previewMode === 'phone' && (
                <div className="pointer-events-none flex justify-center py-1.5">
                  <div className="h-1.5 w-20 rounded-full bg-gray-300 dark:bg-slate-700" />
                </div>
              )}
              <div className={previewMode === 'phone' ? 'px-2 pb-2' : 'px-2 pb-2'}>{children}</div>
            </div>
          </div>
        ) : (
          children
        )}
      </main>
    </div>
  );
}

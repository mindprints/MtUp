type DashboardProps = {
  children: React.ReactNode;
};

export function Dashboard({ children }: DashboardProps) {
  const containerWidthClass = 'w-full lg:max-w-[430px]';

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-gray-50 dark:bg-slate-950">
      <main className={`${containerWidthClass} mx-auto min-h-0 flex-1 px-0 py-0 transition-all lg:px-2 lg:py-2`}>
        <div
          className="h-full overflow-hidden bg-white dark:bg-slate-900 lg:mx-auto lg:max-h-[845px] lg:aspect-[9/19.5] lg:rounded-[2rem] lg:border lg:border-gray-900 lg:p-1 lg:shadow-2xl dark:lg:border-slate-700 dark:lg:bg-slate-900"
        >
          <div
            className="flex h-full flex-col overflow-hidden bg-gray-50 dark:bg-slate-950 lg:rounded-[1.5rem] lg:border lg:border-gray-200 dark:lg:border-slate-700"
          >
            <div className="hidden items-center justify-between border-b border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 lg:flex">
              <span>09:41</span>
              <div className="flex items-center gap-1" aria-hidden="true">
                <span className="h-1.5 w-1.5 rounded-full bg-gray-400 dark:bg-slate-500" />
                <span className="h-1.5 w-1.5 rounded-full bg-gray-400 dark:bg-slate-500" />
                <span className="h-1.5 w-4 rounded-sm bg-gray-400 dark:bg-slate-500" />
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-hidden px-0 pb-0 lg:px-1 lg:pb-1">{children}</div>
          </div>
        </div>
      </main>
    </div>
  );
}

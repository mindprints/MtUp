import { getAvailabilitySummaryForEvent, getAvailabilitySummaryForSejour } from '@/lib/resolverUtils';
import type { Availability, Proposal } from '@/types';

type ResolverAvailabilityPanelProps = {
  proposal: Proposal;
  availabilities: Availability[];
  userNameById: Map<string, string>;
};

export function ResolverAvailabilityPanel({
  proposal,
  availabilities,
  userNameById,
}: ResolverAvailabilityPanelProps) {
  const isSejour = proposal.type === 'sejour';

  if (isSejour) {
    const windows = getAvailabilitySummaryForSejour(proposal, availabilities);

    return (
      <section className="rounded-xl border border-gray-200 bg-stone-50 p-4 dark:border-slate-700 dark:bg-slate-950">
        <div className="mb-3">
          <h3 className="text-base font-semibold text-gray-900 dark:text-slate-100">Availability</h3>
          <p className="mt-1 text-sm text-gray-600 dark:text-slate-400">
            Overlap windows for this sejour.
          </p>
        </div>
        {windows.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-slate-400">
            No overlap windows available yet.
          </p>
        ) : (
          <div className="space-y-2">
            {windows.map((window) => (
              <div
                key={`${window.startDate}-${window.endDate}-${window.participantUserIds.join(',')}`}
                className="rounded-lg border border-gray-200 bg-white p-3 text-sm dark:border-slate-700 dark:bg-slate-900"
              >
                <div className="font-medium text-gray-900 dark:text-slate-100">{window.label}</div>
                <div className="mt-1 text-gray-600 dark:text-slate-400">
                  {window.participantCount} participants, {window.nights} nights
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {window.participantUserIds.map((userId) => (
                    <span
                      key={userId}
                      className="rounded-full border border-gray-200 bg-stone-50 px-2 py-0.5 text-[11px] text-gray-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                    >
                      {userNameById.get(userId) || userId}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    );
  }

  const summary = getAvailabilitySummaryForEvent(proposal, availabilities);

  return (
    <section className="rounded-xl border border-gray-200 bg-stone-50 p-4 dark:border-slate-700 dark:bg-slate-950">
      <div className="mb-3">
        <h3 className="text-base font-semibold text-gray-900 dark:text-slate-100">Availability</h3>
        <p className="mt-1 text-sm text-gray-600 dark:text-slate-400">
          Who has marked availability for this event.
        </p>
      </div>
      <div className="grid gap-2 md:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
          <div className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-slate-400">Baseline date</div>
          <div className="mt-1 text-sm text-gray-900 dark:text-slate-100">
            {summary.baselineDate || 'Not set'}
          </div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
          <div className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-slate-400">Participants</div>
          <div className="mt-1 text-sm text-gray-900 dark:text-slate-100">
            {summary.participantUserIds.length}
          </div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
          <div className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-slate-400">Marked dates</div>
          <div className="mt-1 text-sm text-gray-900 dark:text-slate-100">{summary.dateCount}</div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1">
        {summary.participantUserIds.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-slate-400">No one has marked availability yet.</p>
        ) : (
          summary.participantUserIds.map((userId) => (
            <span
              key={userId}
              className="rounded-full border border-gray-200 bg-white px-2 py-0.5 text-[11px] text-gray-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
            >
              {userNameById.get(userId) || userId}
            </span>
          ))
        )}
      </div>
    </section>
  );
}

import type { Proposal } from '@/types';

type ResolverSummaryCardProps = {
  proposal: Proposal;
  creatorName: string;
  alternativeCount: number;
  commentCount: number;
};

export function ResolverSummaryCard({
  proposal,
  creatorName,
  alternativeCount,
  commentCount,
}: ResolverSummaryCardProps) {
  return (
    <section className="rounded-xl border border-gray-200 bg-stone-50 p-4 dark:border-slate-700 dark:bg-slate-950">
      <div className="flex items-start gap-3">
        <div className="text-3xl leading-none">{proposal.emoji}</div>
        <div className="min-w-0 flex-1">
          <div className="text-lg font-semibold text-gray-900 dark:text-slate-100">
            {proposal.title}
          </div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] uppercase tracking-wide text-gray-700 dark:bg-slate-800 dark:text-slate-300">
              {proposal.type}
            </span>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] uppercase tracking-wide text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
              {proposal.status}
            </span>
          </div>
          <div className="mt-2 text-xs text-gray-600 dark:text-slate-400">Created by {creatorName}</div>
        </div>
      </div>

      <div className="mt-4 grid gap-2 text-sm text-gray-800 dark:text-slate-200 md:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
          <div className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-slate-400">Date</div>
          <div className="mt-1">{proposal.specifics?.date || 'Not set'}</div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
          <div className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-slate-400">Time</div>
          <div className="mt-1">{proposal.specifics?.time || 'Not set'}</div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
          <div className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-slate-400">Place</div>
          <div className="mt-1">{proposal.specifics?.location || 'Not set'}</div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-gray-600 dark:text-slate-400">
        <span className="rounded-full border border-gray-200 bg-white px-2 py-0.5 dark:border-slate-700 dark:bg-slate-900">
          {alternativeCount} alternatives
        </span>
        <span className="rounded-full border border-gray-200 bg-white px-2 py-0.5 dark:border-slate-700 dark:bg-slate-900">
          {commentCount} comments
        </span>
      </div>
    </section>
  );
}

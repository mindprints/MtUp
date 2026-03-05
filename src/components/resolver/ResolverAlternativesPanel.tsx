import { proposalThreadStore } from '@/lib/proposalThreadStore';
import type { ProposalContribution } from '@/types';

type ResolverAlternativesPanelProps = {
  proposalId: string;
  userNameById: Map<string, string>;
};

function readAlternativeText(entry: ProposalContribution): string {
  if (typeof entry.value.dateText === 'string') return entry.value.dateText;
  if (typeof entry.value.text === 'string') return entry.value.text;
  return 'Unspecified';
}

function AlternativeGroup({
  title,
  entries,
  userNameById,
}: {
  title: string;
  entries: ProposalContribution[];
  userNameById: Map<string, string>;
}) {
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold text-gray-900 dark:text-slate-100">{title}</h4>
      {entries.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-slate-400">No suggestions.</p>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="rounded-lg border border-gray-200 bg-white p-3 text-sm text-gray-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              <div className="font-medium">
                {userNameById.get(entry.userId) || 'Unknown'}
              </div>
              <div className="mt-1">{readAlternativeText(entry)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ResolverAlternativesPanel({
  proposalId,
  userNameById,
}: ResolverAlternativesPanelProps) {
  const entries = proposalThreadStore
    .listForProposal(proposalId)
    .filter((entry) => entry.kind === 'field_change');
  const dateEntries = entries.filter((entry) => entry.field === 'date');
  const timeEntries = entries.filter((entry) => entry.field === 'time');
  const placeEntries = entries.filter((entry) => entry.field === 'place');

  return (
    <section className="rounded-xl border border-gray-200 bg-stone-50 p-4 dark:border-slate-700 dark:bg-slate-950">
      <div className="mb-3">
        <h3 className="text-base font-semibold text-gray-900 dark:text-slate-100">Alternatives</h3>
        <p className="mt-1 text-sm text-gray-600 dark:text-slate-400">
          Suggestions collected from proposal discussion history.
        </p>
      </div>
      {dateEntries.length === 0 && timeEntries.length === 0 && placeEntries.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-slate-400">No alternatives suggested yet.</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <AlternativeGroup title="Dates" entries={dateEntries} userNameById={userNameById} />
          <AlternativeGroup title="Times" entries={timeEntries} userNameById={userNameById} />
          <AlternativeGroup title="Places" entries={placeEntries} userNameById={userNameById} />
        </div>
      )}
    </section>
  );
}

import { FormEvent, useMemo, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useProposals } from '@/lib/ProposalContext';
import { isSupabaseMode } from '@/lib/runtimeConfig';

type AdminDashboardProps = {
  onGoActivities: () => void;
};

export function AdminDashboard({ onGoActivities }: AdminDashboardProps) {
  const { user } = useAuth();
  const { groupUsers, proposals, deleteProposal, addMember, setMemberAdmin, removeMember } =
    useProposals();
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberPassword, setNewMemberPassword] = useState('password');
  const [newMemberIsAdmin, setNewMemberIsAdmin] = useState(false);

  const sortedProposals = useMemo(
    () =>
      [...proposals].sort((a, b) => {
        return b.createdAt.localeCompare(a.createdAt);
      }),
    [proposals]
  );

  if (!user?.isAdmin) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg bg-white p-4 text-sm text-gray-600 dark:bg-slate-900 dark:text-slate-300">
        Admin access required.
      </div>
    );
  }

  const handleAddMember = async (event: FormEvent) => {
    event.preventDefault();
    const result = await addMember({
      name: newMemberName,
      password: newMemberPassword,
      isAdmin: newMemberIsAdmin,
    });
    setStatusMessage(result.ok ? 'Member added.' : result.message || 'Failed to add member.');
    if (result.ok) {
      setNewMemberName('');
      setNewMemberPassword('password');
      setNewMemberIsAdmin(false);
    }
  };

  const handleToggleAdmin = async (memberId: string, isAdmin: boolean) => {
    const result = await setMemberAdmin(memberId, !isAdmin);
    setStatusMessage(
      result.ok ? 'Member role updated.' : result.message || 'Failed to update member role.'
    );
  };

  const handleRemoveMember = async (memberId: string, memberName: string) => {
    if (!window.confirm(`Remove ${memberName} from members?`)) return;
    const result = await removeMember(memberId);
    setStatusMessage(result.ok ? 'Member removed.' : result.message || 'Failed to remove member.');
  };

  const handleDeleteProposal = (proposalId: string, title: string) => {
    if (!window.confirm(`Delete "${title}"? This cannot be undone.`)) return;
    deleteProposal(proposalId);
    setStatusMessage('Event deleted.');
  };

  const handleDeleteAll = () => {
    if (
      !window.confirm(`Delete all ${proposals.length} events? This action cannot be undone.`)
    ) {
      return;
    }
    proposals.forEach((proposal) => deleteProposal(proposal.id));
    setStatusMessage('All events deleted.');
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="rounded-lg bg-white p-2 dark:border dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">Admin Dashboard</p>
          <button
            type="button"
            onClick={onGoActivities}
            className="rounded-md border border-gray-300 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Activities
          </button>
        </div>
        {statusMessage && (
          <p className="mt-2 text-xs text-blue-700 dark:text-blue-300">{statusMessage}</p>
        )}
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
        <section className="rounded-lg bg-white p-3 dark:border dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-700 dark:text-slate-300">
            Members
          </h2>
          <div className="mt-2 space-y-2">
            {groupUsers.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between rounded-md border border-gray-200 bg-gray-50 p-2 dark:border-slate-700 dark:bg-slate-950"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-slate-100">
                    {member.name}
                    {member.id === user.id ? ' (You)' : ''}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-slate-400">
                    {member.isAdmin ? 'Admin' : 'Member'}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-slate-400">
                    {member.email || 'Email unavailable'}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => void handleToggleAdmin(member.id, member.isAdmin)}
                    className="rounded border border-gray-300 px-2 py-1 text-[11px] text-gray-700 hover:bg-white dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-900"
                  >
                    {member.isAdmin ? 'Demote' : 'Promote'}
                  </button>
                  <button
                    type="button"
                    disabled={member.id === user.id}
                    onClick={() => void handleRemoveMember(member.id, member.name)}
                    className="rounded border border-red-200 px-2 py-1 text-[11px] text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-900/60 dark:text-red-300 dark:hover:bg-red-950/20"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>

          <form onSubmit={handleAddMember} className="mt-3 space-y-2 rounded-md border border-gray-200 p-2 dark:border-slate-700">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-700 dark:text-slate-300">
              Add Member
            </p>
            <input
              type="text"
              value={newMemberName}
              onChange={(event) => setNewMemberName(event.target.value)}
              placeholder="Name"
              className="w-full rounded border border-gray-300 px-2 py-1.5 text-xs text-gray-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
            <input
              type="text"
              value={newMemberPassword}
              onChange={(event) => setNewMemberPassword(event.target.value)}
              placeholder="Password"
              className="w-full rounded border border-gray-300 px-2 py-1.5 text-xs text-gray-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
            <label className="flex items-center gap-2 text-xs text-gray-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={newMemberIsAdmin}
                onChange={(event) => setNewMemberIsAdmin(event.target.checked)}
              />
              Admin
            </label>
            <button
              type="submit"
              className="rounded bg-blue-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
            >
              Add Member
            </button>
            {isSupabaseMode() && (
              <p className="text-[11px] text-amber-700 dark:text-amber-300">
                Supabase mode currently supports role/remove management. New auth-user creation is
                not enabled in-app yet.
              </p>
            )}
          </form>
        </section>

        <section className="rounded-lg bg-white p-3 dark:border dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-700 dark:text-slate-300">
              Events
            </h2>
            <button
              type="button"
              onClick={handleDeleteAll}
              disabled={proposals.length === 0}
              className="rounded border border-red-200 px-2 py-1 text-[11px] text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-900/60 dark:text-red-300 dark:hover:bg-red-950/20"
            >
              Delete All
            </button>
          </div>
          <div className="mt-2 space-y-2">
            {sortedProposals.length === 0 && (
              <p className="text-xs text-gray-600 dark:text-slate-400">No events found.</p>
            )}
            {sortedProposals.map((proposal) => (
              <div
                key={proposal.id}
                className="flex items-center justify-between rounded-md border border-gray-200 bg-gray-50 p-2 dark:border-slate-700 dark:bg-slate-950"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-slate-100">
                    {proposal.emoji} {proposal.title}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-slate-400">
                    {proposal.specifics?.date || 'No date'} {proposal.specifics?.time || ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteProposal(proposal.id, proposal.title)}
                  className="rounded border border-red-200 px-2 py-1 text-[11px] text-red-700 hover:bg-red-50 dark:border-red-900/60 dark:text-red-300 dark:hover:bg-red-950/20"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

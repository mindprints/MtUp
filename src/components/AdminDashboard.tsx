import { FormEvent, useMemo, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useProposals } from '@/lib/ProposalContext';
import { isSupabaseMode } from '@/lib/runtimeConfig';
import {
  buildProposalFlowEditDraft,
  formatDateRangeText,
  getProposalTimeSummary,
  normalizeTimeInputValue,
  SejourDateTimeRow,
} from '@/components/ai-assistant/shared';
import type { ActivityType, Proposal } from '@/types';
import { generateId, getAvailableEmoji } from '@/lib/utils';
import { suggestIconFromTitle } from '@/lib/iconDictionary';

type AdminDashboardProps = {
  onGoActivities: () => void;
};

type AdminProposalDraft = {
  title: string;
  type: ActivityType;
  startDate: string;
  endDate: string;
  time: string;
  startTime: string;
  endTime: string;
  place: string;
};

function buildEmptyDraft(type: ActivityType): AdminProposalDraft {
  return {
    title: '',
    type,
    startDate: '',
    endDate: '',
    time: '',
    startTime: '',
    endTime: '',
    place: '',
  };
}

function buildDraftFromProposal(proposal: Proposal): AdminProposalDraft {
  const draft = buildProposalFlowEditDraft(proposal);
  return {
    ...draft,
    type: proposal.type,
  };
}

function buildSpecificsFromDraft(draft: AdminProposalDraft): Proposal['specifics'] {
  const specifics: NonNullable<Proposal['specifics']> = {};
  const dateText = formatDateRangeText(
    draft.startDate.trim(),
    draft.type === 'sejour' ? draft.endDate.trim() : draft.startDate.trim()
  );
  const timeText = normalizeTimeInputValue(draft.time).trim();
  const startTimeText = normalizeTimeInputValue(draft.startTime).trim();
  const endTimeText = normalizeTimeInputValue(draft.endTime).trim();
  const placeText = draft.place.trim();

  if (dateText) specifics.date = dateText;
  if (draft.type === 'sejour') {
    if (startTimeText) specifics.startTime = startTimeText;
    if (endTimeText) specifics.endTime = endTimeText;
  } else if (timeText) {
    specifics.time = timeText;
  }
  if (placeText) specifics.location = placeText;

  return Object.keys(specifics).length > 0 ? specifics : undefined;
}

function ProposalDraftFields({
  draft,
  onChange,
}: {
  draft: AdminProposalDraft;
  onChange: (key: keyof AdminProposalDraft, value: string) => void;
}) {
  const inputClassName =
    'w-full rounded border border-gray-300 px-2 py-1.5 text-xs text-gray-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:[color-scheme:dark]';
  const labelClassName = 'text-[11px] font-medium uppercase tracking-wide text-gray-700 dark:text-slate-300';

  return (
    <>
      <input
        type="text"
        value={draft.title}
        onChange={(event) => onChange('title', event.target.value)}
        placeholder="Title"
        className={inputClassName}
      />

      <div className="grid grid-cols-2 gap-2 rounded-md border border-gray-200 p-1 dark:border-slate-700">
        <button
          type="button"
          onClick={() => onChange('type', 'event')}
          className={`rounded px-2.5 py-1.5 text-xs font-medium ${
            draft.type === 'event'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-50 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'
          }`}
        >
          Event
        </button>
        <button
          type="button"
          onClick={() => onChange('type', 'sejour')}
          className={`rounded px-2.5 py-1.5 text-xs font-medium ${
            draft.type === 'sejour'
              ? 'bg-teal-600 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-50 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'
          }`}
        >
          Sejour
        </button>
      </div>

      {draft.type === 'sejour' ? (
        <SejourDateTimeRow
          startDate={draft.startDate}
          endDate={draft.endDate}
          startTime={draft.startTime}
          endTime={draft.endTime}
          onStartDateChange={(value) => onChange('startDate', value)}
          onEndDateChange={(value) => onChange('endDate', value)}
          onStartTimeChange={(value) => onChange('startTime', value)}
          onEndTimeChange={(value) => onChange('endTime', value)}
          startDateLabel="Start Date"
          startTimeLabel="Start Time"
          endDateLabel="End Date"
          endTimeLabel="End Time"
          startDateAriaLabel="Admin proposal start date"
          startTimeAriaLabel="Admin proposal start time"
          endDateAriaLabel="Admin proposal end date"
          endTimeAriaLabel="Admin proposal end time"
          dateInputClassName={inputClassName}
          timeSelectClassName={inputClassName}
          labelClassName={labelClassName}
          separatorClassName="text-[11px] font-semibold text-gray-400 dark:text-slate-500"
        />
      ) : (
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          <label className={labelClassName}>
            <span className="mb-1 block">Date</span>
            <input
              type="date"
              value={draft.startDate}
              onChange={(event) => onChange('startDate', event.target.value)}
              className={inputClassName}
            />
          </label>
          <label className={labelClassName}>
            <span className="mb-1 block">Time</span>
            <input
              type="time"
              value={draft.time}
              onChange={(event) => onChange('time', event.target.value)}
              className={inputClassName}
            />
          </label>
        </div>
      )}

      <label className={labelClassName}>
        <span className="mb-1 block">Place</span>
        <input
          type="text"
          value={draft.place}
          onChange={(event) => onChange('place', event.target.value)}
          placeholder="Location"
          className={inputClassName}
        />
      </label>
    </>
  );
}

export function AdminDashboard({ onGoActivities }: AdminDashboardProps) {
  const { user } = useAuth();
  const {
    groupUsers,
    proposals,
    addProposal,
    updateProposal,
    deleteProposal,
    addMember,
    setMemberAdmin,
    renameMember,
    removeMember,
    seedMockActivities,
  } = useProposals();
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberPassword, setNewMemberPassword] = useState('password');
  const [newMemberIsAdmin, setNewMemberIsAdmin] = useState(false);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [memberNameDraft, setMemberNameDraft] = useState('');
  const [createDraft, setCreateDraft] = useState<AdminProposalDraft>(() => buildEmptyDraft('event'));
  const [editingProposalId, setEditingProposalId] = useState<string | null>(null);
  const [editDrafts, setEditDrafts] = useState<Record<string, AdminProposalDraft>>({});

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
      email: newMemberEmail,
      password: newMemberPassword,
      isAdmin: newMemberIsAdmin,
    });
    setStatusMessage(result.message || (result.ok ? 'Member added.' : 'Failed to add member.'));
    if (result.ok) {
      setNewMemberName('');
      setNewMemberEmail('');
      setNewMemberPassword('password');
      setNewMemberIsAdmin(false);
    }
  };

  const handleToggleAdmin = async (memberId: string, isAdmin: boolean) => {
    const result = await setMemberAdmin(memberId, !isAdmin);
    setStatusMessage(
      result.message || (result.ok ? 'Member role updated.' : 'Failed to update member role.')
    );
  };

  const handleStartMemberEdit = (memberId: string, currentName: string) => {
    setEditingMemberId(memberId);
    setMemberNameDraft(currentName);
  };

  const handleSaveMemberEdit = async (memberId: string) => {
    const result = await renameMember(memberId, memberNameDraft);
    setStatusMessage(result.message || (result.ok ? 'Member updated.' : 'Failed to update member.'));
    if (result.ok) {
      setEditingMemberId(null);
      setMemberNameDraft('');
    }
  };

  const handleRemoveMember = async (memberId: string, memberName: string) => {
    if (!window.confirm(`Remove ${memberName} from members?`)) return;
    const result = await removeMember(memberId);
    setStatusMessage(result.message || (result.ok ? 'Member removed.' : 'Failed to remove member.'));
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

  const handleSeedMockActivities = async () => {
    const result = await seedMockActivities();
    setStatusMessage(
      result.message || (result.ok ? 'Mock activities added.' : 'Failed to add mock activities.')
    );
  };

  const updateCreateDraft = (key: keyof AdminProposalDraft, value: string) => {
    setCreateDraft((prev) => {
      const next = {
        ...prev,
        [key]:
          key === 'time' || key === 'startTime' || key === 'endTime'
            ? normalizeTimeInputValue(value)
            : value,
      };
      if (key === 'type' && value === 'event') {
        next.endDate = next.startDate;
        next.startTime = '';
        next.endTime = '';
      }
      if (key === 'type' && value === 'sejour') {
        next.time = '';
      }
      return next;
    });
  };

  const updateEditDraft = (proposalId: string, key: keyof AdminProposalDraft, value: string) => {
    setEditDrafts((prev) => {
      const current = prev[proposalId] || buildEmptyDraft('event');
      const next = {
        ...current,
        [key]:
          key === 'time' || key === 'startTime' || key === 'endTime'
            ? normalizeTimeInputValue(value)
            : value,
      };
      if (key === 'type' && value === 'event') {
        next.endDate = next.startDate;
        next.startTime = '';
        next.endTime = '';
      }
      if (key === 'type' && value === 'sejour') {
        next.time = '';
      }
      return {
        ...prev,
        [proposalId]: next,
      };
    });
  };

  const handleCreateProposal = () => {
    const title = createDraft.title.trim();
    if (!title) {
      setStatusMessage('Proposal title is required.');
      return;
    }
    const usedEmojis = proposals.map((proposal) => proposal.emoji);
    const emoji = suggestIconFromTitle(title) || getAvailableEmoji(usedEmojis);
    const newProposal: Proposal = {
      id: generateId(),
      title,
      type: createDraft.type,
      emoji,
      createdBy: user.id,
      authoredBy: user.id,
      createdAt: new Date().toISOString(),
      status: 'proposed',
      specifics: buildSpecificsFromDraft(createDraft),
      comments: [],
    };
    addProposal(newProposal);
    setCreateDraft(buildEmptyDraft('event'));
    setStatusMessage('Proposal created.');
  };

  const handleStartEdit = (proposal: Proposal) => {
    setEditingProposalId(proposal.id);
    setEditDrafts((prev) => ({
      ...prev,
      [proposal.id]: buildDraftFromProposal(proposal),
    }));
  };

  const handleCancelEdit = () => {
    setEditingProposalId(null);
  };

  const handleSaveEdit = async (proposal: Proposal) => {
    const draft = editDrafts[proposal.id];
    if (!draft || !draft.title.trim()) {
      setStatusMessage('Proposal title is required.');
      return;
    }
    await updateProposal(proposal.id, {
      title: draft.title.trim(),
      type: draft.type,
      specifics: buildSpecificsFromDraft(draft),
    });
    setEditingProposalId(null);
    setStatusMessage('Proposal updated.');
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
                className="flex flex-col items-start gap-2 rounded-md border border-gray-200 bg-gray-50 p-2 dark:border-slate-700 dark:bg-slate-950 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  {editingMemberId === member.id ? (
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={memberNameDraft}
                        onChange={(event) => setMemberNameDraft(event.target.value)}
                        className="w-full rounded border border-gray-300 px-2 py-1.5 text-xs text-gray-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                      />
                      <p className="break-all text-xs text-gray-500 dark:text-slate-400">
                        {member.email || 'Email unavailable'}
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-slate-100">
                        {member.name}
                        {member.id === user.id ? ' (You)' : ''}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-slate-400">
                        {member.isAdmin ? 'Admin' : 'Member'}
                      </p>
                      <p className="break-all text-xs text-gray-500 dark:text-slate-400">
                        {member.email || 'Email unavailable'}
                      </p>
                    </div>
                  )}
                </div>
                <div className="flex w-full flex-wrap items-center gap-1.5 sm:w-auto sm:justify-end">
                  {editingMemberId === member.id ? (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingMemberId(null);
                          setMemberNameDraft('');
                        }}
                        className="rounded border border-gray-300 px-2 py-1 text-[11px] text-gray-700 hover:bg-white dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-900"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleSaveMemberEdit(member.id)}
                        className="rounded bg-blue-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-blue-700"
                      >
                        Save
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleStartMemberEdit(member.id, member.name)}
                      className="rounded border border-gray-300 px-2 py-1 text-[11px] text-gray-700 hover:bg-white dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-900"
                    >
                      Edit
                    </button>
                  )}
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
              type="email"
              value={newMemberEmail}
              onChange={(event) => setNewMemberEmail(event.target.value)}
              placeholder="Email"
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
                Supabase mode sends the invite and login flow to the email you enter here.
              </p>
            )}
          </form>
        </section>

        <section className="rounded-lg bg-white p-3 dark:border dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-700 dark:text-slate-300">
              Proposals
            </h2>
            <p className="text-[11px] text-gray-500 dark:text-slate-400">
              Full admin create, edit, and delete
            </p>
          </div>
          <div className="mt-2 space-y-2 rounded-md border border-gray-200 bg-gray-50 p-2 dark:border-slate-700 dark:bg-slate-950">
            <ProposalDraftFields draft={createDraft} onChange={updateCreateDraft} />
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => void handleSeedMockActivities()}
                className="rounded border border-gray-300 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-white dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-900"
              >
                Seed Mock Activities
              </button>
              <button
                type="button"
                onClick={handleCreateProposal}
                className="rounded bg-blue-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
              >
                Create Proposal
              </button>
            </div>
          </div>
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
                className="rounded-md border border-gray-200 bg-gray-50 p-2 dark:border-slate-700 dark:bg-slate-950"
              >
                {editingProposalId === proposal.id ? (
                  <div className="space-y-2">
                    <ProposalDraftFields
                      draft={editDrafts[proposal.id] || buildDraftFromProposal(proposal)}
                      onChange={(key, value) => updateEditDraft(proposal.id, key, value)}
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={handleCancelEdit}
                        className="rounded border border-gray-300 px-2 py-1 text-[11px] text-gray-700 hover:bg-white dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-900"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleSaveEdit(proposal)}
                        className="rounded bg-blue-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-blue-700"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteProposal(proposal.id, proposal.title)}
                        className="rounded border border-red-200 px-2 py-1 text-[11px] text-red-700 hover:bg-red-50 dark:border-red-900/60 dark:text-red-300 dark:hover:bg-red-950/20"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-slate-100">
                        {proposal.emoji} {proposal.title}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-slate-400">
                        {proposal.specifics?.date || 'No date'} {getProposalTimeSummary(proposal)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleStartEdit(proposal)}
                        className="rounded border border-gray-300 px-2 py-1 text-[11px] text-gray-700 hover:bg-white dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-900"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteProposal(proposal.id, proposal.title)}
                        className="rounded border border-red-200 px-2 py-1 text-[11px] text-red-700 hover:bg-red-50 dark:border-red-900/60 dark:text-red-300 dark:hover:bg-red-950/20"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

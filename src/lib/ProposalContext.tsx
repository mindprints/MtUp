import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import type {
  AppData,
  Proposal,
  Availability,
  DecisionDimension,
  ProposalDecisionConfig,
  DecisionOption,
  DecisionVote,
  DecisionConfirmation,
  GroupSummary,
  ProposalContribution,
} from '@/types';
import { storage } from '@/lib/storage';
import { isSupabaseMode } from '@/lib/runtimeConfig';
import { getSupabaseClient, getSupabaseEnv } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { proposalThreadStore } from '@/lib/proposalThreadStore';
import { generateId } from '@/lib/utils';
import { buildMockResolverActivities } from '@/lib/mockResolverActivities';

type ProposalContextType = {
  groups: GroupSummary[];
  activeGroupId: string | null;
  groupUsers: {
    id: string;
    name: string;
    email?: string;
    isAdmin: boolean;
  }[];
  setActiveGroupId: (groupId: string | null) => void;
  proposals: Proposal[];
  availabilities: Availability[];
  decisionConfigs: ProposalDecisionConfig[];
  decisionOptions: DecisionOption[];
  decisionVotes: DecisionVote[];
  decisionConfirmations: DecisionConfirmation[];
  addProposal: (proposal: Proposal) => void;
  updateProposal: (proposalId: string, updates: Partial<Proposal>) => Promise<void>;
  deleteProposal: (proposalId: string) => void;
  setAvailability: (availability: Availability) => void;
  getAvailability: (userId: string, proposalId: string) => Availability | null;
  getProposalAvailabilities: (proposalId: string) => Availability[];
  getUserAvailabilities: (userId: string) => Availability[];
  deleteAvailability: (userId: string, proposalId: string) => void;
  getDecisionConfig: (
    proposalId: string,
    dimension: DecisionDimension
  ) => ProposalDecisionConfig | null;
  setDecisionConfig: (config: ProposalDecisionConfig) => void;
  getDecisionOptions: (
    proposalId: string,
    dimension: DecisionDimension
  ) => DecisionOption[];
  addDecisionOption: (option: DecisionOption) => void;
  deleteDecisionOption: (optionId: string) => void;
  getDecisionVotes: (
    proposalId: string,
    dimension: DecisionDimension
  ) => DecisionVote[];
  setDecisionVote: (vote: DecisionVote) => void;
  deleteDecisionVote: (
    userId: string,
    proposalId: string,
    dimension: DecisionDimension
  ) => void;
  addDecisionConfirmation: (confirmation: DecisionConfirmation) => void;
  getDecisionConfirmations: (
    proposalId: string,
    dimension: DecisionDimension
  ) => DecisionConfirmation[];
  getVotesForProposalDimension: (
    proposalId: string,
    dimension: DecisionDimension
  ) => DecisionVote[];
  getOptionsForProposalDimension: (
    proposalId: string,
    dimension: DecisionDimension
  ) => DecisionOption[];
  addMember: (payload: {
    name: string;
    email: string;
    password: string;
    isAdmin: boolean;
  }) => Promise<{ ok: boolean; message?: string }>;
  setMemberAdmin: (
    memberId: string,
    isAdmin: boolean
  ) => Promise<{ ok: boolean; message?: string }>;
  renameMember: (memberId: string, name: string) => Promise<{ ok: boolean; message?: string }>;
  removeMember: (memberId: string) => Promise<{ ok: boolean; message?: string }>;
  seedMockActivities: () => Promise<{ ok: boolean; message?: string }>;
  addProposalContributions: (
    contributions: ProposalContribution | ProposalContribution[]
  ) => Promise<void>;
  refresh: () => void;
};

type GroupSummaryUser = {
  id: string;
  name: string;
  email?: string;
  isAdmin: boolean;
};

type GroupMemberRpcRow = {
  user_id: string;
  display_name: string | null;
  email: string | null;
  is_platform_admin: boolean | null;
  role: 'owner' | 'admin' | 'member';
};

function isMissingRpcError(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false;
  return (
    error.code === 'PGRST202' ||
    (error.message || '').toLowerCase().includes('could not find the function')
  );
}

function isAbortLikeError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;

  const maybeError = error as {
    name?: string;
    message?: string;
    details?: string;
    hint?: string;
    code?: string;
  };

  const haystack = [
    maybeError.name,
    maybeError.message,
    maybeError.details,
    maybeError.hint,
    maybeError.code,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return (
    haystack.includes('abort') ||
    haystack.includes('aborted') ||
    haystack.includes('err_aborted') ||
    haystack.includes('failed to fetch')
  );
}

function logSupabaseReadError(context: string, error: unknown): boolean {
  if (isAbortLikeError(error)) {
    return true;
  }

  console.error(context, error);
  return false;
}

function getAdminMembershipMigrationHint(): string {
  return 'Run docs/supabase/007_admin_membership_functions.sql in Supabase to enable admin membership management.';
}

export const proposalContextTestUtils = {
  isAbortLikeError,
  logSupabaseReadError,
};

const ProposalContext = createContext<ProposalContextType | undefined>(undefined);

export function ProposalProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const readCachedData = () => storage.getData();
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [activeGroupId, setActiveGroupIdState] = useState<string | null>(null);
  const [groupUsers, setGroupUsers] = useState<GroupSummaryUser[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>(() => readCachedData().proposals);
  const [availabilities, setAvailabilities] = useState<Availability[]>(() =>
    readCachedData().availabilities
  );
  const [decisionConfigs, setDecisionConfigs] = useState<ProposalDecisionConfig[]>(() =>
    readCachedData().decisionConfigs
  );
  const [decisionOptions, setDecisionOptions] = useState<DecisionOption[]>(() =>
    readCachedData().decisionOptions
  );
  const [decisionVotes, setDecisionVotes] = useState<DecisionVote[]>(() =>
    readCachedData().decisionVotes
  );
  const [decisionConfirmations, setDecisionConfirmations] = useState<DecisionConfirmation[]>(
    () => readCachedData().decisionConfirmations
  );

  type MembershipRow = {
    group_id: string;
    role: 'owner' | 'admin' | 'member';
  };

  type GroupRow = {
    id: string;
    name: string;
  };

  type ProposalRow = {
    id: string;
    group_id: string;
    title: string;
    type: 'event' | 'sejour';
    emoji: string;
    created_by: string;
    authored_by: string | null;
    created_at: string;
    status: 'proposed' | 'scheduled' | 'confirmed';
    specifics_json: Proposal['specifics'] | null;
  };

  type CommentRow = {
    id: string;
    group_id: string;
    proposal_id: string;
    user_id: string;
    text: string;
    created_at: string;
  };

  type AvailabilityRow = {
    id: string;
    user_id: string;
    proposal_id: string;
    dates_json: string[] | null;
    time_slots_json: string[] | null;
  };

  type ProposalContributionRow = {
    id: string;
    group_id: string;
    proposal_id: string;
    user_id: string;
    kind: ProposalContribution['kind'];
    field: ProposalContribution['field'] | null;
    value_json: ProposalContribution['value'] | null;
    created_at: string;
    provenance: ProposalContribution['provenance'];
  };

  const hydrateFromLocalStorage = useCallback(() => {
    const data = storage.getData();
    setGroups([]);
    setActiveGroupIdState(null);
    setGroupUsers(
      data.users.map((entry) => ({
        id: entry.id,
        name: entry.name,
        email: entry.email,
        isAdmin: entry.isAdmin,
      }))
    );
    setProposals(data.proposals);
    setAvailabilities(data.availabilities);
    setDecisionConfigs(data.decisionConfigs);
    setDecisionOptions(data.decisionOptions);
    setDecisionVotes(data.decisionVotes);
    setDecisionConfirmations(data.decisionConfirmations);
  }, []);

  const syncCachedData = useCallback((updates: Partial<AppData>) => {
    const data = storage.getData();
    storage.setData({
      ...data,
      ...updates,
    });
  }, []);

  const addProposalContributions: ProposalContextType['addProposalContributions'] = useCallback(
    async (input) => {
      const contributions = Array.isArray(input) ? input : [input];
      if (contributions.length === 0) return;

      proposalThreadStore.addMany(contributions);

      if (!isSupabaseMode() || !user) return;

      const supabase = getSupabaseClient();
      const groupIdsByProposalId = new Map<string, string>();

      proposals.forEach((proposal) => {
        if (proposal.groupId) {
          groupIdsByProposalId.set(proposal.id, proposal.groupId);
        }
      });

      const unresolvedProposalIds = Array.from(
        new Set(
          contributions
            .map((entry) => entry.proposalId)
            .filter((proposalId) => !groupIdsByProposalId.has(proposalId))
        )
      );

      if (unresolvedProposalIds.length > 0) {
        const { data: proposalRows, error } = await supabase
          .from('proposals')
          .select('id, group_id')
          .in('id', unresolvedProposalIds);

        if (error) {
          console.error('Failed to resolve proposal groups for contributions:', error);
          return;
        }

        (proposalRows || []).forEach((row) => {
          if (row?.id && row?.group_id) {
            groupIdsByProposalId.set(row.id, row.group_id);
          }
        });
      }

      const rows = contributions
        .map((entry) => {
          const groupId = groupIdsByProposalId.get(entry.proposalId) || activeGroupId;
          if (!groupId) return null;
          return {
            id: entry.id,
            group_id: groupId,
            proposal_id: entry.proposalId,
            user_id: entry.userId,
            kind: entry.kind,
            field: entry.field || null,
            value_json: entry.value,
            created_at: entry.createdAt,
            provenance: entry.provenance,
          };
        })
        .filter(Boolean);

      if (rows.length === 0) return;

      const { error } = await supabase.from('proposal_contributions').upsert(rows, {
        onConflict: 'id',
      });
      if (error) {
        console.error('Failed to persist proposal contributions:', error);
      }
    },
    [activeGroupId, proposals, user]
  );

  const refresh = useCallback(async () => {
    if (!isSupabaseMode()) {
      hydrateFromLocalStorage();
      return;
    }

    if (!user) {
      setGroups([]);
      setActiveGroupIdState(null);
      setGroupUsers([]);
      setProposals([]);
      setAvailabilities([]);
      setDecisionConfigs([]);
      setDecisionOptions([]);
      setDecisionVotes([]);
      setDecisionConfirmations([]);
      proposalThreadStore.clear();
      return;
    }

    await (async () => {
      const supabase = getSupabaseClient();
      const { data: membershipData, error: membershipError } = await supabase
        .from('group_memberships')
        .select('group_id, role')
        .eq('user_id', user.id);

      if (membershipError) {
        if (logSupabaseReadError('Failed to fetch group memberships:', membershipError)) return;
        return;
      }

      const memberships = (membershipData || []) as MembershipRow[];
      const groupIds = memberships.map((m) => m.group_id);
      if (groupIds.length === 0) {
        setGroups([]);
        setActiveGroupIdState(null);
        setGroupUsers([]);
        setProposals([]);
        proposalThreadStore.clear();
        return;
      }

      const { data: groupData, error: groupError } = await supabase
        .from('groups')
        .select('id, name')
        .in('id', groupIds);

      if (groupError) {
        if (logSupabaseReadError('Failed to fetch groups:', groupError)) return;
        return;
      }

      const groupsById = new Map<string, GroupRow>(
        ((groupData || []) as GroupRow[]).map((group) => [group.id, group])
      );

      const nextGroups: GroupSummary[] = memberships
        .map((membership) => {
          const group = groupsById.get(membership.group_id);
          if (!group) return null;
          return {
            id: group.id,
            name: group.name,
            role: membership.role,
          };
        })
        .filter((group): group is GroupSummary => Boolean(group))
        .sort((a, b) => a.name.localeCompare(b.name));

      const allowedGroupIds = new Set(nextGroups.map((group) => group.id));
      const resolvedGroupId =
        activeGroupId && allowedGroupIds.has(activeGroupId)
          ? activeGroupId
          : nextGroups[0]?.id || null;

      setGroups(nextGroups);
      setActiveGroupIdState(resolvedGroupId);

      if (!resolvedGroupId) {
        setGroupUsers([]);
        setProposals([]);
        proposalThreadStore.clear();
        return;
      }

      const { data: groupUserData, error: groupUserError } = await supabase.rpc(
        'list_group_members',
        {
          target_group_id: resolvedGroupId,
        }
      );

      if (groupUserError) {
        if (isMissingRpcError(groupUserError)) {
          console.warn(getAdminMembershipMigrationHint());
        } else if (logSupabaseReadError('Failed to fetch group members via RPC:', groupUserError)) {
          return;
        } else {
          console.error('Failed to fetch group members via RPC:', groupUserError);
        }

        const { data: memberRows, error: memberRowsError } = await supabase
          .from('group_memberships')
          .select('user_id')
          .eq('group_id', resolvedGroupId);

        if (memberRowsError) {
          if (logSupabaseReadError('Failed to fetch group members:', memberRowsError)) return;
          return;
        }

        const memberIds = Array.from(
          new Set(
            ((memberRows || []) as Array<{ user_id: string }>)
              .map((row) => row.user_id)
              .filter(Boolean)
          )
        );

        if (memberIds.length > 0) {
          const { data: memberProfiles, error: memberProfilesError } = await supabase
            .from('profiles')
            .select('id, display_name, is_platform_admin')
            .in('id', memberIds);

          if (memberProfilesError) {
            if (logSupabaseReadError('Failed to fetch member profiles:', memberProfilesError)) {
              return;
            }
            setGroupUsers(
              memberIds.map((memberId) => ({
                id: memberId,
                name: 'User',
                isAdmin: false,
              }))
            );
          } else {
            const mappedGroupUsers: GroupSummaryUser[] = memberIds.map((memberId) => {
              const profile = (memberProfiles || []).find((entry) => entry.id === memberId);
              return {
                id: memberId,
                name: profile?.display_name || 'User',
                isAdmin: Boolean(profile?.is_platform_admin),
              };
            });

            setGroupUsers(mappedGroupUsers);
          }
        } else {
          setGroupUsers([]);
        }
      } else {
        const mappedGroupUsers: GroupSummaryUser[] = ((groupUserData || []) as GroupMemberRpcRow[]).map(
          (entry) => ({
            id: entry.user_id,
            name: entry.display_name || 'User',
            email: entry.email || undefined,
            isAdmin: Boolean(entry.is_platform_admin),
          })
        );
        setGroupUsers(mappedGroupUsers);
      }

      const { data: proposalData, error: proposalError } = await supabase
        .from('proposals')
        .select(
          'id, group_id, title, type, emoji, created_by, authored_by, created_at, status, specifics_json'
        )
        .eq('group_id', resolvedGroupId)
        .order('created_at', { ascending: true });

      if (proposalError) {
        if (logSupabaseReadError('Failed to fetch proposals:', proposalError)) return;
        return;
      }

      const { data: commentData, error: commentError } = await supabase
        .from('comments')
        .select('id, group_id, proposal_id, user_id, text, created_at')
        .eq('group_id', resolvedGroupId)
        .order('created_at', { ascending: true });

      if (commentError) {
        if (logSupabaseReadError('Failed to fetch comments:', commentError)) return;
        return;
      }

      const commentsByProposalId = new Map<string, Proposal['comments']>();
      ((commentData || []) as CommentRow[]).forEach((row) => {
        const nextComments = commentsByProposalId.get(row.proposal_id) || [];
        nextComments.push({
          id: row.id,
          proposalId: row.proposal_id,
          userId: row.user_id,
          text: row.text,
          createdAt: row.created_at,
        });
        commentsByProposalId.set(row.proposal_id, nextComments);
      });

      const mappedProposals: Proposal[] = ((proposalData || []) as ProposalRow[]).map(
        (row) => ({
          id: row.id,
          groupId: row.group_id,
          title: row.title,
          type: row.type,
          emoji: row.emoji,
          createdBy: row.created_by,
          authoredBy: row.authored_by || row.created_by,
          createdAt: row.created_at,
          status: row.status,
          specifics: row.specifics_json || undefined,
          comments: commentsByProposalId.get(row.id) || [],
        })
      );

      setProposals(mappedProposals);

      const { data: availabilityData, error: availabilityError } = await supabase
        .from('availabilities')
        .select('id, user_id, proposal_id, dates_json, time_slots_json')
        .eq('group_id', resolvedGroupId);

      if (availabilityError) {
        if (logSupabaseReadError('Failed to fetch availabilities:', availabilityError)) return;
        return;
      }

      const mappedAvailabilities: Availability[] = (
        (availabilityData || []) as AvailabilityRow[]
      ).map((row) => ({
        id: row.id,
        userId: row.user_id,
        proposalId: row.proposal_id,
        dates: row.dates_json || [],
        timeSlots: row.time_slots_json || undefined,
      }));

      setAvailabilities(mappedAvailabilities);

      const { data: contributionData, error: contributionError } = await supabase
        .from('proposal_contributions')
        .select('id, group_id, proposal_id, user_id, kind, field, value_json, created_at, provenance')
        .eq('group_id', resolvedGroupId)
        .order('created_at', { ascending: true });

      if (contributionError) {
        if (logSupabaseReadError('Failed to fetch proposal contributions:', contributionError)) {
          return;
        }
      } else {
        const mappedContributions: ProposalContribution[] = (
          (contributionData || []) as ProposalContributionRow[]
        ).map((row) => ({
          id: row.id,
          proposalId: row.proposal_id,
          userId: row.user_id,
          kind: row.kind,
          ...(row.field ? { field: row.field } : {}),
          value: row.value_json || {},
          createdAt: row.created_at,
          provenance: row.provenance,
        }));
        proposalThreadStore.replaceAll(mappedContributions);
      }

      // Keep existing local-backed Stage 2 entities while incremental migration is in progress.
      const localData = storage.getData();
      setDecisionConfigs(localData.decisionConfigs);
      setDecisionOptions(localData.decisionOptions);
      setDecisionVotes(localData.decisionVotes);
      setDecisionConfirmations(localData.decisionConfirmations);
      syncCachedData({
        proposals: mappedProposals,
        availabilities: mappedAvailabilities,
        decisionConfigs: localData.decisionConfigs,
        decisionOptions: localData.decisionOptions,
        decisionVotes: localData.decisionVotes,
        decisionConfirmations: localData.decisionConfirmations,
      });
    })();
  }, [activeGroupId, hydrateFromLocalStorage, syncCachedData, user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addProposal = (proposal: Proposal) => {
    const normalizedProposal: Proposal = {
      ...proposal,
      authoredBy: proposal.authoredBy || proposal.createdBy,
    };

    if (isSupabaseMode() && user) {
      void (async () => {
        const supabase = getSupabaseClient();
        let targetGroupId = activeGroupId || groups[0]?.id || null;

        // Handle creation attempts before initial group context has resolved.
        if (!targetGroupId) {
          const { data: membershipRows, error: membershipLookupError } = await supabase
            .from('group_memberships')
            .select('group_id')
            .eq('user_id', user.id)
            .limit(1);

          if (membershipLookupError) {
            console.error('Cannot resolve group for proposal creation:', membershipLookupError);
            return;
          }

          targetGroupId = membershipRows?.[0]?.group_id || null;
        }

        if (!targetGroupId) {
          console.error('Cannot create proposal: no active group available.');
          return;
        }

        const { error } = await supabase.from('proposals').insert({
          id: normalizedProposal.id,
          group_id: targetGroupId,
          title: normalizedProposal.title,
          type: normalizedProposal.type,
          emoji: normalizedProposal.emoji,
          created_by:
            normalizedProposal.createdBy === user.id ? normalizedProposal.createdBy : user.id,
          authored_by: normalizedProposal.authoredBy,
          created_at: normalizedProposal.createdAt,
          status: normalizedProposal.status,
          specifics_json: normalizedProposal.specifics || null,
        });
        if (error) {
          console.error('Failed to create proposal:', error);
          refresh();
          return;
        }
        if ((normalizedProposal.comments || []).length > 0) {
          const { error: commentsError } = await supabase.from('comments').insert(
            (normalizedProposal.comments || []).map((comment) => ({
              id: comment.id,
              group_id: targetGroupId,
              proposal_id: normalizedProposal.id,
              user_id: comment.userId,
              text: comment.text,
              created_at: comment.createdAt,
            }))
          );
          if (commentsError) {
            console.error('Failed to create proposal comments:', commentsError);
          }
        }
        if (!activeGroupId) {
          setActiveGroupIdState(targetGroupId);
        }
        ensureProposerAvailabilityForEventDate({
          proposal: normalizedProposal,
          groupId: targetGroupId,
        });
        refresh();
      })();
      return;
    }

    storage.addProposal(normalizedProposal);
    ensureProposerAvailabilityForEventDate({ proposal: normalizedProposal });
    refresh();
  };

  const updateProposal = async (proposalId: string, updates: Partial<Proposal>) => {
    if (isSupabaseMode() && user) {
      await (async () => {
        const supabase = getSupabaseClient();
        const payload: Record<string, unknown> = {};
        let wroteComments = false;
        if (updates.title !== undefined) payload.title = updates.title;
        if (updates.type !== undefined) payload.type = updates.type;
        if (updates.emoji !== undefined) payload.emoji = updates.emoji;
        if (updates.status !== undefined) payload.status = updates.status;
        if (updates.specifics !== undefined) {
          payload.specifics_json = updates.specifics;
        }
        if (updates.comments !== undefined) {
          const targetGroupId = activeGroupId || proposals.find((entry) => entry.id === proposalId)?.groupId || null;
          if (targetGroupId) {
            const { error: commentsError } = await supabase.from('comments').upsert(
              updates.comments.map((comment) => ({
                id: comment.id,
                group_id: targetGroupId,
                proposal_id: proposalId,
                user_id: comment.userId,
                text: comment.text,
                created_at: comment.createdAt,
              })),
              { onConflict: 'id' }
            );
            if (commentsError) {
              console.error('Failed to update proposal comments:', commentsError);
              return;
            }
            wroteComments = true;
          }
        }
        if (Object.keys(payload).length > 0) {
          const { error } = await supabase
            .from('proposals')
            .update(payload)
            .eq('id', proposalId);
          if (error) {
            console.error('Failed to update proposal:', error);
            return;
          }
        }
        if (Object.keys(payload).length === 0 && !wroteComments) return;
        const existingProposal = proposals.find((entry) => entry.id === proposalId);
        if (existingProposal) {
          ensureProposerAvailabilityForEventDate({
            proposal: {
              ...existingProposal,
              ...updates,
              specifics:
                updates.specifics !== undefined
                  ? updates.specifics
                  : existingProposal.specifics,
            },
            groupId: activeGroupId || existingProposal.groupId || null,
          });
        }
        await refresh();
      })();
      return;
    }

    storage.updateProposal(proposalId, updates);
    {
      const existingProposal = proposals.find((entry) => entry.id === proposalId);
      if (existingProposal) {
        ensureProposerAvailabilityForEventDate({
          proposal: {
            ...existingProposal,
            ...updates,
            specifics:
              updates.specifics !== undefined
                ? updates.specifics
                : existingProposal.specifics,
          },
        });
      }
    }
    await refresh();
  };

  const deleteProposal = (proposalId: string) => {
    if (isSupabaseMode() && user) {
      void (async () => {
        const supabase = getSupabaseClient();
        const { error } = await supabase.from('proposals').delete().eq('id', proposalId);
        if (error) {
          console.error('Failed to delete proposal:', error);
          return;
        }
        refresh();
      })();
      return;
    }

    storage.deleteProposal(proposalId);
    refresh();
  };

  const addMember: ProposalContextType['addMember'] = async (payload) => {
    const trimmedName = payload.name.trim();
    if (!trimmedName) {
      return { ok: false, message: 'Member name is required.' };
    }
    const trimmedEmail = payload.email.trim().toLowerCase();
    if (!trimmedEmail) {
      return { ok: false, message: 'Member email is required.' };
    }
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(trimmedEmail)) {
      return { ok: false, message: 'Enter a valid email address.' };
    }
    const normalizedPassword = payload.password.trim() || 'password';

    if (isSupabaseMode() && user) {
      if (!activeGroupId) {
        return { ok: false, message: 'No active group selected.' };
      }

      const normalizedName = trimmedName.toLowerCase();
      const duplicateMember = groupUsers.find((entry) => entry.name.trim().toLowerCase() === normalizedName);
      if (duplicateMember) {
        return { ok: false, message: 'Member name already exists in this group.' };
      }

      const duplicateEmail = groupUsers.find(
        (entry) => entry.email?.trim().toLowerCase() === trimmedEmail
      );
      if (duplicateEmail) {
        return { ok: false, message: 'Member email already exists in this group.' };
      }

      const { url, anonKey } = getSupabaseEnv();
      const response = await fetch(`${url}/auth/v1/signup`, {
        method: 'POST',
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: trimmedEmail,
          password: normalizedPassword,
        }),
      });

      const payloadText = await response.text();
      let signupPayload:
        | {
            id?: string | null;
            user?: { id?: string | null } | null;
            msg?: string;
            error_code?: string;
            code?: number;
          }
        | undefined;
      try {
        signupPayload = payloadText ? JSON.parse(payloadText) : undefined;
      } catch {
        signupPayload = undefined;
      }

      const createdUserId = signupPayload?.user?.id || signupPayload?.id || null;

      if (!response.ok || !createdUserId) {
        console.error('Failed to create auth user:', response.status, payloadText);
        if (signupPayload?.error_code === 'over_email_send_rate_limit') {
          return {
            ok: false,
            message: 'Supabase email send rate limit exceeded. Wait a bit, then try again.',
          };
        }
        return { ok: false, message: 'Failed to create auth user.' };
      }

      const supabase = getSupabaseClient();
      const { error: provisionError } = await supabase.rpc('admin_provision_group_member', {
        target_group_id: activeGroupId,
        target_user_id: createdUserId,
        target_display_name: trimmedName,
        target_is_admin: payload.isAdmin,
      });

      if (provisionError) {
        console.error('Failed to provision group member:', provisionError);
        if (isMissingRpcError(provisionError)) {
          return { ok: false, message: getAdminMembershipMigrationHint() };
        }
        return {
          ok: false,
          message: 'Auth user created, but group member provisioning failed.',
        };
      }

      await refresh();
      const requiresEmailConfirmation = Boolean(
        signupPayload &&
          'confirmation_sent_at' in signupPayload &&
          (signupPayload as { confirmation_sent_at?: string | null }).confirmation_sent_at
      );
      return {
        ok: true,
        message: requiresEmailConfirmation
          ? `Member added. Confirmation email sent to ${trimmedEmail}. Password login will work after confirmation.`
          : `Member added. Login email: ${trimmedEmail}`,
      };
    }

    const existing = storage
      .getData()
      .users.find((entry) => entry.name.toLowerCase() === trimmedName.toLowerCase());
    if (existing) {
      return { ok: false, message: 'Member name already exists.' };
    }
    const existingEmail = storage
      .getData()
      .users.find((entry) => entry.email?.toLowerCase() === trimmedEmail);
    if (existingEmail) {
      return { ok: false, message: 'Member email already exists.' };
    }

    storage.addUser({
      id: generateId(),
      name: trimmedName,
      email: trimmedEmail,
      password: normalizedPassword,
      isAdmin: payload.isAdmin,
    });
    refresh();
    return { ok: true };
  };

  const setMemberAdmin: ProposalContextType['setMemberAdmin'] = async (memberId, isAdmin) => {
    if (isSupabaseMode() && user) {
      if (!activeGroupId) {
        return { ok: false, message: 'No active group selected.' };
      }
      const supabase = getSupabaseClient();
      const { error } = await supabase.rpc('admin_set_group_member_admin', {
        target_group_id: activeGroupId,
        target_user_id: memberId,
        target_is_admin: isAdmin,
      });
      if (error) {
        console.error('Failed to update member admin flag:', error);
        if (isMissingRpcError(error)) {
          return { ok: false, message: getAdminMembershipMigrationHint() };
        }
        return { ok: false, message: 'Failed to update admin role.' };
      }
      refresh();
      return { ok: true };
    }

    storage.updateUser(memberId, { isAdmin });
    refresh();
    return { ok: true };
  };

  const renameMember: ProposalContextType['renameMember'] = async (memberId, name) => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      return { ok: false, message: 'Member name is required.' };
    }

    if (isSupabaseMode() && user) {
      if (!activeGroupId) {
        return { ok: false, message: 'No active group selected.' };
      }
      const supabase = getSupabaseClient();
      const { error } = await supabase.rpc('admin_rename_group_member', {
        target_group_id: activeGroupId,
        target_user_id: memberId,
        target_display_name: trimmedName,
      });
      if (error) {
        console.error('Failed to rename member:', error);
        if (isMissingRpcError(error)) {
          return { ok: false, message: getAdminMembershipMigrationHint() };
        }
        return { ok: false, message: 'Failed to update member name.' };
      }
      await refresh();
      return { ok: true, message: 'Member updated.' };
    }

    storage.updateUser(memberId, { name: trimmedName });
    refresh();
    return { ok: true, message: 'Member updated.' };
  };

  const removeMember: ProposalContextType['removeMember'] = async (memberId) => {
    if (user?.id === memberId) {
      return { ok: false, message: 'You cannot remove your own account.' };
    }

    if (isSupabaseMode() && user) {
      if (!activeGroupId) {
        return { ok: false, message: 'No active group selected.' };
      }
      const supabase = getSupabaseClient();
      const { error } = await supabase.rpc('admin_remove_group_member', {
        target_group_id: activeGroupId,
        target_user_id: memberId,
      });
      if (error) {
        console.error('Failed to remove group member:', error);
        if (isMissingRpcError(error)) {
          return { ok: false, message: getAdminMembershipMigrationHint() };
        }
        return { ok: false, message: 'Failed to remove member from group.' };
      }
      refresh();
      return { ok: true };
    }

    storage.deleteUser(memberId);
    refresh();
    return { ok: true };
  };

  const seedMockActivities: ProposalContextType['seedMockActivities'] = async () => {
    if (!user) {
      return { ok: false, message: 'You must be signed in.' };
    }

    if (groupUsers.length === 0) {
      return { ok: false, message: 'No group members available for mock approvals.' };
    }

    const { proposals: mockProposals, availabilities: mockAvailabilities } = buildMockResolverActivities({
      activeGroupId,
      currentUserId: user.id,
      groupUsers,
      existingEmojis: proposals.map((proposal) => proposal.emoji),
    });

    if (isSupabaseMode()) {
      if (!activeGroupId) {
        return { ok: false, message: 'No active group selected.' };
      }
      const supabase = getSupabaseClient();
      const { error: proposalError } = await supabase.from('proposals').insert(
        mockProposals.map((proposal) => ({
          id: proposal.id,
          group_id: activeGroupId,
          title: proposal.title,
          type: proposal.type,
          emoji: proposal.emoji,
          created_by: user.id,
          authored_by: proposal.authoredBy || user.id,
          created_at: proposal.createdAt,
          status: proposal.status,
          specifics_json: proposal.specifics || null,
        }))
      );

      if (proposalError) {
        console.error('Failed to seed mock proposals:', proposalError);
        return { ok: false, message: 'Failed to create mock activities.' };
      }

      const availabilitySeedRows = mockAvailabilities.map((availability) => ({
        id: availability.id,
        user_id: availability.userId,
        proposal_id: availability.proposalId,
        dates: availability.dates,
        ...(availability.timeSlots ? { time_slots: availability.timeSlots } : {}),
      }));
      const { error: availabilityError } = await supabase.rpc('admin_seed_group_availabilities', {
        target_group_id: activeGroupId,
        rows_json: availabilitySeedRows,
      });

      if (availabilityError) {
        console.error('Failed to seed mock availabilities:', availabilityError);
        const message = availabilityError.message?.includes('admin_seed_group_availabilities')
          ? 'Mock activities were created, but approvals need Supabase migration 009.'
          : 'Mock activities were created, but approvals failed.';
        return { ok: false, message };
      }

      await refresh();
      return {
        ok: true,
        message: `Added ${mockProposals.length} mock activities with randomized approvals.`,
      };
    }

    mockProposals.forEach((proposal) => storage.addProposal(proposal));
    mockAvailabilities.forEach((availability) => storage.setAvailability(availability));
    refresh();
    return {
      ok: true,
      message: `Added ${mockProposals.length} mock activities with randomized approvals.`,
    };
  };

  const setAvailabilityWrapper = (availability: Availability) => {
    if (isSupabaseMode() && user && activeGroupId) {
      setAvailabilities((previous) => {
        const withoutTarget = previous.filter(
          (item) =>
            !(
              item.userId === availability.userId &&
              item.proposalId === availability.proposalId
            )
        );
        if (availability.dates.length === 0) {
          return withoutTarget;
        }
        return [...withoutTarget, availability];
      });

      void (async () => {
        const supabase = getSupabaseClient();
        const { error } =
          availability.dates.length === 0
            ? await supabase
              .from('availabilities')
              .delete()
              .eq('user_id', availability.userId)
              .eq('proposal_id', availability.proposalId)
            : await supabase.from('availabilities').upsert(
              {
                id: availability.id,
                group_id: activeGroupId,
                user_id: availability.userId,
                proposal_id: availability.proposalId,
                dates_json: availability.dates,
                time_slots_json: availability.timeSlots || null,
                updated_at: new Date().toISOString(),
              },
              { onConflict: 'user_id,proposal_id' }
            );
        if (error) {
          console.error('Failed to upsert availability:', error);
          refresh();
          return;
        }
        refresh();
      })();
      return;
    }

    storage.setAvailability(availability);
    refresh();
  };

  function ensureProposerAvailabilityForEventDate({
    proposal,
    groupId,
  }: {
    proposal: Proposal;
    groupId?: string | null;
  }) {
    if (proposal.type !== 'event') return;
    const dateValue = proposal.specifics?.date;
    if (!dateValue || dateValue.includes(' to ')) return;
    const userIdForAvailability = proposal.createdBy;
    if (!userIdForAvailability) return;

    const current = availabilities.find(
      (entry) => entry.userId === userIdForAvailability && entry.proposalId === proposal.id
    );
    if (current?.dates.includes(dateValue)) return;

    const nextDates = Array.from(new Set([...(current?.dates || []), dateValue])).sort();
    const availability: Availability = {
      id: current?.id || generateId(),
      userId: userIdForAvailability,
      proposalId: proposal.id,
      dates: nextDates,
      timeSlots: current?.timeSlots,
    };

    if (isSupabaseMode() && user) {
      const resolvedGroupId = groupId || activeGroupId;
      if (!resolvedGroupId) return;
      setAvailabilities((previous) => {
        const withoutTarget = previous.filter(
          (entry) =>
            !(entry.userId === availability.userId && entry.proposalId === availability.proposalId)
        );
        return [...withoutTarget, availability];
      });

      void (async () => {
        const supabase = getSupabaseClient();
        const { error } = await supabase.from('availabilities').upsert(
          {
            id: availability.id,
            group_id: resolvedGroupId,
            user_id: availability.userId,
            proposal_id: availability.proposalId,
            dates_json: availability.dates,
            time_slots_json: availability.timeSlots || null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,proposal_id' }
        );
        if (error) {
          console.error('Failed to auto-set proposer availability:', error);
          refresh();
        }
      })();
      return;
    }

    storage.setAvailability(availability);
  }

  const getAvailability = (userId: string, proposalId: string) => {
    if (isSupabaseMode()) {
      return (
        availabilities.find(
          (a) => a.userId === userId && a.proposalId === proposalId
        ) || null
      );
    }
    return storage.getAvailability(userId, proposalId);
  };

  const getProposalAvailabilities = (proposalId: string) => {
    if (isSupabaseMode()) {
      return availabilities.filter((a) => a.proposalId === proposalId);
    }
    return storage.getProposalAvailabilities(proposalId);
  };

  const getUserAvailabilities = (userId: string) => {
    if (isSupabaseMode()) {
      return availabilities.filter((a) => a.userId === userId);
    }
    return storage.getUserAvailabilities(userId);
  };

  const deleteAvailability = (userId: string, proposalId: string) => {
    if (isSupabaseMode() && user) {
      void (async () => {
        const supabase = getSupabaseClient();
        const { error } = await supabase
          .from('availabilities')
          .delete()
          .eq('user_id', userId)
          .eq('proposal_id', proposalId);
        if (error) {
          console.error('Failed to delete availability:', error);
          return;
        }
        refresh();
      })();
      return;
    }

    storage.deleteAvailability(userId, proposalId);
    refresh();
  };

  const getDecisionConfig = (proposalId: string, dimension: DecisionDimension) => {
    return storage.getDecisionConfig(proposalId, dimension);
  };

  const setDecisionConfig = (config: ProposalDecisionConfig) => {
    storage.setDecisionConfig(config);
    refresh();
  };

  const getDecisionOptions = (proposalId: string, dimension: DecisionDimension) => {
    return storage.getDecisionOptions(proposalId, dimension);
  };

  const addDecisionOption = (option: DecisionOption) => {
    storage.addDecisionOption(option);
    refresh();
  };

  const deleteDecisionOption = (optionId: string) => {
    storage.deleteDecisionOption(optionId);
    refresh();
  };

  const getDecisionVotes = (proposalId: string, dimension: DecisionDimension) => {
    return storage.getDecisionVotes(proposalId, dimension);
  };

  const setDecisionVote = (vote: DecisionVote) => {
    storage.setDecisionVote(vote);
    refresh();
  };

  const deleteDecisionVote = (
    userId: string,
    proposalId: string,
    dimension: DecisionDimension
  ) => {
    storage.deleteDecisionVote(userId, proposalId, dimension);
    refresh();
  };

  const addDecisionConfirmation = (confirmation: DecisionConfirmation) => {
    storage.addDecisionConfirmation(confirmation);
    refresh();
  };

  const getDecisionConfirmations = (
    proposalId: string,
    dimension: DecisionDimension
  ) => {
    return storage.getDecisionConfirmations(proposalId, dimension);
  };

  const getVotesForProposalDimension = (
    proposalId: string,
    dimension: DecisionDimension
  ) => {
    return decisionVotes.filter(
      (vote) => vote.proposalId === proposalId && vote.dimension === dimension
    );
  };

  const getOptionsForProposalDimension = (
    proposalId: string,
    dimension: DecisionDimension
  ) => {
    return decisionOptions.filter(
      (option) =>
        option.proposalId === proposalId && option.dimension === dimension
    );
  };

  return (
    <ProposalContext.Provider
      value={{
        groups,
        activeGroupId,
        groupUsers,
        setActiveGroupId: (groupId) => setActiveGroupIdState(groupId),
        proposals,
        availabilities,
        decisionConfigs,
        decisionOptions,
        decisionVotes,
        decisionConfirmations,
        addProposal,
        updateProposal,
        deleteProposal,
        setAvailability: setAvailabilityWrapper,
        getAvailability,
        getProposalAvailabilities,
        getUserAvailabilities,
        deleteAvailability,
        getDecisionConfig,
        setDecisionConfig,
        getDecisionOptions,
        addDecisionOption,
        deleteDecisionOption,
        getDecisionVotes,
        setDecisionVote,
        deleteDecisionVote,
        addDecisionConfirmation,
        getDecisionConfirmations,
        getVotesForProposalDimension,
        getOptionsForProposalDimension,
        addMember,
        setMemberAdmin,
        renameMember,
        removeMember,
        seedMockActivities,
        addProposalContributions,
        refresh,
      }}
    >
      {children}
    </ProposalContext.Provider>
  );
}

export function useProposals() {
  const context = useContext(ProposalContext);
  if (context === undefined) {
    throw new Error('useProposals must be used within a ProposalProvider');
  }
  return context;
}

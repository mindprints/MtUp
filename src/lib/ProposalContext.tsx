import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import type {
  Proposal,
  Availability,
  DecisionDimension,
  ProposalDecisionConfig,
  DecisionOption,
  DecisionVote,
  DecisionConfirmation,
  GroupSummary,
} from '@/types';
import { storage } from '@/lib/storage';
import { isSupabaseMode } from '@/lib/runtimeConfig';
import { getSupabaseClient } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { generateId } from '@/lib/utils';

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
    password: string;
    isAdmin: boolean;
  }) => Promise<{ ok: boolean; message?: string }>;
  setMemberAdmin: (
    memberId: string,
    isAdmin: boolean
  ) => Promise<{ ok: boolean; message?: string }>;
  removeMember: (memberId: string) => Promise<{ ok: boolean; message?: string }>;
  refresh: () => void;
};

type GroupSummaryUser = {
  id: string;
  name: string;
  email?: string;
  isAdmin: boolean;
};

const ProposalContext = createContext<ProposalContextType | undefined>(undefined);

export function ProposalProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [activeGroupId, setActiveGroupIdState] = useState<string | null>(null);
  const [groupUsers, setGroupUsers] = useState<GroupSummaryUser[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [availabilities, setAvailabilities] = useState<Availability[]>([]);
  const [decisionConfigs, setDecisionConfigs] = useState<ProposalDecisionConfig[]>(
    []
  );
  const [decisionOptions, setDecisionOptions] = useState<DecisionOption[]>([]);
  const [decisionVotes, setDecisionVotes] = useState<DecisionVote[]>([]);
  const [decisionConfirmations, setDecisionConfirmations] = useState<
    DecisionConfirmation[]
  >([]);

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

  type AvailabilityRow = {
    id: string;
    user_id: string;
    proposal_id: string;
    dates_json: string[] | null;
    time_slots_json: string[] | null;
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
      return;
    }

    await (async () => {
      const supabase = getSupabaseClient();
      const { data: membershipData, error: membershipError } = await supabase
        .from('group_memberships')
        .select('group_id, role')
        .eq('user_id', user.id);

      if (membershipError) {
        console.error('Failed to fetch group memberships:', membershipError);
        return;
      }

      const memberships = (membershipData || []) as MembershipRow[];
      const groupIds = memberships.map((m) => m.group_id);
      if (groupIds.length === 0) {
        setGroups([]);
        setActiveGroupIdState(null);
        setGroupUsers([]);
        setProposals([]);
        return;
      }

      const { data: groupData, error: groupError } = await supabase
        .from('groups')
        .select('id, name')
        .in('id', groupIds);

      if (groupError) {
        console.error('Failed to fetch groups:', groupError);
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
        return;
      }

      const { data: memberRows, error: memberRowsError } = await supabase
        .from('group_memberships')
        .select('user_id')
        .eq('group_id', resolvedGroupId);

      if (memberRowsError) {
        console.error('Failed to fetch group members:', memberRowsError);
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
          console.error('Failed to fetch member profiles:', memberProfilesError);
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

      const { data: proposalData, error: proposalError } = await supabase
        .from('proposals')
        .select(
          'id, group_id, title, type, emoji, created_by, authored_by, created_at, status, specifics_json'
        )
        .eq('group_id', resolvedGroupId)
        .order('created_at', { ascending: true });

      if (proposalError) {
        console.error('Failed to fetch proposals:', proposalError);
        return;
      }

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
        })
      );

      setProposals(mappedProposals);

      const { data: availabilityData, error: availabilityError } = await supabase
        .from('availabilities')
        .select('id, user_id, proposal_id, dates_json, time_slots_json')
        .eq('group_id', resolvedGroupId);

      if (availabilityError) {
        console.error('Failed to fetch availabilities:', availabilityError);
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

      // Keep existing local-backed Stage 2 entities while incremental migration is in progress.
      const localData = storage.getData();
      setDecisionConfigs(localData.decisionConfigs);
      setDecisionOptions(localData.decisionOptions);
      setDecisionVotes(localData.decisionVotes);
      setDecisionConfirmations(localData.decisionConfirmations);
    })();
  }, [activeGroupId, hydrateFromLocalStorage, user]);

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
        if (updates.title !== undefined) payload.title = updates.title;
        if (updates.type !== undefined) payload.type = updates.type;
        if (updates.emoji !== undefined) payload.emoji = updates.emoji;
        if (updates.status !== undefined) payload.status = updates.status;
        if (updates.specifics !== undefined) {
          payload.specifics_json = updates.specifics;
        }
        if (Object.keys(payload).length === 0) return;
        const { error } = await supabase
          .from('proposals')
          .update(payload)
          .eq('id', proposalId);
        if (error) {
          console.error('Failed to update proposal:', error);
          return;
        }
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
    if (isSupabaseMode()) {
      return {
        ok: false,
        message: 'Creating new auth users is not enabled here yet.',
      };
    }

    const trimmedName = payload.name.trim();
    if (!trimmedName) {
      return { ok: false, message: 'Member name is required.' };
    }

    const existing = storage
      .getData()
      .users.find((entry) => entry.name.toLowerCase() === trimmedName.toLowerCase());
    if (existing) {
      return { ok: false, message: 'Member name already exists.' };
    }

    storage.addUser({
      id: generateId(),
      name: trimmedName,
      email: `${trimmedName.toLowerCase().replace(/\s+/g, '.')}@mtup.local`,
      password: payload.password.trim() || 'password',
      isAdmin: payload.isAdmin,
    });
    refresh();
    return { ok: true };
  };

  const setMemberAdmin: ProposalContextType['setMemberAdmin'] = async (memberId, isAdmin) => {
    if (isSupabaseMode() && user) {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from('profiles')
        .update({ is_platform_admin: isAdmin })
        .eq('id', memberId);
      if (error) {
        console.error('Failed to update member admin flag:', error);
        return { ok: false, message: 'Failed to update admin role.' };
      }
      refresh();
      return { ok: true };
    }

    storage.updateUser(memberId, { isAdmin });
    refresh();
    return { ok: true };
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
      const { error } = await supabase
        .from('group_memberships')
        .delete()
        .eq('group_id', activeGroupId)
        .eq('user_id', memberId);
      if (error) {
        console.error('Failed to remove group member:', error);
        return { ok: false, message: 'Failed to remove member from group.' };
      }
      refresh();
      return { ok: true };
    }

    storage.deleteUser(memberId);
    refresh();
    return { ok: true };
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
        removeMember,
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

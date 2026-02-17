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

type ProposalContextType = {
  groups: GroupSummary[];
  activeGroupId: string | null;
  setActiveGroupId: (groupId: string | null) => void;
  proposals: Proposal[];
  availabilities: Availability[];
  decisionConfigs: ProposalDecisionConfig[];
  decisionOptions: DecisionOption[];
  decisionVotes: DecisionVote[];
  decisionConfirmations: DecisionConfirmation[];
  addProposal: (proposal: Proposal) => void;
  updateProposal: (proposalId: string, updates: Partial<Proposal>) => void;
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
  refresh: () => void;
};

const ProposalContext = createContext<ProposalContextType | undefined>(undefined);

export function ProposalProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [activeGroupId, setActiveGroupIdState] = useState<string | null>(null);
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
    setProposals(data.proposals);
    setAvailabilities(data.availabilities);
    setDecisionConfigs(data.decisionConfigs);
    setDecisionOptions(data.decisionOptions);
    setDecisionVotes(data.decisionVotes);
    setDecisionConfirmations(data.decisionConfirmations);
  }, []);

  const refresh = useCallback(() => {
    if (!isSupabaseMode()) {
      hydrateFromLocalStorage();
      return;
    }

    if (!user) {
      setGroups([]);
      setActiveGroupIdState(null);
      setProposals([]);
      setAvailabilities([]);
      setDecisionConfigs([]);
      setDecisionOptions([]);
      setDecisionVotes([]);
      setDecisionConfirmations([]);
      return;
    }

    void (async () => {
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
        setProposals([]);
        return;
      }

      const { data: proposalData, error: proposalError } = await supabase
        .from('proposals')
        .select(
          'id, group_id, title, type, emoji, created_by, created_at, status, specifics_json'
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
    if (isSupabaseMode() && user) {
      const targetGroupId = activeGroupId || groups[0]?.id || null;
      if (!targetGroupId) {
        console.error('Cannot create proposal: no active group available.');
        return;
      }

      void (async () => {
        const supabase = getSupabaseClient();
        const { error } = await supabase.from('proposals').insert({
          id: proposal.id,
          group_id: targetGroupId,
          title: proposal.title,
          type: proposal.type,
          emoji: proposal.emoji,
          created_by: user.id,
          status: proposal.status,
          specifics_json: proposal.specifics || null,
        });
        if (error) {
          console.error('Failed to create proposal:', error);
          return;
        }
        if (!activeGroupId) {
          setActiveGroupIdState(targetGroupId);
        }
        refresh();
      })();
      return;
    }

    storage.addProposal(proposal);
    refresh();
  };

  const updateProposal = (proposalId: string, updates: Partial<Proposal>) => {
    if (isSupabaseMode() && user) {
      void (async () => {
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
        refresh();
      })();
      return;
    }

    storage.updateProposal(proposalId, updates);
    refresh();
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

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type {
  Proposal,
  Availability,
  DecisionDimension,
  ProposalDecisionConfig,
  DecisionOption,
  DecisionVote,
  DecisionConfirmation,
} from '@/types';
import { storage } from '@/lib/storage';

type ProposalContextType = {
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

  const refresh = () => {
    const data = storage.getData();
    setProposals(data.proposals);
    setAvailabilities(data.availabilities);
    setDecisionConfigs(data.decisionConfigs);
    setDecisionOptions(data.decisionOptions);
    setDecisionVotes(data.decisionVotes);
    setDecisionConfirmations(data.decisionConfirmations);
  };

  useEffect(() => {
    refresh();
  }, []);

  const addProposal = (proposal: Proposal) => {
    storage.addProposal(proposal);
    refresh();
  };

  const updateProposal = (proposalId: string, updates: Partial<Proposal>) => {
    storage.updateProposal(proposalId, updates);
    refresh();
  };

  const deleteProposal = (proposalId: string) => {
    storage.deleteProposal(proposalId);
    refresh();
  };

  const setAvailabilityWrapper = (availability: Availability) => {
    storage.setAvailability(availability);
    refresh();
  };

  const getAvailability = (userId: string, proposalId: string) => {
    return storage.getAvailability(userId, proposalId);
  };

  const getProposalAvailabilities = (proposalId: string) => {
    return storage.getProposalAvailabilities(proposalId);
  };

  const getUserAvailabilities = (userId: string) => {
    return storage.getUserAvailabilities(userId);
  };

  const deleteAvailability = (userId: string, proposalId: string) => {
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

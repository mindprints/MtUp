import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { Proposal, Availability } from '@/types';
import { storage } from '@/lib/storage';

type ProposalContextType = {
  proposals: Proposal[];
  availabilities: Availability[];
  addProposal: (proposal: Proposal) => void;
  updateProposal: (proposalId: string, updates: Partial<Proposal>) => void;
  deleteProposal: (proposalId: string) => void;
  setAvailability: (availability: Availability) => void;
  getAvailability: (userId: string, proposalId: string) => Availability | null;
  getProposalAvailabilities: (proposalId: string) => Availability[];
  getUserAvailabilities: (userId: string) => Availability[];
  deleteAvailability: (userId: string, proposalId: string) => void;
  refresh: () => void;
};

const ProposalContext = createContext<ProposalContextType | undefined>(undefined);

export function ProposalProvider({ children }: { children: ReactNode }) {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [availabilities, setAvailabilities] = useState<Availability[]>([]);

  const refresh = () => {
    setProposals(storage.getProposals());
    const data = storage.getData();
    setAvailabilities(data.availabilities);
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

  return (
    <ProposalContext.Provider
      value={{
        proposals,
        availabilities,
        addProposal,
        updateProposal,
        deleteProposal,
        setAvailability: setAvailabilityWrapper,
        getAvailability,
        getProposalAvailabilities,
        getUserAvailabilities,
        deleteAvailability,
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

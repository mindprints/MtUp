import { useState, FormEvent, useEffect } from 'react';
import { Modal } from './Modal';
import { useAuth } from '@/lib/AuthContext';
import { useProposals } from '@/lib/ProposalContext';
import type { ActivityType, Proposal } from '@/types';
import { getAvailableEmoji, generateId } from '@/lib/utils';
import { suggestIconFromTitle } from '@/lib/iconDictionary';

type CreateProposalModalProps = {
  isOpen: boolean;
  onClose: () => void;
  initialType?: ActivityType;
  onProposalCreated?: (proposalId: string) => void;
};

export function CreateProposalModal({
  isOpen,
  onClose,
  initialType = 'event',
  onProposalCreated,
}: CreateProposalModalProps) {
  const { user } = useAuth();
  const { proposals, addProposal } = useProposals();
  
  const [title, setTitle] = useState('');
  const [type, setType] = useState<ActivityType>(initialType);

  useEffect(() => {
    if (!isOpen) return;
    setType(initialType);
  }, [isOpen, initialType]);

  const usedEmojis = proposals.map((p) => p.emoji);
  const suggestedEmoji = suggestIconFromTitle(title);
  const resolvedEmoji = suggestedEmoji || getAvailableEmoji(usedEmojis);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    
    if (!user || !title.trim()) return;

    const emoji = resolvedEmoji;

    const newProposal: Proposal = {
      id: generateId(),
      title: title.trim(),
      type,
      emoji,
      createdBy: user.id,
      authoredBy: user.id,
      createdAt: new Date().toISOString(),
      status: 'proposed',
    };

    addProposal(newProposal);
    onProposalCreated?.(newProposal.id);
    
    // Reset form
    setTitle('');
    setType('event');
    onClose();
  };

  const handleClose = () => {
    setTitle('');
    setType(initialType);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={type === 'sejour' ? 'Create Sejour Proposal' : 'Create Event Proposal'}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-1">
            Activity Title *
          </label>
          <input
            id="title"
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Get together for beers"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100"
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
            Be as specific or vague as you like (e.g., "Trip" or "Trip to France in June")
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-2">
            Activity Type *
          </label>
          <div className="grid grid-cols-2 gap-2 rounded-md border border-gray-300 p-1 dark:border-slate-600">
            <button
              type="button"
              onClick={() => setType('event')}
              className={`rounded px-3 py-2 text-sm font-medium transition-colors ${
                type === 'event'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              Event
            </button>
            <button
              type="button"
              onClick={() => setType('sejour')}
              className={`rounded px-3 py-2 text-sm font-medium transition-colors ${
                type === 'sejour'
                  ? 'bg-teal-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              Sejour
            </button>
          </div>
          <p className="mt-2 text-xs text-gray-500 dark:text-slate-400">
            {type === 'sejour'
              ? 'Sejour proposals can represent one or multiple candidate date windows.'
              : 'Event proposals are usually single-date activities.'}
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-2">
            Icon (auto-selected)
          </label>
          <div className="flex items-center justify-center w-16 h-16 border-2 border-gray-300 dark:border-slate-600 rounded-lg text-3xl">
            {resolvedEmoji}
          </div>
          {suggestedEmoji && (
            <p className="mt-1 text-xs text-blue-600 dark:text-blue-300">
              Auto-selected from title keyword: {suggestedEmoji}
            </p>
          )}
          <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
            Icon is assigned automatically from activity title keywords, with fallback auto-assignment.
          </p>
        </div>

        <div className="flex gap-3 pt-4">
          <button
            type="button"
            onClick={handleClose}
            className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-600 dark:hover:bg-slate-700"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
          >
            Create Proposal
          </button>
        </div>
      </form>
    </Modal>
  );
}

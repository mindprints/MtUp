import { useState, FormEvent } from 'react';
import { Modal } from './Modal';
import { useAuth } from '@/lib/AuthContext';
import { useProposals } from '@/lib/ProposalContext';
import type { ActivityType, Proposal } from '@/types';
import { getAvailableEmoji, generateId } from '@/lib/utils';
import { EMOJI_POOL } from '@/lib/utils';
import { suggestIconFromTitle } from '@/lib/iconDictionary';

type CreateProposalModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onProposalCreated?: (proposalId: string) => void;
};

export function CreateProposalModal({
  isOpen,
  onClose,
  onProposalCreated,
}: CreateProposalModalProps) {
  const { user } = useAuth();
  const { proposals, addProposal } = useProposals();
  
  const [title, setTitle] = useState('');
  const [type, setType] = useState<ActivityType>('event');
  const [selectedEmoji, setSelectedEmoji] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const usedEmojis = proposals.map((p) => p.emoji);
  const suggestedEmoji = suggestIconFromTitle(title);
  const resolvedEmoji = selectedEmoji || suggestedEmoji || getAvailableEmoji(usedEmojis);

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
      createdAt: new Date().toISOString(),
      status: 'proposed',
    };

    addProposal(newProposal);
    onProposalCreated?.(newProposal.id);
    
    // Reset form
    setTitle('');
    setType('event');
    setSelectedEmoji('');
    setShowEmojiPicker(false);
    onClose();
  };

  const handleClose = () => {
    setTitle('');
    setType('event');
    setSelectedEmoji('');
    setShowEmojiPicker(false);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Create Activity Proposal">
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
          <div className="flex gap-4">
            <label className="flex items-center cursor-pointer dark:text-slate-200">
              <input
                type="radio"
                value="event"
                checked={type === 'event'}
                onChange={(e) => setType(e.target.value as ActivityType)}
                className="mr-2"
              />
              <span className="text-sm">Event (single day)</span>
            </label>
            <label className="flex items-center cursor-pointer dark:text-slate-200">
              <input
                type="radio"
                value="sejour"
                checked={type === 'sejour'}
                onChange={(e) => setType(e.target.value as ActivityType)}
                className="mr-2"
              />
              <span className="text-sm">Sejour (multi-day trip)</span>
            </label>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-2">
            Icon (optional)
          </label>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-16 h-16 border-2 border-gray-300 dark:border-slate-600 rounded-lg text-3xl">
              {resolvedEmoji}
            </div>
            <button
              type="button"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-600 dark:hover:bg-slate-700"
            >
              {showEmojiPicker ? 'Hide' : 'Choose'} Icon
            </button>
          </div>
          {suggestedEmoji && !selectedEmoji && (
            <p className="mt-1 text-xs text-blue-600 dark:text-blue-300">
              Auto-selected from title keyword: {suggestedEmoji}
            </p>
          )}
          
          {showEmojiPicker && (
            <div className="mt-3 p-3 border border-gray-200 dark:border-slate-700 rounded-lg bg-gray-50 dark:bg-slate-800 max-h-48 overflow-y-auto">
              <div className="grid grid-cols-8 gap-2">
                {EMOJI_POOL.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => {
                      setSelectedEmoji(emoji);
                      setShowEmojiPicker(false);
                    }}
                    className={`text-2xl p-2 rounded hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors ${
                      selectedEmoji === emoji ? 'bg-blue-100 ring-2 ring-blue-500' : ''
                    } ${
                      usedEmojis.includes(emoji) ? 'opacity-40' : ''
                    }`}
                    title={usedEmojis.includes(emoji) ? 'Already in use' : ''}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          )}
          <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
            An icon will be auto-assigned if you don't choose one
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

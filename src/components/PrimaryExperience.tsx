import { useEffect, useState } from 'react';
import { AppView } from './AppView';
import { AiAssistantPanel } from './AiAssistantPanel';
import { useAuth } from '@/lib/AuthContext';
import { useProposals } from '@/lib/ProposalContext';
import { runtimeConfig } from '@/lib/runtimeConfig';

type ExperienceTab = 'assistant' | 'workspace';
const EXPERIENCE_TAB_STORAGE_KEY = 'mtup-primary-tab';

function readInitialTab(aiEnabled: boolean): ExperienceTab {
  const stored = localStorage.getItem(EXPERIENCE_TAB_STORAGE_KEY);
  if (stored === 'assistant' || stored === 'workspace') {
    if (stored === 'assistant' && !aiEnabled) return 'workspace';
    return stored;
  }
  return aiEnabled ? 'assistant' : 'workspace';
}

export function PrimaryExperience() {
  const { user } = useAuth();
  const { activeGroupId } = useProposals();
  const [activeTab, setActiveTab] = useState<ExperienceTab>(() =>
    readInitialTab(runtimeConfig.aiAssistantEnabled)
  );

  if (!user) return null;

  useEffect(() => {
    localStorage.setItem(EXPERIENCE_TAB_STORAGE_KEY, activeTab);
  }, [activeTab]);

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg shadow p-4 dark:bg-slate-900 dark:border dark:border-slate-800">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-slate-400">
              Workspace Mode
            </p>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-slate-100">
              {activeTab === 'assistant' ? 'AI Assistant First' : 'Calendar Workspace'}
            </h2>
          </div>
          <div className="inline-flex rounded-md border border-gray-300 overflow-hidden dark:border-slate-600">
            <button
              type="button"
              onClick={() => setActiveTab('assistant')}
              disabled={!runtimeConfig.aiAssistantEnabled}
              className={`px-3 py-1.5 text-sm font-medium ${
                activeTab === 'assistant'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white text-gray-700 dark:bg-slate-800 dark:text-slate-200'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              Assistant
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('workspace')}
              className={`px-3 py-1.5 text-sm font-medium ${
                activeTab === 'workspace'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 dark:bg-slate-800 dark:text-slate-200'
              }`}
            >
              Workspace
            </button>
          </div>
        </div>
      </div>

      {activeTab === 'assistant' ? (
        <div className="bg-white rounded-lg shadow p-6 dark:bg-slate-900 dark:border dark:border-slate-800">
          {runtimeConfig.aiAssistantEnabled ? (
            <AiAssistantPanel userId={user.id} activeGroupId={activeGroupId} />
          ) : (
            <p className="text-sm text-gray-600 dark:text-slate-300">
              AI Assistant is disabled. Set <code>VITE_AI_ASSISTANT_ENABLED=true</code> and restart
              dev server.
            </p>
          )}
        </div>
      ) : (
        <AppView />
      )}
    </div>
  );
}

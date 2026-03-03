import { useEffect, useState } from 'react';
import { AppView } from './AppView';
import { AiAssistantPanel } from './AiAssistantPanel';
import { ProposeScreen } from './ProposeScreen';
import { AdminDashboard } from './AdminDashboard';
import { useAuth } from '@/lib/AuthContext';
import { useProposals } from '@/lib/ProposalContext';
import { runtimeConfig } from '@/lib/runtimeConfig';

type ExperienceTab = 'activities' | 'propose' | 'admin' | 'workspace';
const EXPERIENCE_TAB_STORAGE_KEY = 'mtup-primary-tab';

function readInitialTab(aiEnabled: boolean): ExperienceTab {
  const stored = localStorage.getItem(EXPERIENCE_TAB_STORAGE_KEY);
  if (stored === 'assistant') {
    return aiEnabled ? 'activities' : 'workspace';
  }
  if (stored === 'workspace') {
    return aiEnabled ? 'activities' : 'workspace';
  }
  if (stored === 'activities' || stored === 'propose' || stored === 'admin') {
    if (stored === 'activities' && !aiEnabled) return 'workspace';
    if (stored === 'propose' && !aiEnabled) return 'workspace';
    return stored;
  }
  return aiEnabled ? 'activities' : 'workspace';
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
    <div className="flex h-full min-h-0 flex-col gap-2">
      {activeTab !== 'propose' && (
        <div className="shrink-0 rounded-lg bg-white p-2 dark:bg-slate-900 dark:border dark:border-slate-800">
          <div className="flex items-center justify-end gap-2">
            {user.isAdmin && (
              <button
                type="button"
                onClick={() => setActiveTab('admin')}
                className={`rounded-md border px-2.5 py-1.5 text-xs font-medium ${
                  activeTab === 'admin'
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : 'border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800'
                }`}
              >
                Admin
              </button>
            )}
            <button
              type="button"
              onClick={() => setActiveTab('propose')}
              className="rounded-md border border-gray-300 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Snooky
            </button>
          </div>
        </div>
      )}

      {activeTab === 'activities' ? (
        <div className="min-h-0 flex-1 overflow-hidden rounded-lg bg-white p-2 dark:bg-slate-900 dark:border dark:border-slate-800">
          {runtimeConfig.aiAssistantEnabled ? (
            <div className="h-full overflow-hidden">
              <AiAssistantPanel userId={user.id} activeGroupId={activeGroupId} />
            </div>
          ) : (
            <p className="text-sm text-gray-600 dark:text-slate-300">
              Snooky is disabled. Set <code>VITE_AI_ASSISTANT_ENABLED=true</code> and restart
              dev server.
            </p>
          )}
        </div>
      ) : activeTab === 'propose' ? (
        <ProposeScreen
          userId={user.id}
          activeGroupId={activeGroupId}
          onGoActivities={() => setActiveTab('activities')}
        />
      ) : activeTab === 'admin' ? (
        <AdminDashboard onGoActivities={() => setActiveTab('activities')} />
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <AppView />
        </div>
      )}
    </div>
  );
}

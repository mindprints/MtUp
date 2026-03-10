import { useEffect, useMemo, useRef, useState } from 'react';
import { AppView } from './AppView';
import { AiAssistantPanel } from './AiAssistantPanel';
import { ProposeScreen } from './ProposeScreen';
import { ResolverScreen } from './ResolverScreen';
import { AdminDashboard } from './AdminDashboard';
import { useAuth } from '@/lib/AuthContext';
import { useProposals } from '@/lib/ProposalContext';
import { runtimeConfig } from '@/lib/runtimeConfig';

type ExperienceTab = 'activities' | 'propose' | 'resolver' | 'admin' | 'workspace';
const EXPERIENCE_TAB_STORAGE_KEY = 'mtup-primary-tab';

function isEditableTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}

function findActiveVerticalScrollTarget(
  pager: HTMLDivElement | null,
  tabIndex: number
): HTMLElement | null {
  if (!pager || tabIndex < 0) return null;
  const activeSection = pager.children.item(tabIndex);
  if (!(activeSection instanceof HTMLElement)) return null;

  const taggedTarget = activeSection.querySelector<HTMLElement>('[data-screen-scroll-root="true"]');
  if (taggedTarget) return taggedTarget;

  const fallbackTargets = Array.from(activeSection.querySelectorAll<HTMLElement>('*')).filter(
    (element) => element.scrollHeight > element.clientHeight + 8
  );

  return fallbackTargets[0] || null;
}

function readInitialTab(aiEnabled: boolean): ExperienceTab {
  const stored = localStorage.getItem(EXPERIENCE_TAB_STORAGE_KEY);
  if (stored === 'assistant') {
    return aiEnabled ? 'activities' : 'workspace';
  }
  if (stored === 'workspace') {
    return aiEnabled ? 'activities' : 'workspace';
  }
  if (stored === 'activities' || stored === 'propose' || stored === 'resolver' || stored === 'admin') {
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
  const pagerRef = useRef<HTMLDivElement | null>(null);
  const hasInitializedPagerRef = useRef(false);

  const availableTabs = useMemo<ExperienceTab[]>(() => {
    if (runtimeConfig.aiAssistantEnabled) {
      return user?.isAdmin
        ? ['activities', 'propose', 'resolver', 'admin']
        : ['activities', 'propose', 'resolver'];
    }

    return user?.isAdmin ? ['workspace', 'resolver', 'admin'] : ['workspace', 'resolver'];
  }, [user?.isAdmin]);

  if (!user) return null;

  useEffect(() => {
    localStorage.setItem(EXPERIENCE_TAB_STORAGE_KEY, activeTab);
  }, [activeTab]);

  useEffect(() => {
    if (!availableTabs.includes(activeTab)) {
      setActiveTab(availableTabs[0]);
    }
  }, [activeTab, availableTabs]);

  useEffect(() => {
    const pager = pagerRef.current;
    if (!pager) return;

    const tabIndex = availableTabs.indexOf(activeTab);
    if (tabIndex === -1) return;

    const behavior = hasInitializedPagerRef.current ? 'smooth' : 'auto';
    pager.scrollTo({
      left: pager.clientWidth * tabIndex,
      behavior,
    });
    hasInitializedPagerRef.current = true;
  }, [activeTab, availableTabs]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) {
        return;
      }

      if (
        event.key !== 'ArrowLeft' &&
        event.key !== 'ArrowRight' &&
        event.key !== 'ArrowUp' &&
        event.key !== 'ArrowDown'
      ) {
        return;
      }

      if (isEditableTarget(event.target)) {
        return;
      }

      const currentIndex = availableTabs.indexOf(activeTab);
      if (currentIndex === -1) return;

      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        const scrollTarget = findActiveVerticalScrollTarget(pagerRef.current, currentIndex);
        if (!scrollTarget || scrollTarget.scrollHeight <= scrollTarget.clientHeight + 8) {
          return;
        }

        event.preventDefault();
        const delta = Math.max(120, Math.round(scrollTarget.clientHeight * 0.88));
        scrollTarget.scrollBy({
          top: event.key === 'ArrowDown' ? delta : -delta,
          behavior: 'smooth',
        });
        return;
      }

      const nextIndex =
        event.key === 'ArrowRight'
          ? Math.min(currentIndex + 1, availableTabs.length - 1)
          : Math.max(currentIndex - 1, 0);

      if (nextIndex === currentIndex) return;

      event.preventDefault();
      setActiveTab(availableTabs[nextIndex]);
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    document.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
      document.removeEventListener('keydown', handleKeyDown, { capture: true });
    };
  }, [activeTab, availableTabs]);

  const activitiesScreen = (
    <div className="min-h-0 flex-1 overflow-hidden rounded-lg bg-white p-2 dark:border dark:border-slate-800 dark:bg-slate-900">
      {runtimeConfig.aiAssistantEnabled ? (
        <div className="h-full overflow-hidden">
          <AiAssistantPanel userId={user.id} activeGroupId={activeGroupId} />
        </div>
      ) : (
        <p className="text-sm text-gray-600 dark:text-slate-300">
          Snooky is disabled. Set <code>VITE_AI_ASSISTANT_ENABLED=true</code> and restart dev
          server.
        </p>
      )}
    </div>
  );

  const proposeScreen = (
    <ProposeScreen
      userId={user.id}
      activeGroupId={activeGroupId}
      onGoActivities={() => setActiveTab('activities')}
    />
  );

  const resolverScreen = (
    <div className="min-h-0 flex-1 overflow-hidden rounded-lg bg-white p-2 dark:border dark:border-slate-800 dark:bg-slate-900">
      <ResolverScreen />
    </div>
  );

  const adminScreen = <AdminDashboard onGoActivities={() => setActiveTab('activities')} />;

  const workspaceScreen = (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <AppView />
    </div>
  );

  const renderScreen = (tab: ExperienceTab) => {
    if (tab === 'activities') return activitiesScreen;
    if (tab === 'propose') return proposeScreen;
    if (tab === 'resolver') return resolverScreen;
    if (tab === 'admin') return adminScreen;
    return workspaceScreen;
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      {activeTab !== 'propose' && (
        <div className="shrink-0 rounded-lg bg-white p-2 dark:border dark:border-slate-800 dark:bg-slate-900">
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
                onClick={() => setActiveTab('resolver')}
                className={`rounded-md border px-2.5 py-1.5 text-xs font-medium ${
                  activeTab === 'resolver'
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : 'border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800'
                }`}
              >
                Resolver
              </button>
              <button
                type="button"
                onClick={() => setActiveTab(runtimeConfig.aiAssistantEnabled ? 'propose' : 'workspace')}
                className={`rounded-md border px-2.5 py-1.5 text-xs font-medium ${
                  activeTab === 'activities' || activeTab === 'workspace'
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : 'border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800'
                }`}
              >
                Snooky
              </button>
          </div>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-hidden">
        <div
          ref={pagerRef}
          className="flex h-full snap-x snap-mandatory overflow-x-auto overflow-y-hidden scroll-smooth"
        >
          {availableTabs.map((tab) => (
            <section key={tab} className="flex h-full min-h-0 w-full min-w-full snap-start px-0.5">
              {renderScreen(tab)}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from 'react';
import { AppView } from './AppView';
import { AiAssistantPanel } from './AiAssistantPanel';
import { ProposeScreen } from './ProposeScreen';
import { ResolverScreen } from './ResolverScreen';
import { AdminDashboard } from './AdminDashboard';
import { SettingsScreen } from './SettingsScreen';
import { SnookyDeskScreen } from './SnookyDeskScreen';
import { useAuth } from '@/lib/AuthContext';
import { useProposals } from '@/lib/ProposalContext';
import { runtimeConfig } from '@/lib/runtimeConfig';

type ExperienceTab = 'activities' | 'settings' | 'propose' | 'resolver' | 'briefing' | 'admin' | 'workspace';

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
  return aiEnabled ? 'propose' : 'workspace';
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
        ? ['propose', 'activities', 'resolver', 'settings', 'briefing', 'admin']
        : ['propose', 'activities', 'resolver', 'settings', 'briefing'];
    }

    return user?.isAdmin ? ['workspace', 'resolver', 'settings', 'admin'] : ['workspace', 'resolver', 'settings'];
  }, [user?.isAdmin]);

  if (!user) return null;

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
    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
    };
  }, [activeTab, availableTabs]);

  useEffect(() => {
    const pager = pagerRef.current;
    if (!pager) return;

    const handleWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) {
        return;
      }

      const currentIndex = availableTabs.indexOf(activeTab);
      if (currentIndex === -1) return;

      const scrollTarget = findActiveVerticalScrollTarget(pager, currentIndex);
      if (!scrollTarget || scrollTarget.scrollHeight <= scrollTarget.clientHeight + 8) {
        return;
      }

      event.preventDefault();
      scrollTarget.scrollBy({
        top: event.deltaY,
        behavior: 'auto',
      });
    };

    pager.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      pager.removeEventListener('wheel', handleWheel);
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
    <ProposeScreen userId={user.id} activeGroupId={activeGroupId} />
  );

  const settingsScreen = <SettingsScreen />;

  const resolverScreen = (
    <div className="min-h-0 flex-1 overflow-hidden rounded-lg bg-white p-2 dark:border dark:border-slate-800 dark:bg-slate-900">
      <ResolverScreen />
    </div>
  );

  const briefingScreen = <SnookyDeskScreen />;

  const adminScreen = <AdminDashboard onGoActivities={() => setActiveTab('activities')} />;

  const workspaceScreen = (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <AppView />
    </div>
  );

  const renderScreen = (tab: ExperienceTab) => {
    if (tab === 'activities') return activitiesScreen;
    if (tab === 'settings') return settingsScreen;
    if (tab === 'propose') return proposeScreen;
    if (tab === 'resolver') return resolverScreen;
    if (tab === 'briefing') return briefingScreen;
    if (tab === 'admin') return adminScreen;
    return workspaceScreen;
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
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

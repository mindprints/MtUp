import { AiAssistantPanel } from './AiAssistantPanel';

type ProposeScreenProps = {
  userId: string;
  activeGroupId: string | null;
};

export function ProposeScreen({ userId, activeGroupId }: ProposeScreenProps) {
  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col">
      <div className="min-h-0 w-full min-w-0 flex-1 overflow-hidden rounded-lg bg-white p-2 dark:border dark:border-slate-800 dark:bg-slate-900">
        <div className="h-full overflow-hidden">
          <AiAssistantPanel userId={userId} activeGroupId={activeGroupId} showInlineChatbox proposalFlow />
        </div>
      </div>
    </div>
  );
}

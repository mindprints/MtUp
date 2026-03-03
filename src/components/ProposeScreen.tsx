import { AiAssistantPanel } from './AiAssistantPanel';

type ProposeScreenProps = {
  userId: string;
  activeGroupId: string | null;
  onGoActivities: () => void;
};

export function ProposeScreen({ userId, activeGroupId, onGoActivities }: ProposeScreenProps) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-hidden rounded-lg bg-white p-2 dark:border dark:border-slate-800 dark:bg-slate-900">
        <div className="h-full overflow-hidden">
          <AiAssistantPanel
            userId={userId}
            activeGroupId={activeGroupId}
            showInlineChatbox
            proposalFlow
            onProposalFlowGoActivities={onGoActivities}
          />
        </div>
      </div>
    </div>
  );
}

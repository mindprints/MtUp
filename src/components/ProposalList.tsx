import { useProposals } from '@/lib/ProposalContext';
import { storage } from '@/lib/storage';

export function ProposalList() {
  const { proposals, getProposalAvailabilities } = useProposals();
  const users = storage.getData().users;

  if (proposals.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p className="text-lg mb-2">No proposals yet</p>
        <p className="text-sm">Create your first activity proposal to get started!</p>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'proposed':
        return 'bg-gray-100 text-gray-800';
      case 'scheduled':
        return 'bg-blue-100 text-blue-800';
      case 'confirmed':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-3">
      {proposals.map((proposal) => {
        const creator = users.find((u) => u.id === proposal.createdBy);
        const availabilities = getProposalAvailabilities(proposal.id);
        const respondedUsers = new Set(availabilities.map((a) => a.userId));

        return (
          <div
            key={proposal.id}
            className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
          >
            <div className="flex items-start gap-3">
              <div className="text-4xl">{proposal.emoji}</div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-gray-900 text-lg">
                      {proposal.title}
                    </h3>
                    <p className="text-sm text-gray-600 mt-0.5">
                      Proposed by {creator?.name}
                    </p>
                  </div>
                  
                  <div className="flex flex-col items-end gap-2">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                        proposal.status
                      )}`}
                    >
                      {proposal.status.charAt(0).toUpperCase() + proposal.status.slice(1)}
                    </span>
                    
                    <span className="text-xs text-gray-500 capitalize">
                      {proposal.type}
                    </span>
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1.5">
                    <span className="text-gray-600">Responses:</span>
                    <span className="font-medium text-gray-900">
                      {respondedUsers.size} / {users.length}
                    </span>
                  </div>
                  
                  {respondedUsers.size > 0 && (
                    <div className="flex items-center gap-1">
                      {Array.from(respondedUsers).map((userId) => {
                        const user = users.find((u) => u.id === userId);
                        return (
                          <div
                            key={userId}
                            className="w-6 h-6 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center font-medium"
                            title={user?.name}
                          >
                            {user?.name.charAt(0).toUpperCase()}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {proposal.specifics && (
                  <div className="mt-3 pt-3 border-t border-gray-100 text-sm text-gray-600">
                    {proposal.specifics.date && (
                      <div>📅 {proposal.specifics.date}</div>
                    )}
                    {proposal.specifics.time && (
                      <div>🕐 {proposal.specifics.time}</div>
                    )}
                    {proposal.specifics.location && (
                      <div>📍 {proposal.specifics.location}</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

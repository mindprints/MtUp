import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { ProposalProvider } from '@/lib/ProposalContext';
import { Login } from '@/components/Login';
import { Dashboard } from '@/components/Dashboard';
import { AppView } from '@/components/AppView';

function AppContent() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <ProposalProvider>
      <Dashboard>
        <AppView />
      </Dashboard>
    </ProposalProvider>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;

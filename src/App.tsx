import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { ProposalProvider } from '@/lib/ProposalContext';
import { Login } from '@/components/Login';
import { Dashboard } from '@/components/Dashboard';
import { ThemeProvider } from '@/lib/ThemeContext';
import { PrimaryExperience } from '@/components/PrimaryExperience';

function AppContent() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-950">
        <div className="text-gray-600 dark:text-slate-300">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <ProposalProvider>
      <Dashboard>
        <PrimaryExperience />
      </Dashboard>
    </ProposalProvider>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;

import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';

import AppLayout from './components/AppLayout';
import Onboarding from './pages/Onboarding';
import Dashboard from './pages/Dashboard.jsx';
import Settings from './pages/Settings.jsx';
import Protocols from './pages/Protocols';
import ProtocolDetail from './pages/ProtocolDetail';
import Import from './pages/Import';
import Runs from './pages/Runs';
import RunExecution from './pages/RunExecution';
import RunDetail from './pages/RunDetail';
import Deviations from './pages/Deviations';
import AuditView from './pages/AuditView';
import AuditReadiness from './pages/AuditReadiness';
import Traceability from './pages/Traceability';
import Team from './pages/Team';
import Pricing from './pages/Pricing';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  return (
    <Routes>
      <Route path="/onboarding" element={<Onboarding />} />
      <Route element={<AppLayout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/protocols" element={<Protocols />} />
        <Route path="/protocol-detail" element={<ProtocolDetail />} />
        <Route path="/import" element={<Import />} />
        <Route path="/runs" element={<Runs />} />
        <Route path="/run-execution" element={<RunExecution />} />
        <Route path="/run-detail" element={<RunDetail />} />
        <Route path="/deviations" element={<Deviations />} />
        <Route path="/audit-view" element={<AuditView />} />
        <Route path="/audit-readiness" element={<AuditReadiness />} />
        <Route path="/traceability" element={<Traceability />} />
        <Route path="/team" element={<Team />} />
        <Route path="/pricing" element={<Pricing />} />
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App
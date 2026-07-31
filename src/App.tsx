import {
  HashRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { Spinner } from './components/ui';
import { APP_VERSION } from './lib/config';
import Landing from './pages/Landing';
import Assessment from './pages/Assessment';
import CandidateDashboard from './pages/CandidateDashboard';
import AdminDashboard from './pages/AdminDashboard';

function RequireAuth({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading)
    return (
      <div className="grid min-h-screen place-items-center">
        <Spinner label="Loading…" />
      </div>
    );
  if (!user) return <Navigate to="/" state={{ from: loc }} replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      {/* HashRouter avoids GitHub Pages deep-link 404s entirely */}
      <HashRouter>
        {/* Global version badge — confirms which build is live */}
        <span className="pointer-events-none fixed bottom-2 right-2 z-50 rounded-full bg-ink/70 px-2 py-0.5 font-mono text-[10px] text-white/90">
          {APP_VERSION}
        </span>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route
            path="/assessment"
            element={
              <RequireAuth>
                <Assessment />
              </RequireAuth>
            }
          />
          <Route
            path="/dashboard"
            element={
              <RequireAuth>
                <CandidateDashboard />
              </RequireAuth>
            }
          />
          <Route
            path="/admin"
            element={
              <RequireAuth>
                <AdminDashboard />
              </RequireAuth>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </AuthProvider>
  );
}

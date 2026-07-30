import {
  HashRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { useDarkMode } from './hooks/useDarkMode';
import { Spinner } from './components/ui';
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

function DarkToggle() {
  const { dark, toggle } = useDarkMode();
  return (
    <button
      onClick={toggle}
      title="Toggle theme"
      className="fixed bottom-4 right-4 z-50 grid h-10 w-10 place-items-center rounded-full border border-line bg-white/80 shadow-lg backdrop-blur dark:bg-slate1/80"
    >
      {dark ? '☀' : '☾'}
    </button>
  );
}

export default function App() {
  return (
    <AuthProvider>
      {/* HashRouter avoids GitHub Pages deep-link 404s entirely */}
      <HashRouter>
        <DarkToggle />
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

import { useEffect, useRef } from 'preact/hooks';
import { AuthProvider } from './auth/auth-provider';
import { useAuth } from './auth/auth-context';
import { LoginScreen } from './auth/login-screen';
import { KanbanBoard } from './components/board/kanban-board';
import { Toast } from './components/shared/toast';
import { DemoBanner } from './demo/demo-banner';
import { isDemoMode } from './demo/is-demo-mode';
import { loadBoard, refreshItems } from './state/actions';
import { loading } from './state/board-store';

function AuthenticatedApp() {
  const { token, user } = useAuth();
  const intervalRef = useRef<number>();
  const demo = isDemoMode();

  useEffect(() => {
    if (!token) return;

    loadBoard(token, user);

    // Disable polling in demo mode — mock data is static, no other users.
    if (!demo) {
      // Poll every 30 seconds for changes from other users
      intervalRef.current = window.setInterval(() => {
        refreshItems(token);
      }, 30000);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [token, demo]);

  if (loading.value) {
    return (
      <div class="loading-screen">
        <div class="spinner" />
        <p>Loading board...</p>
      </div>
    );
  }

  return (
    <>
      {demo && <DemoBanner />}
      <KanbanBoard />
    </>
  );
}

function AppContent() {
  const { isAuthenticated } = useAuth();

  return (
    <>
      {isAuthenticated ? <AuthenticatedApp /> : <LoginScreen />}
      <Toast />
    </>
  );
}

export function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

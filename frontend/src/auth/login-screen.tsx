import { useAuth } from './auth-context';

export function LoginScreen() {
  const { login } = useAuth();

  return (
    <div class="login-screen">
      <div class="login-card">
        <h1>Hive</h1>
        <p>Family Kanban Board</p>
        <button class="login-btn" onClick={login}>
          Sign in with Google
        </button>
      </div>
    </div>
  );
}

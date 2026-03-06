import { useState, useEffect, useCallback, useRef } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { AuthContext } from './auth-context';
import type { UserInfo } from '../api/types';
import { isDemoMode } from '../demo/is-demo-mode';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets openid email profile';

const TOKEN_KEY = 'hive_token';
const USER_KEY = 'hive_user';
const TOKEN_EXPIRY_KEY = 'hive_token_expiry';

function loadCachedAuth(): { token: string; user: UserInfo; expiry: number } | null {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const user = localStorage.getItem(USER_KEY);
    const expiry = localStorage.getItem(TOKEN_EXPIRY_KEY);
    if (token && user && expiry && Date.now() < Number(expiry)) {
      return { token, user: JSON.parse(user), expiry: Number(expiry) };
    }
    // Expired or missing — clear stale data
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(TOKEN_EXPIRY_KEY);
  } catch { /* ignore */ }
  return null;
}

function saveCachedAuth(token: string, user: UserInfo, expiresIn: number) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    // GIS tokens last ~3600s; shave 60s to avoid edge-case expiry
    localStorage.setItem(TOKEN_EXPIRY_KEY, String(Date.now() + (expiresIn - 60) * 1000));
  } catch { /* ignore */ }
}

function clearCachedAuth() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(TOKEN_EXPIRY_KEY);
  } catch { /* ignore */ }
}

declare const google: any;

/** Mock user injected in demo mode. */
const DEMO_USER: UserInfo = {
  name: 'Demo User',
  email: 'demo@hive.local',
  picture: '',
};

interface Props {
  children: ComponentChildren;
}

export function AuthProvider({ children }: Props) {
  const demo = isDemoMode();
  const cached = demo ? null : loadCachedAuth();
  const [token, setToken] = useState<string | null>(demo ? 'demo-token' : cached?.token ?? null);
  const [user, setUser] = useState<UserInfo | null>(demo ? DEMO_USER : cached?.user ?? null);
  const tokenClientRef = useRef<any>(null);

  useEffect(() => {
    // In demo mode, skip GIS initialization entirely.
    if (demo) return;

    // Wait for GIS script to load
    const init = () => {
      if (typeof google === 'undefined' || !google.accounts?.oauth2) {
        setTimeout(init, 100);
        return;
      }

      tokenClientRef.current = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        prompt: '',
        callback: async (response: any) => {
          if (response.error) {
            console.error('OAuth error:', response.error);
            return;
          }
          setToken(response.access_token);

          // Fetch user info
          try {
            const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
              headers: { Authorization: `Bearer ${response.access_token}` },
            });
            const info = await res.json();
            const userInfo: UserInfo = {
              email: info.email,
              name: info.name,
              picture: info.picture,
            };
            setUser(userInfo);
            saveCachedAuth(response.access_token, userInfo, response.expires_in || 3600);
          } catch (err) {
            console.error('Failed to fetch user info:', err);
          }
        },
        error_callback: (error: any) => {
          console.error('Token client error:', error);
        },
      });
    };

    init();
  }, [demo]);

  const login = useCallback(() => {
    tokenClientRef.current?.requestAccessToken();
  }, []);

  const logout = useCallback(() => {
    if (demo) {
      // In demo mode, navigate to app without ?demo param to exit demo mode
      window.location.search = '';
      return;
    }
    // Don't revoke the token — that removes the consent grant and forces
    // the full consent flow on next login. Just clear local state.
    clearCachedAuth();
    setToken(null);
    setUser(null);
  }, [token, demo]);

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        isAuthenticated: !!token,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

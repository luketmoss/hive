import { useState, useEffect, useCallback, useRef } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { AuthContext } from './auth-context';
import type { UserInfo } from '../api/types';
import { isDemoMode } from '../demo/is-demo-mode';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets openid email profile';

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
  const [token, setToken] = useState<string | null>(demo ? 'demo-token' : null);
  const [user, setUser] = useState<UserInfo | null>(demo ? DEMO_USER : null);
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
            setUser({
              email: info.email,
              name: info.name,
              picture: info.picture,
            });
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
    if (token) {
      google.accounts.oauth2.revoke(token);
    }
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

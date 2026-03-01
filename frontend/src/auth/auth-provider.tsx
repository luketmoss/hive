import { useState, useEffect, useCallback, useRef } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { AuthContext } from './auth-context';
import type { UserInfo } from '../api/types';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets openid email profile';

declare const google: any;

interface Props {
  children: ComponentChildren;
}

export function AuthProvider({ children }: Props) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserInfo | null>(null);
  const tokenClientRef = useRef<any>(null);

  useEffect(() => {
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
  }, []);

  const login = useCallback(() => {
    tokenClientRef.current?.requestAccessToken();
  }, []);

  const logout = useCallback(() => {
    if (token) {
      google.accounts.oauth2.revoke(token);
    }
    setToken(null);
    setUser(null);
  }, [token]);

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

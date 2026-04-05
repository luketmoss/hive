import { createContext } from 'preact';
import { useContext } from 'preact/hooks';
import type { UserInfo } from '../api/types';

export interface AuthState {
  token: string | null;
  user: UserInfo | null;
  isAuthenticated: boolean;
  isAuthLoading: boolean;
  login: () => void;
  logout: () => void;
  updateUserName: (newName: string) => void;
}

export const AuthContext = createContext<AuthState>({
  token: null,
  user: null,
  isAuthenticated: false,
  isAuthLoading: false,
  login: () => {},
  logout: () => {},
  updateUserName: () => {},
});

export function useAuth(): AuthState {
  return useContext(AuthContext);
}

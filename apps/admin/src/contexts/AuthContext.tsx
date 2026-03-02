import { createContext, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { AuthHandler, AuthState, LoginForm } from '@/shared/types/auth';
import { validateAdminLogin } from '@/services/authService';

interface AuthContextValue {
  authState: AuthState;
  login: AuthHandler;
  logout: () => void;
}

const AUTH_STORAGE_KEY = 'dede-admin-auth';

const defaultAuthState: AuthState = {
  isAuthenticated: false,
  username: '',
};

const AuthContext = createContext<AuthContextValue | null>(null);

const readStoredAuth = (): AuthState => {
  const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) {
    return defaultAuthState;
  }

  try {
    const parsed = JSON.parse(raw) as AuthState;
    if (parsed.isAuthenticated && parsed.username) {
      return parsed;
    }
    return defaultAuthState;
  } catch {
    return defaultAuthState;
  }
};

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [authState, setAuthState] = useState<AuthState>(readStoredAuth);

  const login: AuthHandler = async (form: LoginForm) => {
    const isValid = await validateAdminLogin(form);
    if (!isValid) {
      return false;
    }

    const nextState: AuthState = {
      isAuthenticated: true,
      username: form.username,
    };

    window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextState));
    setAuthState(nextState);
    return true;
  };

  const logout = () => {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    setAuthState(defaultAuthState);
  };

  const value = useMemo(
    () => ({
      authState,
      login,
      logout,
    }),
    [authState]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth 必须在 AuthProvider 内使用');
  }
  return context;
};

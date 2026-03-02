import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { AuthState, UpdateProfileRequest } from '../shared/types/auth';
import { authService } from '../services/authService';

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<{ success: boolean; message: string }>;
  register: (
    email: string,
    password: string,
    username: string,
    workspaceType: 'creator' | 'member',
    invitationCode?: string
  ) => Promise<{ success: boolean; message: string }>;
  logout: () => void;
  updateProfile: (data: UpdateProfileRequest) => Promise<{ success: boolean; message: string }>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    user: null,
    workspace: null,
    token: null,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const token = authService.getToken();
      
      if (token) {
        try {
          const response = await authService.verifyToken(token);
          
          if (response.success && response.data) {
            setAuthState({
              isAuthenticated: true,
              user: response.data.user,
              workspace: response.data.workspace,
              token,
            });
          } else {
            authService.removeToken();
            setAuthState({
              isAuthenticated: false,
              user: null,
              workspace: null,
              token: null,
            });
          }
        } catch (error) {
          console.error('Token verification failed:', error);
          authService.removeToken();
          setAuthState({
            isAuthenticated: false,
            user: null,
            workspace: null,
            token: null,
          });
        }
      }
      
      setIsLoading(false);
    };

    initAuth();

    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        const token = authService.getToken();
        if (token) {
          try {
            const response = await authService.verifyToken(token);
            if (!response.success) {
              logout();
            }
          } catch (error) {
            console.error('Token check failed:', error);
            logout();
          }
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const response = await authService.login({ email, password });
      
      if (response.success && response.data) {
        authService.saveToken(response.data.token);
        authService.saveUserInfo(response.data.user.userId, response.data.user.username);
        setAuthState({
          isAuthenticated: true,
          user: response.data.user,
          workspace: response.data.workspace,
          token: response.data.token,
        });
        return { success: true, message: response.message };
      }
      
      return { success: false, message: response.message };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, message: '登录失败，请检查网络连接' };
    }
  };

  const register = async (
    email: string,
    password: string,
    username: string,
    workspaceType: 'creator' | 'member',
    invitationCode?: string
  ) => {
    try {
      const response = await authService.register({
        email,
        password,
        username,
        workspaceType,
        invitationCode,
      });
      
      if (response.success && response.data) {
        authService.saveToken(response.data.token);
        setAuthState({
          isAuthenticated: true,
          user: response.data.user,
          workspace: response.data.workspace,
          token: response.data.token,
        });
        return { success: true, message: response.message };
      }
      
      return { success: false, message: response.message };
    } catch (error) {
      console.error('Register error:', error);
      return { success: false, message: '注册失败，请检查网络连接' };
    }
  };

  const logout = () => {
    authService.removeToken();
    setAuthState({
      isAuthenticated: false,
      user: null,
      workspace: null,
      token: null,
    });
  };

  const updateProfile = async (data: UpdateProfileRequest) => {
    try {
      const token = authService.getToken();
      if (!token) return { success: false, message: '未登录' };

      const response = await authService.updateProfile(data, token);

      if (response.success && response.data) {
        setAuthState((prev) => ({
          ...prev,
          user: response.data!.user,
        }));
        return { success: true, message: response.message };
      }

      return { success: false, message: response.message };
    } catch (error) {
      console.error('Update profile error:', error);
      return { success: false, message: '更新失败，请检查网络连接' };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        ...authState,
        login,
        register,
        logout,
        updateProfile,
        isLoading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

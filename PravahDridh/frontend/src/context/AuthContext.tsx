/**
 * PravahDridh — Authentication & Role-Based Access Control (RBAC) Context
 * Manages JWT tokens, user session state, login/logout, and client-side role guards.
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, UserRole, LoginCredentials, AuthState } from '../types/auth';
import { authApi } from '../api/auth';

interface AuthContextType extends AuthState {
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => void;
  hasRole: (allowedRoles: UserRole | UserRole[]) => boolean;
  canAccessExplainability: () => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('hermes_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem('hermes_access_token');
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Validate existing session on application boot
  useEffect(() => {
    let isMounted = true;

    async function initAuth() {
      const storedToken = localStorage.getItem('hermes_access_token');
      if (storedToken) {
        try {
          const me = await authApi.getMe();
          if (isMounted) {
            setUser(me);
            localStorage.setItem('hermes_user', JSON.stringify(me));
          }
        } catch {
          if (isMounted) {
            // Token expired or invalid
            localStorage.removeItem('hermes_access_token');
            localStorage.removeItem('hermes_refresh_token');
            localStorage.removeItem('hermes_user');
            setUser(null);
            setToken(null);
          }
        }
      }
      if (isMounted) {
        setIsLoading(false);
      }
    }

    initAuth();

    // Listen to token expiration dispatched from Axios interceptor
    const handleAuthExpired = () => {
      setUser(null);
      setToken(null);
      setError('Session expired. Please log in again.');
    };
    window.addEventListener('hermes-auth-expired', handleAuthExpired);

    return () => {
      isMounted = false;
      window.removeEventListener('hermes-auth-expired', handleAuthExpired);
    };
  }, []);

  const login = useCallback(async (credentials: LoginCredentials) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await authApi.login(credentials);
      setToken(response.access_token);
      setUser(response.user);
      localStorage.setItem('hermes_access_token', response.access_token);
      localStorage.setItem('hermes_refresh_token', response.refresh_token);
      localStorage.setItem('hermes_user', JSON.stringify(response.user));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Authentication failed';
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('hermes_access_token');
    localStorage.removeItem('hermes_refresh_token');
    localStorage.removeItem('hermes_user');
    setUser(null);
    setToken(null);
    setError(null);
  }, []);

  const hasRole = useCallback((allowedRoles: UserRole | UserRole[]): boolean => {
    if (!user) return false;
    // ADMIN has universal permission
    if (user.role === 'ADMIN') return true;

    const rolesArray = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
    return rolesArray.includes(user.role);
  }, [user]);

  const canAccessExplainability = useCallback((): boolean => {
    // Restricted to ANALYST, SUPERVISOR, ADMIN as per backend require_roles
    return hasRole(['ANALYST', 'SUPERVISOR', 'ADMIN']);
  }, [hasRole]);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token && !!user,
        isLoading,
        error,
        login,
        logout,
        hasRole,
        canAccessExplainability,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

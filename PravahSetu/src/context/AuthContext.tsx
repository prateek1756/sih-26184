import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../types';
import { AuthService } from '../services/authService';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  loginWithPassword: (identifier: string) => Promise<void>;
  loginWithOtp: (mobile: string, otp: string) => Promise<void>;
  register: (data: {
    fullName: string;
    mobile: string;
    email: string;
    state: string;
    district: string;
  }) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const existing = AuthService.getCurrentUser();
    if (existing) {
      setUser(existing);
    }
    setIsLoading(false);
  }, []);

  const loginWithPassword = async (identifier: string) => {
    setIsLoading(true);
    try {
      const loggedIn = await AuthService.loginWithPassword(identifier);
      setUser(loggedIn);
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithOtp = async (mobile: string, otp: string) => {
    setIsLoading(true);
    try {
      const loggedIn = await AuthService.verifyOtp(mobile, otp);
      setUser(loggedIn);
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (data: {
    fullName: string;
    mobile: string;
    email: string;
    state: string;
    district: string;
  }) => {
    setIsLoading(true);
    try {
      const newUser = await AuthService.register(data);
      setUser(newUser);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    AuthService.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        loginWithPassword,
        loginWithOtp,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

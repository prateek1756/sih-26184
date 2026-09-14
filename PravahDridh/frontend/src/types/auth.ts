/**
 * PravahDridh — Authentication & RBAC Types
 * Matches backend UserRead, Token, LoginRequest, and RBAC roles
 */

export type UserRole = 'VIEWER' | 'ANALYST' | 'SUPERVISOR' | 'ADMIN' | 'INVESTIGATOR' | 'ML_ENGINEER';

export interface User {
  id: string;
  email: string;
  full_name: string;
  badge_number?: string | null;
  agency?: string | null;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: User;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

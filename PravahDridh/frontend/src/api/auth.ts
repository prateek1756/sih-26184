/**
 * PravahDridh — Authentication API Service
 * Interacts with /api/v1/auth/*
 */

import { apiClient, unwrapResponse } from './client';
import { StandardResponse } from '../types/common';
import { LoginCredentials, TokenResponse, User } from '../types/auth';

export const authApi = {
  /**
   * Log in with email and password
   * POST /api/v1/auth/login
   */
  async login(credentials: LoginCredentials): Promise<TokenResponse> {
    return unwrapResponse<TokenResponse>(
      apiClient.post<StandardResponse<TokenResponse>>('/auth/login', credentials)
    );
  },

  /**
   * Fetch currently authenticated user profile
   * GET /api/v1/auth/me
   */
  async getMe(): Promise<User> {
    return unwrapResponse<User>(
      apiClient.get<StandardResponse<User>>('/auth/me')
    );
  },

  /**
   * Refresh JWT token pair
   * POST /api/v1/auth/refresh
   */
  async refreshToken(refreshToken: string): Promise<TokenResponse> {
    return unwrapResponse<TokenResponse>(
      apiClient.post<StandardResponse<TokenResponse>>('/auth/refresh', {
        refresh_token: refreshToken,
      })
    );
  },
};

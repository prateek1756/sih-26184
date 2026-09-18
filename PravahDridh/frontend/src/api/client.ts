/**
 * PravahDridh — Centralized Axios HTTP Client
 * - Extracts base URL from VITE_API_BASE_URL
 * - Injects JWT Bearer token into Authorization header
 * - Intercepts 401 errors for session expiration
 * - Unwraps StandardResponse envelopes safely
 */

import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { StandardResponse, ErrorDetail } from '../types/common';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

// Request Interceptor: Attach JWT Token from localStorage
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('hermes_access_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: 401 handling & Error normalization
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<StandardResponse<unknown> | { detail?: string }>) => {
    if (error.response?.status === 401) {
      // Don't auto-redirect if we are already on login
      if (!window.location.pathname.includes('/login')) {
        localStorage.removeItem('hermes_access_token');
        localStorage.removeItem('hermes_refresh_token');
        localStorage.removeItem('hermes_user');
        window.dispatchEvent(new CustomEvent('hermes-auth-expired'));
      }
    }
    return Promise.reject(error);
  }
);

/**
 * Helper to unwrap StandardResponse<T> data or throw typed error
 */
export async function unwrapResponse<T>(
  promise: Promise<{ data: StandardResponse<T> }>
): Promise<T> {
  try {
    const response = await promise;
    if (response.data.status === 'success' && response.data.data !== null) {
      return response.data.data;
    }
    throw new Error(response.data.error?.message || 'API request failed with unexpected status');
  } catch (err) {
    if (axios.isAxiosError(err)) {
      const axiosErr = err as AxiosError<StandardResponse<unknown> | { detail?: string }>;
      const errorData = axiosErr.response?.data;
      if (errorData && 'error' in errorData && errorData.error) {
        const errorDetail = errorData.error as ErrorDetail;
        throw new Error(errorDetail.message || 'Server returned an error response');
      }
      if (errorData && 'detail' in errorData && typeof errorData.detail === 'string') {
        throw new Error(errorData.detail);
      }
      if (axiosErr.response?.status === 403) {
        throw new Error('Forbidden: Your role does not have permission for this intelligence resource.');
      }
      if (axiosErr.response?.status === 404) {
        throw new Error('Resource not found on server.');
      }
      if (axiosErr.code === 'ECONNABORTED' || !axiosErr.response) {
        throw new Error('Backend server is unavailable. Ensure FastAPI server is running.');
      }
    }
    throw err instanceof Error ? err : new Error(String(err));
  }
}

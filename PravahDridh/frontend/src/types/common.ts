/**
 * PravahDridh — Common API Response Types
 * Matches FastAPI StandardResponse[T], PaginationMeta, and ErrorDetail schemas
 */

export interface PaginationMeta {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
}

export interface ErrorDetail {
  code: string;
  message: string;
  details?: unknown;
}

export interface StandardResponse<T> {
  status: 'success' | 'error';
  data: T | null;
  meta?: PaginationMeta | null;
  error?: ErrorDetail | null;
}

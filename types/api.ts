export interface ApiError {
  message: string;
  statusCode?: number;
  details?: unknown;
  isNetworkError?: boolean;
}

export type AsyncStatus = 'idle' | 'loading' | 'success' | 'error';

export interface AsyncState<T> {
  data: T | null;
  status: AsyncStatus;
  error: string | null;
}

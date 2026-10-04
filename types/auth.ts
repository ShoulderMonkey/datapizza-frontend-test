export interface AuthUser {
  userId: string;
  isAuthenticated: boolean;
}

export interface LoginRequest {
  user_id: string;
}

export interface LoginResponse {
  status?: string;
  message?: string;
  user_id?: string;
  [key: string]: unknown;
}

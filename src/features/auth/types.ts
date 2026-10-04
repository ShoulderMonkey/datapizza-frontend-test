export type { LoginRequest, LoginResponse, AsyncStatus } from '@/src/api';

export interface AuthUser {
  userId: string;
  isAuthenticated: boolean;
}
